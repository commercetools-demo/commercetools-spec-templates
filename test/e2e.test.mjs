/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const CTS = path.join(ROOT, "bin", "cts.mjs");

/** The manifest for a rendered bundle — tests derive expected counts from it rather than
 *  hardcoding a number that every content change would invalidate. */
function manifest(industry = "_base", model = "B2C", bundle = "openspec-specs") {
  return JSON.parse(fs.readFileSync(
    path.join(ROOT, "rendered", industry, model.toLowerCase(), bundle, "manifest.json"), "utf8"));
}

/** A throwaway copy of a real `openspec init` output. */
function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cts-e2e-"));
  fs.cpSync(path.join(ROOT, "fixtures", "openspec-init"), dir, { recursive: true });
  return dir;
}

// --no-overlay everywhere: the overlay is a separate package and CI must stay offline.
function cts(args, { cwd, expect = 0 } = {}) {
  try {
    const stdout = execFileSync(process.execPath, [CTS, ...args], { encoding: "utf8", cwd: ROOT });
    assert.equal(expect, 0, `expected exit ${expect}, got 0`);
    return stdout;
  } catch (e) {
    assert.equal(e.status, expect, `expected exit ${expect}, got ${e.status}: ${e.stderr}`);
    return (e.stdout ?? "") + (e.stderr ?? "");
  }
}

test("detect reports an incomplete framework rather than writing into it", () => {
  const dir = project();
  fs.rmSync(path.join(dir, "openspec", "config.yaml"));
  const outp = cts(["detect", "--cwd", dir], { expect: 4 });
  assert.match(outp, /INCOMPLETE/);
  assert.match(outp, /missing: openspec\/config\.yaml/);
});

test("detect exits 4 with the initializer command when no framework is present", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cts-bare-"));
  const outp = cts(["detect", "--cwd", dir], { expect: 4 });
  assert.match(outp, /No spec-driven framework found/);
  assert.match(outp, /openspec@latest init/);
  assert.match(outp, /specify init/);
});

test("apply writes the rendered bundle and a receipt, and is idempotent", () => {
  const dir = project();
  cts(["apply", "--cwd", dir, "--industry", "grocery", "--model", "B2C", "--no-overlay"]);
  const spec = path.join(dir, "openspec/specs/out-of-stock-substitutions/spec.md");
  assert.ok(fs.existsSync(spec));
  // The bytes on disk are the bytes committed in rendered/ — no runtime templating.
  const golden = path.join(ROOT, "rendered/grocery/b2c/openspec-specs/openspec/specs/out-of-stock-substitutions/spec.md");
  assert.equal(fs.readFileSync(spec, "utf8"), fs.readFileSync(golden, "utf8"));

  const receipt = JSON.parse(fs.readFileSync(path.join(dir, ".commercetools/spec-templates.lock.json"), "utf8"));
  assert.equal(receipt.files.length, manifest("grocery", "B2C").files.length);
  assert.equal(receipt.industry, "grocery");

  const second = cts(["plan", "--cwd", dir, "--industry", "grocery", "--model", "B2C"]);
  assert.match(second, /ours-same/);
  assert.ok(!/create /.test(second), "a second run must not want to create anything");
});

test("a file we wrote and the developer then edited is never silently overwritten", () => {
  const dir = project();
  cts(["apply", "--cwd", dir, "--industry", "grocery", "--model", "B2C", "--no-overlay"]);
  const spec = path.join(dir, "openspec/specs/weight-based-pricing/spec.md");
  fs.appendFileSync(spec, "\n<!-- my edit -->\n");

  const planned = cts(["plan", "--cwd", dir, "--industry", "grocery", "--model", "B2C"], { expect: 6 });
  assert.match(planned, /ours-edited/);

  const applied = cts(["apply", "--cwd", dir, "--industry", "grocery", "--model", "B2C", "--no-overlay"], { expect: 6 });
  assert.match(applied, /Refusing to overwrite/);
  assert.match(fs.readFileSync(spec, "utf8"), /my edit/, "the edit must survive");

  cts(["apply", "--cwd", dir, "--industry", "grocery", "--model", "B2C", "--no-overlay", "--force"]);
  assert.ok(!/my edit/.test(fs.readFileSync(spec, "utf8")), "--force must overwrite");
});

test("a foreign file at one of our paths blocks, and stays untouched", () => {
  const dir = project();
  const spec = path.join(dir, "openspec/specs/weight-based-pricing/spec.md");
  fs.mkdirSync(path.dirname(spec), { recursive: true });
  fs.writeFileSync(spec, "# hand written\n");
  const outp = cts(["apply", "--cwd", dir, "--industry", "grocery", "--model", "B2C", "--no-overlay"], { expect: 6 });
  assert.match(outp, /foreign/);
  assert.equal(fs.readFileSync(spec, "utf8"), "# hand written\n");
});

