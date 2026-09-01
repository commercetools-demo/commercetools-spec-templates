#!/usr/bin/env node

/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// ctsx — authoring tooling. NEVER shipped to a developer; it is not in package.json "files".
//
//   ctsx build     YAML -> registry.json, dist/questions/*.json, rendered/**   (all committed)
//   ctsx lint      schema + referential integrity + golden drift               (exit 3 on drift)
//   ctsx coverage  what each (industry x model) combination actually resolves to

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import YAML from "yaml";
import { execFileSync } from "node:child_process";
import { mapResponse } from "../lib/response.mjs";
import { parseCsvObjects } from "../lib/csv.mjs";
import { pseudonym, collisions, generateKey, KEY_ENV } from "../lib/pseudonym.mjs";
import { loadCatalog, loadQuestionnaire } from "../lib/catalog.mjs";
import { resolveCombination } from "../lib/resolve.mjs";
import { sha256 } from "../lib/receipt.mjs";
import { checkRights } from "../lib/rights.mjs";
import { FRAMEWORKS } from "../lib/detect.mjs";
import * as openspec from "../renderers/openspec/index.mjs";

const ROOT = process.cwd();
const RENDERERS = { openspec };
const out = (m) => process.stdout.write(m + "\n");
const warn = (m) => process.stderr.write("! " + m + "\n");

const write = (rel, content) => {
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const prior = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null;
  if (prior === content) return false;
  fs.writeFileSync(abs, content);
  return true;
};

function combinations(catalog) {
  const list = [];
  // `_base` first: the industry-agnostic storefront, and the fallback for "my industry isn't
  // listed". Every business model that has any common content gets a _base bundle.
  for (const model of Object.keys(catalog.business_models)) list.push({ industry: "_base", model });
  for (const industry of Object.keys(catalog.verticals)) {
    for (const model of catalog.verticals[industry].supported_models) {
      list.push({ industry, model });
    }
  }
  return list;
}

function build() {
  const catalog = loadCatalog(ROOT);
  let changed = 0;

  // 1. questions: YAML -> JSON, so the shipped engine needs no YAML parser.
  for (const id of ["developer-intake"]) {
    const q = loadQuestionnaire(ROOT, id);
    if (write(`dist/questions/${id}.json`, JSON.stringify(q, null, 2) + "\n")) changed++;
  }

  // 2. rendered/** per combination per framework, plus the registry entry describing it.
  const registryCombos = {};
  const rendered = new Set();
  for (const { industry, model } of combinations(catalog)) {
    const resolved = resolveCombination({ industry, model, catalog });
    if (resolved.status !== "ok" || resolved.capability_count === 0) continue;
    const entry = {
      match: resolved.match,
      capability_count: resolved.capability_count,
      p1_count: resolved.p1_count,
      native: resolved.native,
      derived: resolved.derived,
      gaps: resolved.gaps,
      open_questions: resolved.open_questions.length,
      skills: resolved.skills,
      journeys: resolved.journeys,
      epics: resolved.epics,
      rendered: {},
    };
    for (const [fwName, renderer] of Object.entries(RENDERERS)) {
      for (const placement of fwName === "openspec" ? ["specs", "change"] : ["default"]) {
        const files = renderer.render(resolved, { placement });
        const base = `rendered/${industry}/${model.toLowerCase()}/${fwName}-${placement}`;
        for (const f of files) {
          if (write(`${base}/${f.path}`, f.content)) changed++;
          rendered.add(`${base}/${f.path}`);
        }
        const manifest = {
          manifest_version: 1,
          // JSON takes no comment, so the licence the markdown carries inline goes in a key here.
          license: "MIT",
          industry, model, framework: fwName, placement,
          content_version: catalog.meta.content_version,
          files: files.map((f) => ({
            path: f.path, capability: f.capability ?? null,
            priority: f.priority ?? null, epic: f.epic ?? null,
            sha256: sha256(f.content),
          })),
        };
        if (write(`${base}/manifest.json`, JSON.stringify(manifest, null, 2) + "\n")) changed++;
        rendered.add(`${base}/manifest.json`);
        entry.rendered[`${fwName}:${placement}`] = {
          path: base,
          files: files.length,
          sha256: sha256(files.map((f) => f.path + "\0" + f.content).join("\0")),
        };
      }
    }
    registryCombos[`${industry}|${model}`] = entry;
  }

  // Delete rendered files that no longer have a source — otherwise a deleted capability lingers.
  const renderedRoot = path.join(ROOT, "rendered");
  if (fs.existsSync(renderedRoot)) {
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (!rendered.has(path.relative(ROOT, p))) {
          fs.rmSync(p);
          changed++;
        }
      }
    };
    walk(renderedRoot);
  }

  // 3. registry.json — the single discovery root.
  const registry = {
    $schema: "./registry.schema.json",
    license: "MIT",
    registry_version: 1,
    content_version: catalog.meta.content_version,
    compat: Object.fromEntries(
      Object.entries(FRAMEWORKS).map(([k, v]) => [
        k,
        { label: v.label, description: v.description, detect: v.detectDir,
          requires: v.requires, init: v.init, implemented: k in RENDERERS },
      ]),
    ),
    overlay: {
      skill: "commercetools:commercetools-spec-driven-development",
      package: "@commercetools/commercetools-ai-plugin-sdd",
    },
    skills: Object.keys(catalog.skills),
    global_epics: catalog.global_epics,
    journeys: catalog.journeys,
    industry_groups: catalog.industry_groups,
    business_models: Object.fromEntries(
      Object.entries(catalog.business_models).map(([k, v]) => [
        k, { label: v.label, description: v.description, inherits: v.inherits ?? [] },
      ]),
    ),
    industries: Object.fromEntries([
      // `_base` is resolvable but hidden from the industry question — it is what
      // `on_other: {resolve_to: _base}` falls back to, not a choice on the menu.
      ["_base", {
        label: "Generic",
        group: null,
        maturity: "stable",
        hidden: true,
        supported_models: Object.keys(catalog.business_models)
          .filter((m) => registryCombos[`_base|${m}`]),
        owners: [],
        counts: Object.fromEntries(
          Object.keys(catalog.business_models)
            .filter((m) => registryCombos[`_base|${m}`])
            .map((m) => [m, registryCombos[`_base|${m}`].capability_count]),
        ),
      }],
      ...Object.entries(catalog.industries).map(([id, meta]) => {
        const v = catalog.verticals[id];
        const supported = v?.supported_models ?? [];
        return [id, {
          label: meta.label,
          group: meta.group,
          maturity: meta.maturity,
          supported_models: supported,
          owners: v?.owners ?? [],
          // Per-model, because the count differs sharply by model (grocery is 33 for B2C and
          // 50 for B2B). A single number here misreports whichever model was not chosen.
          counts: Object.fromEntries(
            supported.map((m) => [m, registryCombos[`${id}|${m}`]?.capability_count ?? 0]),
          ),
        }];
      }),
    ]),
    combinations: registryCombos,
  };
  if (write("registry.json", JSON.stringify(registry, null, 2) + "\n")) changed++;

  // 4. the collector form. Its industry dropdown is derived from taxonomy/industries.yaml, so it
  // is as much a build output as rendered/ is — leaving it to a separate command is how a new
  // industry ends up published to developers but missing from the form asking about it.
  collectRender({ quiet: true });

  out(`build: ${changed} file(s) written · ${Object.keys(registryCombos).length} combination(s)`);
  return 0;
}

