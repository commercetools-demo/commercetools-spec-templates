#!/usr/bin/env node
// cts — the shipped engine. Zero runtime dependencies: it reads only generated JSON
// (registry.json, dist/questions/*.json, rendered/**/manifest.json) and markdown.
//
//   cts detect                     what framework is here, and is it complete
//   cts list                       what content exists
//   cts questions [--answers JSON] the next question to ask, or the resolved outputs
//   cts plan --industry .. --model ..     what would be written, and its hash
//   cts apply [--plan f | flags]   write it, atomically, and leave a receipt
//   cts status                     is what we wrote still what we wrote
//   cts remove                     take back exactly what we wrote, and nothing else
//   cts why --industry .. --model ..      why this combination resolves the way it does
//
// Exit: 0 ok · 2 bad args · 4 no framework · 5 unsupported combination · 6 blocked by conflicts
//       · 7 renderer not implemented

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { detect, FRAMEWORKS, highestFeatureNumber } from "../lib/detect.mjs";
import { nextQuestion, outputs, resolvePrefills } from "../lib/questions.mjs";
import { buildPlan, blockers } from "../lib/plan.mjs";
import { applyFiles } from "../lib/apply.mjs";
import { readReceipt, fileState, RECEIPT_PATH } from "../lib/receipt.mjs";
import { overlayHandoff, runOverlay } from "../lib/overlay.mjs";
import readline from "node:readline/promises";
import { execFileSync } from "node:child_process";

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const registry = readJson(path.join(PKG, "registry.json"));

const out = (m) => process.stdout.write(m + "\n");
const warn = (m) => process.stderr.write("! " + m + "\n");
const json = (o) => out(JSON.stringify(o, null, 2));

const USAGE = `cts — commercetools industry spec templates (content ${registry.content_version})

  cts init                                    ask the questions, then write the answer
  cts detect                                  report the framework in this project
  cts list [--industry <i>]                   what content is available
  cts questions [--answers '<json>']          drive the intake flow
  cts plan   --industry <i> --model <m> [...] preview what would be written
  cts apply  [--plan <file>] [...]            write it
  cts status | cts remove                     inspect or undo what we wrote
  cts why    --industry <i> --model <m>       explain a resolution

Options: --framework openspec|speckit · --placement specs|change · --scope all|mvp
         --cwd <dir> · --force · --dry-run · --json · --no-overlay`;

function parseArgs(argv) {
  const a = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "-h" || t === "--help") a.flags.help = true;
    else if (t === "--force") a.flags.force = true;
    else if (t === "--dry-run") a.flags.dryRun = true;
    else if (t === "--json") a.flags.json = true;
    else if (t === "--no-overlay") a.flags.noOverlay = true;
    else if (t.startsWith("--")) a.flags[t.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = argv[++i];
    else a._.push(t);
  }
  return a;
}

/** Resolve the bundle for a combination, or explain precisely why we cannot. */
function bundle({ industry, model, framework, placement }) {
  const combo = registry.combinations[`${industry}|${model}`];
  if (!combo) {
    const ind = registry.industries[industry];
    if (!ind) {
      const known = Object.keys(registry.industries).join(", ");
      throw exit(5, `No industry '${industry}'. Known industries: ${known}.`);
    }
    if (!ind.supported_models.length) {
      throw exit(5,
        `The ${ind.label} vertical has no published content yet (maturity: ${ind.maturity}).\n` +
        `Nothing has been written. Pick another industry, or author it — see docs/authoring.md.`);
    }
    throw exit(5,
      `${ind.label} does not support ${model}. Supported: ${ind.supported_models.join(", ")}.\n` +
      `Nothing has been written. This is a deliberate exclusion in vertical.yaml, not a gap.`);
  }
  if (!registry.compat[framework]?.implemented) {
    throw exit(7,
      `The ${registry.compat[framework]?.label ?? framework} renderer is not implemented in ` +
      `content ${registry.content_version} — OpenSpec only.\nNothing has been written.`);
  }
  const key = `${framework}:${placement}`;
  const meta = combo.rendered[key];
  if (!meta) throw exit(2, `No rendered bundle for ${key}. Available: ${Object.keys(combo.rendered).join(", ")}.`);
  const manifest = readJson(path.join(PKG, meta.path, "manifest.json"));
  return { combo, manifest, base: path.join(PKG, meta.path) };
}

const exit = (code, message) => Object.assign(new Error(message), { exitCode: code });

