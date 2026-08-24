#!/usr/bin/env node
// ctsx — authoring tooling. NEVER shipped to a developer; it is not in package.json "files".
//
//   ctsx build     YAML -> registry.json, dist/questions/*.json, rendered/**   (all committed)
//   ctsx lint      schema + referential integrity + golden drift               (exit 3 on drift)
//   ctsx coverage  what each (industry x model) combination actually resolves to

import fs from "node:fs";
import path from "node:path";
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

  // I: golden drift — rendered/ and registry.json must match what the sources produce now.
  let drift = 0;
  if (fs.existsSync(path.join(ROOT, "registry.json"))) {
    const before = fs.readFileSync(path.join(ROOT, "registry.json"), "utf8");
    const files = new Map();
    for (const dir of ["rendered"]) {
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
// One Google Form per industry, emitted as an Apps Script you paste into script.google.com and
// run once. Answers never touch this repository — it is public, and a colleague answering "what is
// missing from a bare storefront" under their own name in public would hedge, which is exactly the
// candour the questionnaire exists to collect.
//
// Build-time fan-out (one form per industry) is what removes the need for any branching engine:
// no form platform can interpolate an earlier answer into a later question's label, so industry
// becomes the choice of form and the later question's text is fully written in the emitted script.

const gsString = (v) => JSON.stringify(String(v ?? ""));

function collectRender() {
  const catalog = loadCatalog(ROOT);
  const q = YAML.parse(fs.readFileSync(path.join(ROOT, "collector/questions/expert-intake.yaml"), "utf8"));
  let changed = 0;
  const fill = (text, industry) =>
    String(text ?? "")
      .replaceAll("{{industry.label}}", industry.label)
      .replaceAll("{{industry.id}}", industry.id);

  for (const [id, meta] of Object.entries(catalog.industries)) {
    const industry = { id, ...meta };
    const fields = [];
    for (const question of q.questions) {
      const reps = question.repeat ?? 1;
      for (let n = 1; n <= reps; n++) {
        const label = fill(question.label, industry).replaceAll("{n}", String(n));
        const required = reps > 1 ? n <= (question.repeat_required ?? 0) : !!question.required;
        let options = question.options;
        if (question.options_from === "registry.business_models") options = Object.keys(catalog.business_models);
        if (question.options_from === "registry.domains") options = Object.values(catalog.domains).map((d) => d.label);
        fields.push({
          id: reps > 1 ? `${question.id}_${n}` : question.id,
          label,
          hint: fill(question.hint, industry) || null,
          type: question.type,
          multiple: question.type === "multi",
          required,
          options: options ?? null,
          max_length: question.max_length ?? null,
        });
      }
    }

    // The Apps Script. Idempotent by title: re-running finds the existing form rather than
    // creating a second one, because a duplicated form silently splits a round's responses.
    const lines = [
      `// GENERATED by \`ctsx collect:render\` from collector/questions/expert-intake.yaml v${q.version}`,
      `// — do not edit. Paste into script.google.com, then Run > setup.`,
      `//`,
      `// Creates (or reuses) the ${meta.label} intake form and its responses spreadsheet, and`,
      `// prints the URL to paste into Slack. Runs as you, under your own Workspace account:`,
      `// no Cloud project, no OAuth client, no admin approval.`,
      ``,
      `const TITLE = ${gsString(`commercetools spec collector — ${meta.label}`)};`,
      ``,
      `function setup() {`,
      `  const existing = DriveApp.getFilesByName(TITLE);`,
      `  const form = existing.hasNext()`,
      `    ? FormApp.openById(existing.next().getId())`,
      `    : FormApp.create(TITLE);`,
      `  form.setDescription(${gsString(
        `What would you add to a bare storefront to make it work for ${meta.label}? ` +
        `Three boxes, about three minutes. Your answers become reviewed spec drafts. ` +
        `Please do not name a customer you are under NDA with — describe the pattern instead.`)});`,
      `  form.setCollectEmail(true);          // Workspace only; drives who-has-answered, then discarded at ingest`,
      `  form.setLimitOneResponsePerUser(false);`,
      `  form.setProgressBar(true);`,
      ``,
      `  // Rebuild the items so the form always matches the questionnaire it was generated from.`,
      `  const items = form.getItems();`,
      `  for (let i = items.length - 1; i >= 0; i--) form.deleteItem(items[i]);`,
      ``,
    ];
    for (const f of fields) {
      const setters = [`.setTitle(${gsString(f.label)})`];
      if (f.hint) setters.push(`.setHelpText(${gsString(f.hint)})`);
      let ctor;
      if (f.multiple) { ctor = "addCheckboxItem"; setters.push(`.setChoiceValues(${JSON.stringify(f.options ?? [])})`); }
      else if (f.type === "single") { ctor = "addMultipleChoiceItem"; setters.push(`.setChoiceValues(${JSON.stringify(f.options ?? [])})`); }
      else if (f.type === "short_text") ctor = "addTextItem";
      else ctor = "addParagraphTextItem";
      setters.push(`.setRequired(${f.required})`);
      lines.push(`  form.${ctor}()${setters.join("")};`);
    }
    lines.push(
      ``,
      `  // Responses go to their own spreadsheet; ingest reads a CSV export of it.`,
      `  if (!form.getDestinationId()) {`,
      `    const sheet = SpreadsheetApp.create(TITLE + " — responses");`,
      `    form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());`,
      `    Logger.log("Responses sheet: " + sheet.getUrl());`,
      `  }`,
      `  Logger.log("Share this link: " + form.getPublishedUrl());`,
      `  Logger.log("Edit the form:   " + form.getEditUrl());`,
      `}`,
      ``,
    );
    if (write(`collector/forms/${id}.gs`, lines.join("\n"))) changed++;

    // A responses sheet's column headers are the question titles, never the field ids — and our
    // titles are industry-interpolated. This map is what turns a header back into a field id.
    // The filename carries the questionnaire version and old versions are KEPT, so a response
    // collected against an earlier form still maps.
    const map = {
      map_version: 3,
      source: `${id}.gs`,
      industry: id,
      questionnaire: q.id,
      questionnaire_version: q.version,
      fields: fields.map((f) => ({
        label: f.label, id: f.id, type: f.type, multiple: f.multiple,
        required: f.required, options: f.options, max_length: f.max_length,
      })),
    };
    if (write(`collector/forms/form-map-${id}-v${q.version}.json`,
              JSON.stringify(map, null, 2) + "\n")) changed++;
  }

  out(`collect:render: ${changed} file(s) written for ${Object.keys(catalog.industries).length} industr(ies)`);
  out("");
  out("Next, once per industry: open script.google.com, paste collector/forms/<industry>.gs,");
  out("Run > setup, and copy the published URL from the execution log.");
  return 0;
}

// ---- collect:invite -------------------------------------------------------------------------
// The Slack message to paste. The form URL is not derivable — Google mints it when the Apps
// Script runs — so it is an argument, not something this can compute.

function collectInvite(flags) {
  const catalog = loadCatalog(ROOT);
  const id = flags.industry;
  const url = flags.url;
  if (!id || !catalog.industries[id]) {
    warn(`collect:invite needs --industry <${Object.keys(catalog.industries).join("|")}>`); return 2;
  }
  if (!url) {
    warn("collect:invite needs --url <the published form URL from the Apps Script log>");
    return 2;
  }
  const label = catalog.industries[id].label;
  out("");
  out(`── ${label} ${"─".repeat(Math.max(0, 58 - label.length))}`);
  out("");
  out("Channel post:");
  out(`  :thought_balloon: *${label} experts* — about three minutes of your time.`);
  out(`  What would you add to a bare storefront to make it work for ${label}?`);
  out(`  Three boxes, no wrong answers. Answers become reviewed spec drafts that every`);
  out(`  ${label} build then starts from. Please don't name a customer you're under NDA with.`);
  out(`  ${url}`);
  out("");
  out("Direct message:");
  out(`  Hi — you know ${label} better than the specs we ship for it do. Three boxes,`);
  out(`  three minutes, and it shapes what every ${label} build starts from: ${url}`);
  out("");
  out("Reminder, one week later (Slack's own /remind, no app needed):");
  out(`  /remind me to nudge the ${label} non-responders in 7 days`);
  out("");
  return 0;
}

// ---- collect:ingest -------------------------------------------------------------------------
// Read a CSV export of the responses sheet and write one pseudonymized YAML file per response.
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
  const industry = flags.industry;
  const catalog = loadCatalog(ROOT);
  if (!industry || !catalog.industries[industry]) {
    warn(`collect:ingest needs --industry <${Object.keys(catalog.industries).join("|")}> — one form, one sheet`);
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
    .filter((f) => new RegExp(`^form-map-${industry}-v\\d+\\.json$`).test(f))
    .sort((a, b) => Number(b.match(/v(\d+)/)[1]) - Number(a.match(/v(\d+)/)[1]))
    .map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, "collector/forms", f), "utf8")));
  if (!maps.length) { warn(`no form map for '${industry}' — run \`ctsx collect:render\` first`); return 1; }

  const { rows } = parseCsvObjects(fs.readFileSync(csvPath, "utf8"));
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

  let written = 0, quarantined = 0, skipped = 0, anonymous = 0;
  const seen = [];

  for (const row of rows) {
    // Identity is used to derive a handle and is then discarded. It never reaches a file.
    const identity = row["Email Address"] || row["Email address"] || null;
    const handle = identity
      ? pseudonym(identity.trim().toLowerCase(), { key, epoch })
      : `p${epoch}-anon${String(++anonymous).padStart(3, "0")}`;
    if (identity) seen.push({ id: identity.trim().toLowerCase(), handle });

    const submitted = (row.Timestamp || row.timestamp || "").trim();
    const stamp = submitted.replace(/[^\dT:-]/g, "T").replace(/:/g, "-") || `row${written + quarantined + 1}`;
    const filename = `${stamp}-${handle}.yaml`;
    if (already.has(filename)) { skipped++; continue; }

    let best = null;
    for (const map of maps) {
      const mapped = mapResponse(row, map);
      if (mapped.report.ok) { best = { map, ...mapped }; break; }
      const score = mapped.report.unmatched_expected_labels.length + mapped.report.unrecognised_columns.length;
      if (!best || score < best.score) best = { map, ...mapped, score };
    }

    const record = {
      schema: "commercetools.spec-templates.collector-response/v1",
      schema_version: 1,
      round,
      industry,
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
  if (anonymous) out(`  ${anonymous} response(s) had no email; handled as anonymous`);
  if (quarantined) warn(`  ${quarantined} in _needs-a-human/ — nothing was dropped, read the \`mapping\` block`);
  if (clashes.length) {
    warn(`  two respondents share a handle (${clashes.join(", ")}) — their answers would merge.`);
    warn(`  Re-ingest with --epoch ${epoch + 1}.`);
    return 1;
  }
  return quarantined ? 1 : 0;
}

const USAGE = `ctsx — authoring tooling for commercetools-spec-templates

  ctsx build              regenerate registry.json, dist/, rendered/
  ctsx lint [--strict]    validate sources; --strict also enforces rights clearance
  ctsx coverage           print the industry x business-model matrix
  ctsx collect:render     regenerate the per-industry Apps Script forms and their maps
  ctsx collect:invite     print the Slack message (--industry <i> --url <published form URL>)
  ctsx collect:ingest     read a responses CSV into inbox/ (--csv <file> --industry <i> [--round <r>])

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