function coverage() {
  const catalog = loadCatalog(ROOT);
  const rows = [];
  const base = {};
  for (const model of Object.keys(catalog.business_models)) {
    const r = resolveCombination({ industry: "_base", model, catalog });
    base[model] = r.capability_count;
    rows.push(
      `${"_base".padEnd(10)} x ${model.padEnd(6)} : ${String(r.capability_count).padStart(3)} caps ` +
        `(industry-agnostic storefront), ${r.gaps.length} gap(s) -> ${r.match}`,
    );
  }
  rows.push("");
  for (const industry of Object.keys(catalog.industries)) {
    const hasVertical = !!catalog.verticals[industry];
    for (const model of Object.keys(catalog.business_models)) {
      const r = resolveCombination({ industry, model, catalog });
      if (r.status === "unsupported") {
        rows.push(`${industry.padEnd(10)} x ${model.padEnd(6)} : not supported (vertical.yaml)`);
        continue;
      }
      // Separate what the vertical adds from what it inherits from the base, so a "42 caps" row
      // for an industry with no vertical.yaml cannot be mistaken for industry-specific content.
      const own = r.capability_count - (base[model] ?? 0);
      const note = hasVertical
        ? `${String(own).padStart(2)} industry + ${String(base[model] ?? 0).padStart(3)} base`
        : `base only — no vertical.yaml`;
      rows.push(
        `${industry.padEnd(10)} x ${model.padEnd(6)} : ${String(r.capability_count).padStart(3)} caps ` +
          `(${note}), ${r.gaps.length} gap(s) -> ${r.match}`,
      );
    }
  }
  out(rows.join("\n"));
  return 0;
}