const SCOPES = { all: () => true, mvp: (f) => f.priority === null || f.priority === "P1" };

const label = (kind, id) => registry[kind]?.[id]?.label ?? id;
const humanize = (ids) => (ids ?? []).map((g) => g.replace(/-/g, " ")).join(", ");

/** What is about to happen, in words. Labels, never ids; no resolution jargon. */
function describe(plan, combo) {
  const lines = [
    `${label("industries", plan.industry)} · ${label("business_models", plan.model)} · ` +
      `${registry.compat[plan.framework].label} → ${plan.placement === "change" ? "openspec/changes/" : plan.placement === "specs" ? "openspec/specs/" : "specs/"}`,
  ];
  const n = plan.entries.length;
  lines.push(
    combo.match === "exact"
      ? `${n} file(s), written for exactly this combination.`
      : `${n} file(s), using the closest set that applies.`,
  );
  if (combo.gaps?.length) {
    lines.push(`${combo.gaps.length} thing(s) not covered, written up as open questions: ${humanize(combo.gaps)}.`);
  }
  if (combo.skills?.length) lines.push(`Skills these specs call for: ${combo.skills.join(", ")}.`);
  return lines;
}

function filesFor({ manifest, base, scope }) {
  const keep = SCOPES[scope] ?? SCOPES.all;
  return manifest.files.filter(keep).map((f) => ({
    ...f,
    content: fs.readFileSync(path.join(base, f.path), "utf8"),
  }));
}

/** Spec Kit numbers features from disk, so a seeded dir is rebased onto max(NNN)+n at apply time. */
function rebase(files, framework, cwd) {
  if (framework !== "speckit") return files;
  const base = highestFeatureNumber(cwd);
  let n = 0;
  const seen = new Map();
  return files.map((f) => {
    const m = f.path.match(/^specs\/(\d{3,})-(.+)$/);
    if (!m) return f;
    if (!seen.has(m[1])) seen.set(m[1], String(base + ++n).padStart(3, "0"));
    return { ...f, path: `specs/${seen.get(m[1])}-${m[2]}` };
  });
}

// ---- commands ---------------------------------------------------------------

function cmdDetect(cwd, flags) {
  const d = detect(cwd);
  if (flags.json) return json(d), 0;
  if (!d.frameworks.length) {
    out("No spec-driven framework found here.");
    for (const [k, fw] of Object.entries(FRAMEWORKS)) out(`  ${fw.label.padEnd(18)} ${fw.init}`);
    return 4;
  }
  for (const f of d.frameworks) {
    out(`${f.label}${f.version ? ` ${f.version}` : ""} at ${f.detectDir}/  ${f.complete ? "complete" : "INCOMPLETE"}`);
    for (const m of f.missing) out(`  missing: ${m}`);
  }
  return d.frameworks.every((f) => f.complete) ? 0 : 4;
}

function cmdList(flags) {
  if (flags.json) return json({ industries: registry.industries, combinations: registry.combinations }), 0;
  for (const [id, ind] of Object.entries(registry.industries)) {
    if (flags.industry && flags.industry !== id) continue;
    out(`${id}  ${ind.label} (${ind.maturity})`);
    if (!ind.supported_models.length) { out("  no published content yet"); continue; }
    for (const m of ind.supported_models) {
      const c = registry.combinations[`${id}|${m}`];
      out(`  ${m.padEnd(6)} ${String(c.capability_count).padStart(2)} specs · ${c.match}` +
          (c.gaps.length ? ` · ${c.gaps.length} gap(s): ${c.gaps.join(", ")}` : ""));
    }
  }
  return 0;
}

const questionnaire = () => readJson(path.join(PKG, "dist/questions/developer-intake.json"));

/** Build the scope object the questionnaire evaluates against, from the answers so far. */
function buildState(cwd, answers, flags) {
  const d = detect(cwd);
  let resolved = {};
  if (answers.industry && answers.business_model) {
    const c = registry.combinations[`${answers.industry}|${answers.business_model}`];
    resolved = c
      ? { ...c, framework: answers.framework ?? d.framework }
      : { match: "none", capability_count: 0, p1_count: 0, gaps: [], framework: answers.framework ?? d.framework };
  }
  return { answers, detect: d, registry, resolved, flags: { advanced: flags.advanced === "true" } };
}