test("remove takes back only what we wrote and left untouched", () => {
  const dir = project();
  cts(["apply", "--cwd", dir, "--industry", "grocery", "--model", "B2C", "--no-overlay"]);
  const edited = path.join(dir, "openspec/specs/delivery-slot-booking/spec.md");
  fs.appendFileSync(edited, "\nmine\n");
  const outp = cts(["remove", "--cwd", dir]);
  // Everything we wrote, minus the one the developer edited.
  const expected = manifest("grocery", "B2C").files.length - 1;
  assert.match(outp, new RegExp(`Removed ${expected} file\\(s\\)`));
  assert.ok(fs.existsSync(edited), "an edited file must be kept");
  assert.ok(!fs.existsSync(path.join(dir, "openspec/specs/weight-based-pricing/spec.md")));
});

test("an unsupported combination refuses and writes nothing", () => {
  const dir = project();
  const outp = cts(["apply", "--cwd", dir, "--industry", "grocery", "--model", "B2B2B", "--no-overlay"], { expect: 5 });
  assert.match(outp, /does not support B2B2B/);
  assert.match(outp, /Nothing has been written/);
  assert.ok(!fs.existsSync(path.join(dir, ".commercetools")));
});

test("an industry with no published content refuses and writes nothing", () => {
  const dir = project();
  const outp = cts(["apply", "--cwd", dir, "--industry", "telecom", "--model", "B2C", "--no-overlay"], { expect: 5 });
  assert.match(outp, /no published content yet/);
  assert.ok(!fs.existsSync(path.join(dir, ".commercetools")));
});

test("the Spec Kit renderer is declared but gated, and says so", () => {
  const dir = project();
  const outp = cts(["plan", "--cwd", dir, "--industry", "grocery", "--model", "B2C", "--framework", "speckit"], { expect: 7 });
  assert.match(outp, /not implemented/);
});

test("an approved plan is re-verified before it is applied", () => {
  const dir = project();
  const planFile = path.join(dir, "plan.json");
  fs.writeFileSync(planFile, cts(["plan", "--cwd", dir, "--industry", "grocery", "--model", "B2C", "--json"]));
  // The project moves on after the human approved the plan.
  const spec = path.join(dir, "openspec/specs/weight-based-pricing/spec.md");
  fs.mkdirSync(path.dirname(spec), { recursive: true });
  fs.writeFileSync(spec, "# appeared after the plan was approved\n");
  const outp = cts(["apply", "--cwd", dir, "--plan", planFile, "--no-overlay"], { expect: 6 });
  assert.match(outp, /no longer matches this project/);
});

test("cts init refuses to run without a terminal rather than hanging a CI job", () => {
  // The interactive command must never block a pipeline waiting on a prompt that cannot arrive.
  const outp = cts(["init", "--cwd", project()], { expect: 2 });
  assert.match(outp, /stdin is not a terminal/);
  assert.match(outp, /cts apply --industry/, "it must name the non-interactive alternative");
});

test("the question flow is data-driven end to end, and interpolates earlier answers", () => {
  const first = JSON.parse(cts(["questions", "--cwd", project()]));
  assert.equal(first.question.id, "framework_state");

  const model = JSON.parse(cts([
    "questions", "--cwd", project(),
    "--answers", JSON.stringify({ framework_state: "have", framework: "openspec" }),
  ]));
  assert.equal(model.question.id, "business_model");

  const industry = JSON.parse(cts([
    "questions", "--cwd", project(),
    "--answers", JSON.stringify({ framework_state: "have", framework: "openspec", business_model: "B2C" }),
  ]));
  assert.equal(industry.question.id, "industry");
  assert.match(industry.question.prompt, /this B2C storefront/, "the earlier answer is interpolated");
  // Options come from the registry, filtered to industries that support the chosen model.
  const values = industry.question.options.map((o) => o.value);
  assert.ok(values.includes("grocery"));
  assert.ok(!values.includes("telecom"), "an industry with no B2C content must not be offered");
  const maturity = JSON.parse(fs.readFileSync(path.join(ROOT, "registry.json"), "utf8"))
    .industries.grocery.maturity;
  assert.match(industry.question.options.find((o) => o.value === "grocery").label,
    new RegExp(`\\(${maturity}\\)`), "the badge must show whatever maturity the taxonomy says");

  // The note must quote the count for the MODEL CHOSEN, not a single per-industry number.
  const countFor = (model) => {
    const q = JSON.parse(cts(["questions", "--cwd", project(), "--answers",
      JSON.stringify({ framework_state: "have", framework: "openspec", business_model: model })]));
    return q.question.options.find((o) => o.value === "grocery").description;
  };
  const b2c = countFor("B2C");
  const b2b = countFor("B2B");
  assert.match(b2c, /^\d+ specs$/);
  assert.match(b2b, /^\d+ specs$/);
  assert.notEqual(b2c, b2b, "grocery has a different capability count for B2C and B2B");
  const expected = (m) => `${JSON.parse(fs.readFileSync(path.join(ROOT, "registry.json"), "utf8"))
    .combinations[`grocery|${m}`].capability_count} specs`;
  assert.equal(b2c, expected("B2C"));
  assert.equal(b2b, expected("B2B"));
});