function lint({ strict }) {
  const catalog = loadCatalog(ROOT);
  const errors = [];
  const seen = new Set();
  const legalSkills = new Set(Object.keys(catalog.skills));
  const legalDomains = new Set(Object.keys(catalog.domains));
  const legalIndustries = new Set(Object.keys(catalog.industries));
  const legalModels = new Set(Object.keys(catalog.business_models));
  const FRAMEWORK_WORDS = /\b(FR-\d|SC-\d|user story|ADDED Requirements|tasks\.md|proposal\.md|Phase \d)\b/i;

  for (const c of catalog.capabilities) {
    const at = c._file;
    // A: identity
    if (!/^[a-z0-9-]+\.[a-z0-9-]+$/.test(c.id ?? "")) errors.push(`${at}: bad id '${c.id}'`);
    if (seen.has(c.id)) errors.push(`${at}: duplicate id '${c.id}'`);
    seen.add(c.id);
    if (path.basename(at, ".yaml") !== c.id?.split(".").pop()) {
      errors.push(`${at}: file stem must equal the id's last segment ('${c.id?.split(".").pop()}')`);
    }
    // B: exactly one normative verb
    const modals = (c.requirement ?? "").match(/\b(SHALL|MUST|SHOULD|MAY)\b/g) ?? [];
    if (modals.length !== 1) errors.push(`${at}: requirement needs exactly one SHALL/MUST/SHOULD/MAY, found ${modals.length}`);
    if ((c.requirement ?? "").length > 400) errors.push(`${at}: requirement exceeds 400 chars`);
    // C: at least one scenario, each complete
    if (!c.scenarios?.length) errors.push(`${at}: no scenarios`);
    for (const s of c.scenarios ?? []) {
      if (!s.id || !s.when || !s.then) errors.push(`${at}: scenario '${s.id ?? "?"}' needs id, when and then`);
      for (const m of s.business_models ?? []) if (!legalModels.has(m)) errors.push(`${at}: scenario '${s.id}' unknown model '${m}'`);
    }
    // D: closed vocabularies
    for (const i of c.industry ?? []) if (i !== "*" && !legalIndustries.has(i)) errors.push(`${at}: unknown industry '${i}'`);
    for (const m of c.business_models ?? []) if (m !== "*" && !legalModels.has(m)) errors.push(`${at}: unknown business model '${m}'`);
    for (const d of c.domains ?? []) if (!legalDomains.has(d)) errors.push(`${at}: unknown domain '${d}'`);
    if (c.skill && !legalSkills.has(c.skill)) errors.push(`${at}: unknown skill '${c.skill}'`);
    for (const s of c.supporting_skills ?? []) if (!legalSkills.has(s)) errors.push(`${at}: unknown supporting skill '${s}'`);
    // E: skill and commercetools block imply each other
    if (c.commercetools && !c.skill) errors.push(`${at}: has a commercetools block but no skill`);
    if (c.skill && !c.commercetools) errors.push(`${at}: has a skill but no commercetools block`);
    // F: no framework vocabulary in a source file
    if (FRAMEWORK_WORDS.test(c.requirement ?? "") || FRAMEWORK_WORDS.test(c.rationale ?? "")) {
      errors.push(`${at}: framework vocabulary in source prose — the renderer owns that`);
    }
    // G: epic must exist either globally or in every vertical the capability claims
    const globalEpics = new Set((catalog.global_epics ?? []).map((e) => e.slug));
    if (!globalEpics.has(c.epic)) {
      for (const i of c.industry ?? []) {
        if (i === "*") {
          errors.push(`${at}: industry-agnostic capability must use a global epic from taxonomy/epics.yaml, got '${c.epic}'`);
          continue;
        }
        const v = catalog.verticals[i];
        if (v && !(v.epics ?? []).some((e) => e.slug === c.epic)) {
          errors.push(`${at}: epic '${c.epic}' is neither global nor in ${i}/vertical.yaml`);
        }
      }
    }
    // G2: journeys must exist in taxonomy/journeys.yaml
    for (const j of c.journeys ?? []) {
      if (!catalog.journeys[j]) errors.push(`${at}: unknown journey '${j}'`);
    }
    // H: grounding and rights
    for (const a of c.commercetools?.api_surface ?? []) {
      if (!a.grounded_by || !a.doc || !a.verified_at) errors.push(`${at}: api_surface entry '${(a.ref ?? "").slice(0, 40)}...' is missing grounded_by/doc/verified_at`);
    }
    const src = catalog.sources[c.provenance?.document];
    if (c.provenance?.source && c.provenance.source !== "authored" && !src) {
      errors.push(`${at}: provenance.document '${c.provenance?.document}' has no sources/*.provenance.yaml`);
    }
    if (strict) for (const e of checkRights(c, src)) errors.push(`${at}: ${e}`);
  }

    // J: the generated Apps Script must actually parse. Emitting a broken script is a failure
    // the admin only discovers after pasting it into a browser, and `node --check` cannot be
    // used to catch it — Node refuses the .gs extension entirely.
    for (const f of fs.existsSync(path.join(ROOT, "collector/forms"))
        ? fs.readdirSync(path.join(ROOT, "collector/forms")).filter((x) => x.endsWith(".gs")) : []) {
      const src = fs.readFileSync(path.join(ROOT, "collector/forms", f), "utf8");
      try {
        new vm.Script(src, { filename: f });
      } catch (e) {
        errors.push(`collector/forms/${f}: generated script does not parse — ${e.message}`);
      }
    }

  // K: the questionnaire must still carry exactly one industry question. One responses sheet now
  // holds every industry's answers, and `collect:ingest` files each response by that answer —
  // without it a response says what to build and never says who for.
  const qFile = path.join(ROOT, "collector/questions/expert-intake.yaml");
  if (fs.existsSync(qFile)) {
    const qn = YAML.parse(fs.readFileSync(qFile, "utf8"));
    const industryQs = (qn.questions ?? []).filter((x) => x.options_from === "registry.industries");
    if (industryQs.length !== 1) {
      errors.push(`collector/questions/expert-intake.yaml: needs exactly one question with ` +
        `options_from: registry.industries — collect:ingest files each response by it — found ${industryQs.length}`);
    } else if (!industryQs[0].required) {
      errors.push(`collector/questions/expert-intake.yaml: question '${industryQs[0].id}' must be ` +
        `required; an optional industry means responses that cannot be filed`);
    }
  }

  // I: golden drift — rendered/, collector/forms/ and registry.json must match what the sources
  // produce now. collector/forms/ is in here because the form's dropdown comes from the taxonomy:
  // adding an industry without re-rendering leaves the form silently unable to collect for it.
  let drift = 0;
  if (fs.existsSync(path.join(ROOT, "registry.json"))) {
    const before = fs.readFileSync(path.join(ROOT, "registry.json"), "utf8");
    const files = new Map();
    for (const dir of ["rendered", "collector/forms"]) {
      const abs = path.join(ROOT, dir);
      if (!fs.existsSync(abs)) continue;
      const walk = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, e.name);
          if (e.isDirectory()) walk(p);
          else files.set(path.relative(ROOT, p), fs.readFileSync(p, "utf8"));
        }
      };
      walk(abs);
    }
    build();
    if (fs.readFileSync(path.join(ROOT, "registry.json"), "utf8") !== before) drift++;
    for (const [p, content] of files) {
      if (!fs.existsSync(path.join(ROOT, p)) || fs.readFileSync(path.join(ROOT, p), "utf8") !== content) drift++;
    }
  }

  if (errors.length) {
    for (const e of errors) warn(e);
    out(`lint: ${errors.length} error(s)`);
    return 1;
  }
  if (drift) {
    out(`lint: ${drift} generated file(s) drifted from source — commit the rebuild`);
    return 3;
  }
  out(`lint: ok · ${catalog.capabilities.length} capabilit(ies)`);
  return 0;
}