function cmdQuestions(cwd, flags) {
  const qn = questionnaire();
  const given = flags.answers ? JSON.parse(flags.answers) : {};
  // Report prefilled answers rather than folding them in silently, so the caller can show them.
  const auto = resolvePrefills(qn, buildState(cwd, given, flags));
  const answers = { ...given };
  for (const [id, a] of Object.entries(auto)) answers[id] = a.value;
  const state = buildState(cwd, answers, flags);
  const q = nextQuestion(qn, state);
  if (q) return json({ done: false, prefilled: auto, question: q }), 0;
  return json({ done: true, prefilled: auto, outputs: outputs(qn, state), resolved: state.resolved }), 0;
}

/**
 * The interactive flow: the same question data the agent surface consumes, rendered as numbered
 * choices. Refuses to run without a TTY so CI cannot hang waiting on a prompt.
 */
async function cmdInit(cwd, flags) {
  if (!process.stdin.isTTY) {
    throw exit(2,
      `cts init is interactive and stdin is not a terminal.\n` +
      `Use the flags instead: cts apply --industry <i> --model <m> [--framework openspec|speckit]`);
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answers = {};
  /** Ctrl+C or Ctrl+D during a prompt is a decision, not a crash. */
  const ask = async (q) => {
    try {
      return await rl.question(q);
    } catch {
      throw exit(0, "Stopped. Nothing has been written.");
    }
  };
  try {
    const announced = new Set();
    for (;;) {
      const state = buildState(cwd, answers, flags);
      for (const [id, a] of Object.entries(resolvePrefills(questionnaire(), state))) {
        answers[id] = a.value;
        if (!announced.has(id)) {
          announced.add(id);
          out(`\n  Using ${a.label} — ${a.reason}.`);
        }
      }
      const q = nextQuestion(questionnaire(), buildState(cwd, answers, flags));
      if (!q) break;

      out("");
      out(`  ${q.prompt.trim()}`);
      if (q.hint) out(`  ${q.hint.replace(/\s+/g, " ")}`);
      out("");
      const choices = [...q.options];
      if (q.allow_other) choices.push({ value: "__other__", label: q.other_label ?? "Something else" });
      choices.forEach((o, i) => {
        out(`    ${i + 1}) ${o.label.trim()}${o.description ? ` — ${o.description}` : ""}`);
      });
      out("");

      const def = choices.findIndex((o) => o.default) + 1 || 1;
      const raw = (await ask(`  [1-${choices.length}] (${def}): `)).trim();
      const pick = choices[(raw === "" ? def : Number(raw)) - 1];
      if (!pick) { warn(`  Not one of 1-${choices.length}. Try again.`); continue; }

      answers[q.id] = pick.value === "__other__" ? (q.on_other?.resolve_to ?? "") : pick.value;

      // "Instantiate it for me" needs the framework answered first, then the framework's own
      // initializer — we never hand-create .specify/ or openspec/ ourselves.
      if (q.id === "framework" && answers.framework_state === "instantiate") {
        const cmd = registry.compat[answers.framework]?.init;
        out("");
        out(`  ${registry.compat[answers.framework].label} is not initialized here. I would run:`);
        out(`    ${cmd}`);
        const go = (await ask("  Run it now? [Y/n]: ")).trim().toLowerCase();
        if (go === "n" || go === "no") throw exit(4, `Initialize it yourself, then re-run cts init.`);
        const [bin, ...rest] = cmd.split(" ");
        try {
          execFileSync(bin, rest, { cwd, stdio: "inherit" });
        } catch {
          throw exit(4, `The initializer failed. Nothing has been written by this tool.`);
        }
      }
    }

    const o = outputs(questionnaire(), buildState(cwd, answers, flags));
    if (answers.gap_ack === "abort") { out("\n  Stopped. Nothing has been written."); return 0; }

    const planFlags = {
      ...flags, industry: o.industry, model: o.business_model, framework: o.framework,
      scope: o.scope ?? "all",
      placement: o.as_change ? "change" : flags.placement,
    };
    const { plan, combo } = makePlan(cwd, planFlags);
    out("");
    for (const l of describe(plan, combo)) out(`  ${l}`);
    out("");
    const b = blockers(plan);
    if (b.length) {
      warn(`  ${b.length} path(s) are not ours to overwrite:`);
      for (const e of b) warn(`    ${e.action} ${e.path}`);
      warn(`  Move them aside, or re-run with --force. Nothing has been written.`);
      return 6;
    }
    const go = (await ask("  Write these? [Y/n]: ")).trim().toLowerCase();
    if (go === "n" || go === "no") { out("  Stopped. Nothing has been written."); return 0; }
    rl.close();
    return cmdApply(cwd, planFlags);
  } finally {
    rl.close();
  }
}

function resolveTarget(cwd, flags) {
  const d = detect(cwd);
  const framework = flags.framework ?? d.framework;
  if (!framework) {
    throw exit(4,
      d.frameworks.length
        ? `More than one framework is initialized here. Pass --framework ${d.frameworks.map((f) => f.name).join("|")}.`
        : `No spec-driven framework found here. Initialize one first:\n` +
          Object.values(FRAMEWORKS).map((f) => `  ${f.label}: ${f.init}`).join("\n"));
  }
  const target = d.frameworks.find((f) => f.name === framework);
  if (target && !target.complete) {
    throw exit(4,
      `${target.label} is only partially initialized — missing ${target.missing.join(", ")}.\n` +
      `Nothing has been written. Re-run its initializer, then try again:\n  ${FRAMEWORKS[framework].init}`);
  }
  return {
    framework,
    industry: flags.industry,
    model: flags.model,
    placement: flags.placement ?? (framework === "openspec" ? "specs" : "default"),
    scope: flags.scope ?? "all",
  };
}

function makePlan(cwd, flags) {
  const t = resolveTarget(cwd, flags);
  if (!t.industry || !t.model) throw exit(2, "--industry and --model are required.");
  const { manifest, base, combo } = bundle(t);
  const files = rebase(filesFor({ manifest, base, scope: t.scope }), t.framework, cwd);
  const plan = buildPlan({ cwd, ...t, files, contentVersion: registry.content_version });
  return { plan, files, combo, target: t };
}

function cmdPlan(cwd, flags) {
  const { plan, combo } = makePlan(cwd, flags);
  if (flags.json) return json(plan), 0;
  for (const l of describe(plan, combo)) out(l);
  out("");
  for (const e of plan.entries) out(`  ${e.action.padEnd(11)} ${e.path}`);
  out("");
  out(`plan_hash ${plan.plan_hash}`);
  const b = blockers(plan);
  if (b.length) {
    warn(`${b.length} path(s) would overwrite work that is not ours. Re-run with --force to overwrite, ` +
         `or move those files aside:`);
    for (const e of b) warn(`  ${e.action} ${e.path}`);
    return 6;
  }
  return 0;
}

function cmdApply(cwd, flags) {
  let plan, files, target;
  if (flags.plan) {
    const saved = readJson(flags.plan);
    const rebuilt = makePlan(cwd, {
      ...flags, industry: saved.industry, model: saved.model,
      framework: saved.framework, placement: saved.placement, scope: saved.scope,
    });
    if (rebuilt.plan.plan_hash !== saved.plan_hash) {
      warn(`The plan no longer matches this project (plan_hash differs). Nothing has been written.`);
      warn(`Re-run \`cts plan\` and review it again.`);
      return 6;
    }
    ({ plan, files, target } = rebuilt);
  } else {
    ({ plan, files, target } = makePlan(cwd, flags));
  }

  const b = blockers(plan);
  if (b.length && !flags.force) {
    warn(`Refusing to overwrite ${b.length} file(s) we did not write, or that you edited. ` +
         `Nothing has been written.`);
    for (const e of b) warn(`  ${e.action} ${e.path}`);
    warn(`Re-run with --force to overwrite them.`);
    return 6;
  }

  // The overlay runs BEFORE the content, so the [SKILL:] task grammar exists when specs land.
  let overlay = overlayHandoff(target.framework);
  if (!flags.noOverlay && !flags.dryRun) {
    const r = runOverlay(target.framework, cwd);
    overlay = { ...overlay, ran: r.ok, output: r.output.trim().split("\n").slice(-3).join("\n") };
  }

  const result = applyFiles({ cwd, files, plan, force: !!flags.force, dryRun: !!flags.dryRun });
  if (flags.json) return json({ plan, ...result, overlay }), 0;

  out(`${flags.dryRun ? "Would write" : "Wrote"} ${result.written.length} file(s) into ${cwd}`);
  for (const p of result.written) out(`  ${p}`);
  if (result.skipped.length) {
    out(`Skipped ${result.skipped.length} file(s) that were not ours:`);
    for (const p of result.skipped) out(`  ${p}`);
  }
  if (!flags.dryRun) out(`Receipt: ${RECEIPT_PATH}`);
  out("");
  if (overlay.ran === true) out(`Overlay applied: ${overlay.command}`);
  else if (overlay.ran === false) {
    warn(`Could not run the commercetools overlay automatically.`);
    warn(overlay.instruction);
  } else out(`Next: ${overlay.instruction}`);
  if (target.framework === "openspec") out(`Then verify: npx -y @fission-ai/openspec@latest validate --strict`);
  return 0;
}

function cmdStatus(cwd, flags) {
  const r = readReceipt(cwd);
  if (!r) { out(`No receipt at ${RECEIPT_PATH} — nothing was written here by this tool.`); return 0; }
  const states = r.files.map((f) => ({ ...f, state: fileState(cwd, f) }));
  if (flags.json) return json({ ...r, files: states }), 0;
  out(`${r.industry} x ${r.model} -> ${r.framework}/${r.placement}, content ${r.content_version}, applied ${r.applied_at}`);
  const current = registry.content_version === r.content_version;
  out(current ? `Content is current.` : `Content ${registry.content_version} is available (you have ${r.content_version}).`);
  for (const f of states) out(`  ${f.state.padEnd(10)} ${f.path}`);
  return 0;
}

function cmdRemove(cwd, flags) {
  const r = readReceipt(cwd);
  if (!r) { out(`No receipt at ${RECEIPT_PATH} — nothing to remove.`); return 0; }
  const removed = [], kept = [];
  for (const f of r.files) {
    const state = fileState(cwd, f);
    if (state === "unchanged") {
      if (!flags.dryRun) fs.rmSync(path.join(cwd, f.path), { force: true });
      removed.push(f.path);
    } else kept.push(`${state} ${f.path}`);
  }
  if (!flags.dryRun && !kept.length) fs.rmSync(path.join(cwd, RECEIPT_PATH), { force: true });
  out(`${flags.dryRun ? "Would remove" : "Removed"} ${removed.length} file(s).`);
  if (kept.length) {
    out(`Kept ${kept.length} file(s) you changed — remove them yourself if you mean to:`);
    for (const k of kept) out(`  ${k}`);
    out(`The receipt is kept so \`cts status\` still explains these.`);
  }
  out(`The commercetools overlay is separate: npx -y @commercetools/commercetools-ai-plugin-sdd remove`);
  return 0;
}

function cmdWhy(flags) {
  const key = `${flags.industry}|${flags.model}`;
  const c = registry.combinations[key];
  if (!c) { warn(`No combination ${key}. Try \`cts list\`.`); return 5; }
  if (flags.json) return json(c), 0;
  out(`${key}: ${c.match} match`);
  out(`  ${c.capability_count} capabilit(ies): ${c.native} native to ${flags.model}, ${c.derived} inherited`);
  out(`  ${c.p1_count} at P1 · ${c.open_questions} open question(s) carried into the specs`);
  out(c.gaps.length
    ? `  ${c.gaps.length} model gap(s) with no published content: ${c.gaps.join(", ")}\n` +
      `  These are rendered as open questions, never as invented content.`
    : `  no model gaps`);
  for (const e of c.epics) out(`  epic ${e.slug}: ${e.count} spec(s)`);
  return 0;
}

// ---- entry ------------------------------------------------------------------

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
if (args.flags.help || !cmd) { out(USAGE); process.exit(cmd ? 0 : 2); }
const cwd = path.resolve(args.flags.cwd || process.cwd());

const COMMANDS = {
  init: () => cmdInit(cwd, args.flags),
  detect: () => cmdDetect(cwd, args.flags),
  list: () => cmdList(args.flags),
  questions: () => cmdQuestions(cwd, args.flags),
  plan: () => cmdPlan(cwd, args.flags),
  apply: () => cmdApply(cwd, args.flags),
  status: () => cmdStatus(cwd, args.flags),
  remove: () => cmdRemove(cwd, args.flags),
  why: () => cmdWhy(args.flags),
};

if (!(cmd in COMMANDS)) { warn(`unknown command '${cmd}'`); out(USAGE); process.exit(2); }
try {
  process.exit(await COMMANDS[cmd]());
} catch (e) {
  // A clean stop reports on stdout; a failure reports on stderr.
  if (e.exitCode === 0) out(e.message);
  else warn(e.message);
  process.exit(e.exitCode ?? 1);
}