test("the gap acknowledgement is asked only when the match is not exact", () => {
  const base = { framework_state: "have", framework: "openspec", business_model: "B2C", industry: "grocery" };

  // grocery x B2C is an exact match, so gap_ack must never appear. The scope question does,
  // because the bundle is larger than its ask_when threshold — the conditional working, not a bug.
  const exact = JSON.parse(cts(["questions", "--cwd", project(), "--answers", JSON.stringify(base)]));
  assert.equal(exact.done, false);
  assert.equal(exact.question.id, "scope", "an exact match asks about scope, never about gaps");
  // The scope options must quote the real counts for the chosen combination.
  const combo = JSON.parse(fs.readFileSync(path.join(ROOT, "registry.json"), "utf8"))
    .combinations["grocery|B2C"];
  assert.ok(exact.question.options.some((o) => o.label.includes(String(combo.capability_count))));
  assert.ok(exact.question.options.some((o) => o.label.includes(String(combo.p1_count))));

  const finished = JSON.parse(cts([
    "questions", "--cwd", project(), "--answers", JSON.stringify({ ...base, scope: "all" }),
  ]));
  assert.equal(finished.done, true);
  assert.equal(finished.outputs.industry, "grocery");
  assert.equal(finished.outputs.scope, "all");
  assert.equal(finished.outputs.as_change, false);

  // A derived match must raise gap_ack before anything else that would hide the gaps.
  const derived = JSON.parse(cts([
    "questions", "--cwd", project(),
    "--answers", JSON.stringify({ framework_state: "have", framework: "openspec", business_model: "B2B2C", industry: "grocery", scope: "all" }),
  ]));
  assert.equal(derived.done, false);
  assert.equal(derived.question.id, "gap_ack");
  // The real gaps must be named — in prose, not as raw ids (the vocabulary guard covers the ids).
  const gaps = JSON.parse(fs.readFileSync(path.join(ROOT, "registry.json"), "utf8"))
    .combinations["grocery|B2B2C"].gaps;
  assert.match(derived.question.prompt, new RegExp(`${gaps.length} things`), "the real count is quoted");
  for (const g of gaps) {
    assert.match(derived.question.prompt, new RegExp(g.replace(/-/g, " ")), `'${g}' must be named`);
  }
  assert.match(derived.question.prompt, /open questions rather than guess/, "it must promise not to invent");
});


// ---------------------------------------------------------------------------------------------
// A prompt is a product surface. This walks every question the flow can reach and asserts that
// no internal vocabulary escapes into it — the class of defect that produced "How much of the
// _base vertical should I bring in?" and "P1 only".
// ---------------------------------------------------------------------------------------------
test("no question ever shows a developer our internal vocabulary", () => {
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, "registry.json"), "utf8"));
  const gapIds = Object.values(registry.business_models).flatMap((m) => m.gap_capabilities ?? []);

  const forbidden = [
    [/_base/, "the internal id for the generic bundle"],
    [/\bP[123]\b/, "priority codes are ours, not a developer's"],
    [/\bderived\b|\bexact match\b/, "resolution jargon"],
    [/\bcapabilit(y|ies)\b/, "our word for a spec"],
    [/\{\{|\}\}/, "an unrendered interpolation"],
    [/\bundefined\b|\bnull\b|\bNaN\b/, "an unresolved value"],
    ...gapIds.map((g) => [new RegExp(g.replace(/-/g, "\\-")), `the raw gap id '${g}'`]),
  ];

  // Every state the flow can reach that produces a question, across both an exact and a
  // gap-bearing combination, and the generic bundle that used to leak its id.
  const states = [
    {},
    { framework_state: "have" },
    { framework_state: "instantiate" },
    { framework_state: "have", business_model: "B2C" },
    { framework_state: "have", business_model: "B2B" },
    { framework_state: "have", business_model: "B2B2C" },
    { framework_state: "have", business_model: "B2C", industry: "grocery" },
    { framework_state: "have", business_model: "B2B", industry: "grocery" },
    { framework_state: "have", business_model: "B2B", industry: "_base" },
    { framework_state: "have", business_model: "B2B2C", industry: "grocery" },
    { framework_state: "have", business_model: "B2B2C", industry: "grocery", scope: "all" },
    { framework_state: "have", business_model: "B2B2B", industry: "_base", scope: "mvp" },
  ];

  let checked = 0;
  for (const answers of states) {
    const r = JSON.parse(cts(["questions", "--cwd", project(), "--answers", JSON.stringify(answers)]));
    if (r.done) continue;
    const q = r.question;
    const surfaces = [
      ["prompt", q.prompt],
      ["hint", q.hint],
      ...q.options.flatMap((o, i) => [[`option[${i}].label`, o.label], [`option[${i}].description`, o.description]]),
    ].filter(([, v]) => typeof v === "string" && v.length);

    for (const [where, text] of surfaces) {
      checked++;
      for (const [pattern, why] of forbidden) {
        assert.ok(
          !pattern.test(text),
          `${q.id}.${where} leaks ${why}: ${JSON.stringify(text)}`,
        );
      }
    }
  }
  assert.ok(checked > 30, `expected to inspect the whole flow, only saw ${checked} strings`);
});