// ---- collector forms -------------------------------------------------------------------------
// ONE Google Form for every industry, emitted as an Apps Script you paste into script.google.com
// and run once. Answers never touch this repository — it is public, and a colleague answering
// "what is missing from a bare storefront" under their own name in public would hedge, which is
// exactly the candour the questionnaire exists to collect.
//
// The industry is the form's FIRST QUESTION. That costs the later questions their interpolated
// industry name — no form platform can pipe an earlier answer into a later label — and buys one
// URL, one responses sheet, and an industry list that grows by re-running `setup` on the form
// already in circulation.

const gsString = (v) => JSON.stringify(String(v ?? ""));

// Questionnaire type -> the FormApp.ItemType a live item reports back as. The generated script
// compares these against the form it finds, so they have to be the enum names, not our own words.
const ITEM_KIND = {
  dropdown: "LIST",
  single: "MULTIPLE_CHOICE",
  multi: "CHECKBOX",
  short_text: "TEXT",
  long_text: "PARAGRAPH_TEXT",
};

// One flat field per rendered form item: `repeat: 3` becomes feature_1..feature_3 here, so
// everything downstream (the script, the form map, ingest) sees a plain list.
function questionnaireFields(q, catalog) {
  const fields = [];
  for (const question of q.questions) {
    const reps = question.repeat ?? 1;
    for (let n = 1; n <= reps; n++) {
      let options = question.options;
      if (question.options_from === "registry.industries") {
        options = Object.values(catalog.industries).map((i) => i.label);
      }
      if (question.options_from === "registry.business_models") options = Object.keys(catalog.business_models);
      if (question.options_from === "registry.domains") options = Object.values(catalog.domains).map((d) => d.label);
      if (question.options_append) options = [...(options ?? []), ...question.options_append];
      const kind = ITEM_KIND[question.type];
      if (!kind) throw new Error(`question '${question.id}': unknown type '${question.type}'`);
      fields.push({
        id: reps > 1 ? `${question.id}_${n}` : question.id,
        label: String(question.label ?? "").replaceAll("{n}", String(n)),
        hint: question.hint ? String(question.hint).replaceAll("{n}", String(n)) : null,
        type: question.type,
        kind,
        from: question.options_from ?? null,
        multiple: question.type === "multi",
        required: reps > 1 ? n <= (question.repeat_required ?? 0) : !!question.required,
        options: options ?? null,
        max_length: question.max_length ?? null,
      });
    }
  }
  return fields;
}

function collectRender({ quiet = false } = {}) {
  const say = quiet ? () => {} : out;
  const catalog = loadCatalog(ROOT);
  const q = YAML.parse(fs.readFileSync(path.join(ROOT, "collector/questions/expert-intake.yaml"), "utf8"));
  const fields = questionnaireFields(q, catalog);
  const industryField = fields.find((f) => f.from === "registry.industries") ?? null;
  let changed = 0;

  const title = q.title ?? "commercetools spec collector";
  const description = String(q.description ?? "").trim().replace(/\s+/g, " ");

  const lines = [
    `// ============================================================================`,
    `//  ONE FILE. Paste this OVER the whole contents of the project's existing .gs`,
    `//  file: click into it, select all, paste. Do NOT add a second file — every`,
    `//  .gs in an Apps Script project shares one global scope, so a leftover copy`,
    `//  fails with`,
    `//`,
    `//      SyntaxError: Identifier 'TITLE' has already been declared`,
    `//`,
    `//  before a single line runs. Updating later means pasting over this same`,
    `//  file again, never alongside it.`,
    `//`,
    `//  DO NOT DEPLOY THIS. It is not a web app.`,
    `//`,
    `//  Run it from this editor:`,
    `//    1. pick \`setup\` in the function dropdown next to the Run button`,
    `//    2. click Run, and allow the authorization prompt (Forms, Drive, Sheets)`,
    `//    3. read the URL out of the Execution log at the bottom`,
    `//`,
    `//  Deploy > New deployment is the wrong path: a web app needs a doGet(e),`,
    `//  this has none, and you get "Script function not found: doGet".`,
    `//  This script CREATES a Google Form. The form has the URL you share; the`,
    `//  script is only what builds it, and it is finished the moment it has run.`,
    `// ============================================================================`,
    `//`,
    `// GENERATED by \`ctsx collect:render\` from collector/questions/expert-intake.yaml v${q.version}`,
    `// — do not edit. Regenerate instead.`,
    `//`,
    `// One form for every industry; the industry is the first question. Runs as you, under your`,
    `// own account: no Cloud project, no OAuth client, no admin approval.`,
    `//`,
    `// Safe to re-run, and re-running is the whole update path. Adding an industry to`,
    `// taxonomy/industries.yaml means: re-render, paste this over the old script, Run setup.`,
    `// Same form, same URL, same responses — only the dropdown grows.`,
    ``,
    `const TITLE = ${gsString(title)};`,
    `const DESCRIPTION = ${gsString(description)};`,
    ``,
    `// The questionnaire, in order. Kept as data so setup() can compare it against the live form`,
    `// item by item instead of assuming what is there.`,
    `const QUESTIONS = [`,
  ];
  for (const f of fields) {
    lines.push(`  { kind: ${gsString(f.kind)}, required: ${f.required},`);
    lines.push(`    title: ${gsString(f.label)},`);
    lines.push(`    help: ${gsString(f.hint ?? "")},`);
    lines.push(`    choices: ${f.options ? JSON.stringify(f.options) : "null"} },`);
  }
  lines.push(
    `];`,
    ``,
    `// Find the form we made last time, if any. getFilesByName also returns TRASHED files and`,
    `// files of any type, so a deleted form would otherwise come back from the bin, and a`,
    `// same-named document would crash openById.`,
    `function findExistingForm() {`,
    `  const files = DriveApp.getFilesByName(TITLE);`,
    `  while (files.hasNext()) {`,
    `    const file = files.next();`,
    `    if (file.isTrashed()) continue;`,
    `    if (file.getMimeType() !== MimeType.GOOGLE_FORMS) continue;`,
    `    return FormApp.openById(file.getId());`,
    `  }`,
    `  return null;`,
    `}`,
    ``,
    `// An ItemType enum member as the plain name QUESTIONS uses. Compared member by member on`,
    `// purpose: indexing the enum or stringifying it are both assumptions about how Apps Script`,
    `// exposes it, and a wrong guess here silently makes every item look like a mismatch.`,
    `function kindOf(item) {`,
    `  const t = item.getType();`,
    `  if (t === FormApp.ItemType.LIST) return "LIST";`,
    `  if (t === FormApp.ItemType.MULTIPLE_CHOICE) return "MULTIPLE_CHOICE";`,
    `  if (t === FormApp.ItemType.CHECKBOX) return "CHECKBOX";`,
    `  if (t === FormApp.ItemType.TEXT) return "TEXT";`,
    `  if (t === FormApp.ItemType.PARAGRAPH_TEXT) return "PARAGRAPH_TEXT";`,
    `  return "OTHER";`,
    `}`,
    ``,
    `// getItems() hands back generic Items; each has to be cast to its own type before it will`,
    `// take a title, help text or choices.`,
    `function typedItem(item, kind) {`,
    `  if (kind === "LIST") return item.asListItem();`,
    `  if (kind === "MULTIPLE_CHOICE") return item.asMultipleChoiceItem();`,
    `  if (kind === "CHECKBOX") return item.asCheckboxItem();`,
    `  if (kind === "TEXT") return item.asTextItem();`,
    `  return item.asParagraphTextItem();`,
    `}`,
    ``,
    `function newItem(form, kind) {`,
    `  if (kind === "LIST") return form.addListItem();`,
    `  if (kind === "MULTIPLE_CHOICE") return form.addMultipleChoiceItem();`,
    `  if (kind === "CHECKBOX") return form.addCheckboxItem();`,
    `  if (kind === "TEXT") return form.addTextItem();`,
    `  return form.addParagraphTextItem();`,
    `}`,
    ``,
    `function configure(item, q) {`,
    `  item.setTitle(q.title);`,
    `  item.setHelpText(q.help);`,
    `  if (q.choices) item.setChoiceValues(q.choices);`,
    `  item.setRequired(q.required);`,
    `}`,
    ``,
    `function setup() {`,
    `  const form = findExistingForm() || FormApp.create(TITLE);`,
    `  form.setTitle(TITLE);`,
    `  form.setDescription(DESCRIPTION);`,
    `  // Email collection is what lets you chase non-responders; ingest derives a`,
    `  // handle from the address and discards it. Not every account type allows it,`,
    `  // and a refusal here must not abandon a half-built form.`,
    `  try { form.setCollectEmail(true); }`,
    `  catch (e) { Logger.log("Could not turn on email collection: " + e.message); }`,
    `  try { form.setLimitOneResponsePerUser(false); form.setProgressBar(true); }`,
    `  catch (e) { Logger.log("Could not set response options: " + e.message); }`,
    ``,
    `  // Update the questions IN PLACE whenever the shape still matches.`,
    `  //`,
    `  // Deleting an item does NOT delete its column in the responses sheet: the old column keeps`,
    `  // its answers and its heading, and re-adding the question appends a SECOND column with the`,
    `  // same heading. A CSV export then has two identical headings and the empty one wins.`,
    `  // Adding an industry to the dropdown must not cost you the answers you already collected.`,
    `  const existing = form.getItems();`,
    `  let sameShape = existing.length === QUESTIONS.length;`,
    `  for (let i = 0; sameShape && i < QUESTIONS.length; i++) {`,
    `    if (kindOf(existing[i]) !== QUESTIONS[i].kind) sameShape = false;`,
    `  }`,
    ``,
    `  if (sameShape) {`,
    `    for (let i = 0; i < QUESTIONS.length; i++) {`,
    `      configure(typedItem(existing[i], QUESTIONS[i].kind), QUESTIONS[i]);`,
    `    }`,
    `    Logger.log("Updated " + QUESTIONS.length + " question(s) in place; response columns kept.");`,
    `  } else {`,
    `    if (existing.length) {`,
    `      Logger.log("The questionnaire's shape changed (" + existing.length + " item(s) -> " +`,
    `        QUESTIONS.length + "), so the questions were rebuilt rather than updated.");`,
    `      Logger.log("Columns already in the responses sheet keep their answers, but the rebuilt");`,
    `      Logger.log("questions start new, empty columns with the same headings. If this form has");`,
    `      Logger.log("responses you have not ingested yet, export the sheet before trusting it.");`,
    `    }`,
    `    for (let i = existing.length - 1; i >= 0; i--) form.deleteItem(existing[i]);`,
    `    for (let i = 0; i < QUESTIONS.length; i++) configure(newItem(form, QUESTIONS[i].kind), QUESTIONS[i]);`,
    `  }`,
    ``,
    `  // Responses go to their own spreadsheet; ingest reads a CSV export of it.`,
    `  //`,
    `  // getDestinationId() THROWS when nothing is linked yet — it does not return null — so it`,
    `  // cannot be used as a condition. Probing it any other way is the same bug in a new shape.`,
    `  let destination = null;`,
    `  try { destination = form.getDestinationId(); } catch (e) { destination = null; }`,
    `  if (!destination) {`,
    `    const sheet = SpreadsheetApp.create(TITLE + " — responses");`,
    `    form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());`,
    `    destination = sheet.getId();`,
    `    Logger.log("Responses sheet created: " + sheet.getUrl());`,
    `  } else {`,
    `    Logger.log("Responses sheet: " +`,
    `      SpreadsheetApp.openById(destination).getUrl());`,
    `  }`,
    `  Logger.log("");`,
    `  Logger.log("=== PASTE THIS INTO SLACK ===");`,
    `  Logger.log(form.getPublishedUrl());`,
    `  Logger.log("");`,
    `  Logger.log("Edit the form: " + form.getEditUrl());`,
    `}`,
    ``,
  );
  if (write("collector/forms/expert-intake.gs", lines.join("\n"))) changed++;

  // A responses sheet's column headings are the question titles, never the field ids. This map is
  // what turns a heading back into a field id. The filename carries the questionnaire version and
  // old versions are KEPT, so a response collected against an earlier form still maps.
  //
  // `industry_options` is the label -> taxonomy token mapping AS THIS FORM ASKED IT, which is why
  // ingest reads it here instead of re-deriving it from today's taxonomy: renaming an industry's
  // label must not orphan the answers filed under the old one.
  const map = {
    map_version: 4,
    source: "expert-intake.gs",
    questionnaire: q.id,
    questionnaire_version: q.version,
    industry_field: industryField ? industryField.id : null,
    industry_options: Object.fromEntries(Object.entries(catalog.industries).map(([id, m]) => [m.label, id])),
    fields: fields.map((f) => ({
      label: f.label, id: f.id, type: f.type, multiple: f.multiple,
      required: f.required, options: f.options, max_length: f.max_length,
    })),
  };
  if (write(`collector/forms/form-map-v${q.version}.json`, JSON.stringify(map, null, 2) + "\n")) changed++;

  // The per-industry forms this replaced would still be pasteable, and pasting one would start a
  // second form collecting into a second sheet. Generated directory, so it is ours to prune.
  const dir = path.join(ROOT, "collector/forms");
  for (const f of fs.readdirSync(dir)) {
    const stale = (f.endsWith(".gs") && f !== "expert-intake.gs") ||
      (f.startsWith("form-map-") && !/^form-map-v\d+\.json$/.test(f));
    if (!stale) continue;
    fs.unlinkSync(path.join(dir, f));
    say(`collect:render: removed stale collector/forms/${f}`);
    changed++;
  }

  say(`collect:render: ${changed} file(s) changed · ${fields.length} question(s), ` +
      `${Object.keys(catalog.industries).length} industr(ies) in the dropdown`);
  say("");
  say("One form for all of them: paste collector/forms/expert-intake.gs into script.google.com,");
  say("Run > setup, and copy the published URL from the execution log.");
  return 0;
}

// ---- collect:invite -------------------------------------------------------------------------
// The Slack message to paste. The form URL is not derivable — Google mints it when the Apps
// Script runs — so it is an argument, not something this can compute.
//
// One form means ONE URL for every channel. `--industry` is optional and changes only the
// wording: "Grocery experts" reads better in #grocery than a generic call, and the form's first
// question then merely confirms what the channel already implied.

function collectInvite(flags) {
  const catalog = loadCatalog(ROOT);
  const url = flags.url;
  if (!url) {
    warn("collect:invite needs --url <the published form URL from the Apps Script log>");
    return 2;
  }
  const id = flags.industry ?? null;
  if (id && !catalog.industries[id]) {
    warn(`unknown industry '${id}' — use one of <${Object.keys(catalog.industries).join("|")}>, ` +
         `or omit it for the all-industries post`);
    return 2;
  }
  const label = id ? catalog.industries[id].label : null;
  const heading = label ?? "Every industry — one link";
  out("");
  out(`── ${heading} ${"─".repeat(Math.max(0, 58 - heading.length))}`);
  out("");
  out("Channel post:");
  if (label) {
    out(`  :thought_balloon: *${label} experts* — about three minutes of your time.`);
    out(`  What would you add to a bare storefront to make it work for ${label}?`);
    out(`  Pick *${label}* in the first question, then three boxes, no wrong answers. Answers`);
    out(`  become reviewed spec drafts that every ${label} build then starts from. Please don't`);
    out(`  name a customer you're under NDA with.`);
  } else {
    const list = Object.values(catalog.industries).map((i) => i.label).join(", ");
    out(`  :thought_balloon: *Industry experts* — about three minutes of your time.`);
    out(`  Pick your industry, then tell us what a bare storefront is missing for it. Three boxes,`);
    out(`  no wrong answers. Answers become reviewed spec drafts that every build for that industry`);
    out(`  then starts from. Please don't name a customer you're under NDA with.`);
    out(`  On the list today: ${list}.`);
  }
  out(`  ${url}`);
  out("");
  out("Direct message:");
  if (label) {
    out(`  Hi — you know ${label} better than the specs we ship for it do. Three boxes, three`);
    out(`  minutes, and it shapes what every ${label} build starts from: ${url}`);
  } else {
    out(`  Hi — you know your industry better than the specs we ship for it do. Three boxes,`);
    out(`  three minutes, and it shapes what every build in it starts from: ${url}`);
  }
  out("");
  out("Reminder, one week later (Slack's own /remind, no app needed):");
  out(`  /remind me to nudge the ${label ?? "collector"} non-responders in 7 days`);
  out("");
  out("The same URL goes in every channel — the form asks which industry.");
  if (!label) out(`Tailor the wording per channel with --industry <${Object.keys(catalog.industries).join("|")}>.`);
  out("");
  return 0;
}

// ---- collect:ingest -------------------------------------------------------------------------
// Read a CSV export of the responses sheet and write one pseudonymized YAML file per response.
//
// One sheet holds every industry, so the industry is read from each ROW — the answer to the form's
// first question — and not passed in. A row that names an industry we have no taxonomy token for
// is filed as `unlisted` rather than guessed at: that answer is the strongest evidence there is
// about which vertical to create next, and rounding it to the nearest existing industry destroys
// exactly the information it carries.
//
// `inbox/` is gitignored in this repository on purpose: this repo is public, and the answers are
// not. The files exist locally for triage; what gets committed is the reviewed capability, never
// the raw response.

function collectIngest(flags) {
  const csvPath = flags.csv;
  if (!csvPath) {
    warn("collect:ingest needs --csv <export of the responses sheet>");
    warn("  In Sheets: File > Download > Comma-separated values.");
    return 2;
  }
  if (!fs.existsSync(csvPath)) { warn(`no such file: ${csvPath}`); return 2; }
  const catalog = loadCatalog(ROOT);
  // Optional, and a filter rather than a declaration: the sheet mixes industries, so this only
  // narrows what gets written. Omit it to ingest the whole export.
  const only = flags.industry ?? null;
  if (only && !catalog.industries[only]) {
    warn(`unknown industry '${only}' — use one of <${Object.keys(catalog.industries).join("|")}>, ` +
         `or omit it to ingest every industry in the export`);
    return 2;
  }
  const key = process.env[KEY_ENV];
  if (!key) {
    warn(`${KEY_ENV} is not set. Generate one once, store it in the team vault, and export it:`);
    warn(`  export ${KEY_ENV}='${generateKey()}'`);
    return 2;
  }
  const round = flags.round || new Date().toISOString().slice(0, 7);
  const epoch = Number(flags.epoch ?? 1);

  // Newest map first; the first version that maps cleanly is the one the response was filed
  // against. Keeps older rounds parseable after the questionnaire is revised.
  const maps = fs.readdirSync(path.join(ROOT, "collector/forms"))
    .filter((f) => /^form-map-v\d+\.json$/.test(f))
    .sort((a, b) => Number(b.match(/v(\d+)/)[1]) - Number(a.match(/v(\d+)/)[1]))
    .map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, "collector/forms", f), "utf8")));
  if (!maps.length) { warn("no form map — run `ctsx collect:render` first"); return 1; }

  const { headers, rows } = parseCsvObjects(fs.readFileSync(csvPath, "utf8"));

  // Two columns under the same heading is not a curiosity, it is silent data loss: a row is keyed
  // by heading, so the later column wins, and the later one is the empty column a rebuilt form
  // question leaves behind. Refuse rather than ingest blanks over real answers.
  const dupes = [...new Set(headers.filter((h, i) => h !== "" && headers.indexOf(h) !== i))];
  if (dupes.length) {
    warn(`the export has ${dupes.length} duplicated column heading(s), so one copy of each would`);
    warn("silently win and the other's answers would be lost. Usually this means a form question");
    warn("was rebuilt: the old column keeps the answers, the new one is empty.");
    for (const d of dupes) warn(`  ${d}`);
    warn("In the responses sheet, delete the EMPTY duplicate of each and export again.");
    return 2;
  }
  if (!rows.length) { out("collect:ingest: the export has no responses"); return 0; }

  const rawDir = path.join(ROOT, "inbox/raw", round);
  const badDir = path.join(rawDir, "_needs-a-human");
  fs.mkdirSync(rawDir, { recursive: true });

  // Idempotent on (respondent, submitted_at): re-exporting the same sheet must not duplicate.
  const already = new Set();
  for (const dir of [rawDir, badDir]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) if (f.endsWith(".yaml")) already.add(f);
  }

  let written = 0, quarantined = 0, skipped = 0, anonymous = 0, unlisted = 0, filtered = 0;
  const seen = [];

  for (const row of rows) {
    // Identity is used to derive a handle and is then discarded. It never reaches a file.
    const identity = row["Email Address"] || row["Email address"] || null;
    const handle = identity
      ? pseudonym(identity.trim().toLowerCase(), { key, epoch })
      : `p${epoch}-anon${String(++anonymous).padStart(3, "0")}`;

    let best = null;
    for (const map of maps) {
      const mapped = mapResponse(row, map);
      if (mapped.report.ok) { best = { map, ...mapped }; break; }
      const score = mapped.report.unmatched_expected_labels.length + mapped.report.unrecognised_columns.length;
      if (!best || score < best.score) best = { map, ...mapped, score };
    }

    // The industry as this form asked it. `industry_options` is recorded per map version, so
    // relabelling an industry later cannot orphan the rows already filed under the old label.
    const answered = best.map.industry_field ? best.answers[best.map.industry_field] : null;
    const industry = (answered && best.map.industry_options?.[answered]) || null;
    // Counted after the filter, not before: with --industry set, an unlisted response is one of
    // the rows being skipped, and reporting it as filed would be a lie.
    if (only && industry !== only) { filtered++; continue; }
    if (!industry) unlisted++;
    if (identity) seen.push({ id: identity.trim().toLowerCase(), handle });

    const submitted = (row.Timestamp || row.timestamp || "").trim();
    const stamp = submitted.replace(/[^\dT:-]/g, "T").replace(/:/g, "-") || `row${written + quarantined + 1}`;
    // The industry is in the filename because one directory now mixes them all, and triage is
    // per industry: `ls inbox/raw/<round>/*grocery*` has to be the whole selection step.
    const filename = `${stamp}-${industry ?? "unlisted"}-${handle}.yaml`;
    if (already.has(filename)) { skipped++; continue; }

    const record = {
      schema: "commercetools.spec-templates.collector-response/v1",
      schema_version: 1,
      round,
      industry,
      // What they actually picked, kept verbatim. For an `unlisted` answer this is the only place
      // the intent survives, and for a mapped one it is the audit trail for how it was mapped.
      industry_answer: answered ?? null,
      respondent: handle,
      // No name, no email. The handle is derived from the key; there is no map file to leak.
      submitted_at: submitted || null,
      form: { map_version: best.map.map_version, questionnaire_version: best.map.questionnaire_version },
      answers: best.answers,
      mapping: best.report,
    };
    const dest = best.report.ok ? rawDir : badDir;
    if (!best.report.ok) { fs.mkdirSync(badDir, { recursive: true }); quarantined++; } else written++;
    fs.writeFileSync(path.join(dest, filename), YAML.stringify(record));
  }

  const clashes = collisions(seen);
  out(`collect:ingest: ${written} written, ${quarantined} need a human, ${skipped} already ingested`);
  out(`  into ${path.relative(process.cwd(), rawDir)}  (gitignored — this repo is public)`);
  if (filtered) out(`  ${filtered} skipped by --industry ${only}`);
  if (anonymous) out(`  ${anonymous} response(s) had no email; handled as anonymous`);
  if (unlisted) {
    out(`  ${unlisted} response(s) named an industry we have no token for, filed as 'unlisted'.`);
    out(`  Those are the case for the next vertical — read them before adding to taxonomy/industries.yaml.`);
  }
  if (quarantined) warn(`  ${quarantined} in _needs-a-human/ — nothing was dropped, read the \`mapping\` block`);
  if (clashes.length) {
    warn(`  two respondents share a handle (${clashes.join(", ")}) — their answers would merge.`);
    warn(`  Re-ingest with --epoch ${epoch + 1}.`);
    return 1;
  }
  return quarantined ? 1 : 0;
}

const USAGE = `ctsx — authoring tooling for commercetools-spec-templates

  ctsx build              regenerate registry.json, dist/, rendered/, collector/forms/
  ctsx lint [--strict]    validate sources; --strict also enforces rights clearance
  ctsx coverage           print the industry x business-model matrix
  ctsx collect:render     regenerate the collector Apps Script and its form map
  ctsx collect:invite     print the Slack message (--url <published form URL> [--industry <i>])
  ctsx collect:ingest     read a responses CSV into inbox/ (--csv <file> [--industry <i>] [--round <r>])

Exit: 0 ok · 1 lint errors · 2 bad args · 3 golden drift`;

const argv = process.argv.slice(2);
const cmd = argv[0];
const flags = { strict: argv.includes("--strict") };
for (const name of ["csv", "url", "industry", "vertical", "round", "epoch"]) {
  const i = argv.indexOf(`--${name}`);
  if (i >= 0) flags[name] = argv[i + 1];
}
if (!cmd || ["-h", "--help"].includes(cmd)) { out(USAGE); process.exit(cmd ? 0 : 2); }
if (cmd === "build") process.exit(build());
else if (cmd === "lint") process.exit(lint(flags));
else if (cmd === "coverage") process.exit(coverage());
else if (cmd === "collect:render") process.exit(collectRender());
else if (cmd === "collect:invite") process.exit(collectInvite(flags));
else if (cmd === "collect:ingest") process.exit(collectIngest(flags));
else { warn(`unknown command '${cmd}'`); out(USAGE); process.exit(2); }
