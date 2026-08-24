import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { mapResponse, splitMultiSelect } from "../lib/response.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const MAP = JSON.parse(fs.readFileSync(path.join(ROOT, "collector/forms/form-map-grocery-v1.json"), "utf8"));
const L = Object.fromEntries(MAP.fields.map((f) => [f.id, f.label]));

const row = (o) => ({ Timestamp: "2026-08-24 09:12:03", ...o });

test("a complete response maps to field ids", () => {
  const { answers, report } = mapResponse(row({
    [L.exposure]: "Built it",
    [L.business_models]: "B2C, B2B2C",
    [L.feature_1]: "Catch-weight pricing with tolerance bands.",
    [L.feature_2]: "",
    [L.feature_3]: "",
    [L.capability_areas]: "Pricing & promotions, Cart & basket",
    [L.reference]: "",
  }), MAP);

  assert.equal(answers.exposure, "Built it");
  assert.deepEqual(answers.business_models, ["B2C", "B2B2C"]);
  assert.equal(answers.feature_2, null, "an empty cell is null, not an empty string");
  assert.deepEqual(answers.capability_areas, ["Pricing & promotions", "Cart & basket"]);
  assert.equal(report.ok, true);
});

// Unchanged from the GitHub intake: a checkbox column joins with ", " and an option's own label
// may contain a comma. A live form in the wild offers "Other (plase, specify in the Steps…)".
test("a multi-select option whose own label contains a comma survives", () => {
  const options = ["macOS (Apple Silicon)", "Other (plase, specify below)"];
  const line = "macOS (Apple Silicon), Other (plase, specify below)";
  assert.deepEqual(line.split(", ").length, 3, "documenting why the naive split is wrong");
  const { values, exact } = splitMultiSelect(line, options);
  assert.deepEqual(values, options);
  assert.equal(exact, true);
});

test("an unmatchable multi-select falls back and flags itself rather than guessing", () => {
  const { answers, report } = mapResponse(row({ [L.business_models]: "B2C, Invented" }), MAP);
  assert.deepEqual(answers.business_models, ["B2C", "Invented"]);
  assert.deepEqual(report.inexact_multiselect, ["business_models"]);
  assert.equal(report.ok, false);
});

test("free prose with commas and newlines arrives intact", () => {
  const prose = "Substitutions, because fresh lines are picked hours later.\n\nAlso catch weight.";
  const { answers } = mapResponse(row({ [L.feature_1]: prose }), MAP);
  assert.equal(answers.feature_1, prose);
});

test("a missing required field is reported, not silently null", () => {
  const { report } = mapResponse(row({ [L.exposure]: "" }), MAP);
  assert.ok(report.missing_required.includes("exposure"));
  assert.equal(report.ok, false);
});

test("a hand-edited sheet header is recovered by loose match", () => {
  const { answers, report } = mapResponse(row({ [L.exposure.toUpperCase() + " "]: "Sold it" }), MAP);
  assert.equal(answers.exposure, "Sold it");
  assert.ok(!report.unrecognised_columns.includes(L.exposure.toUpperCase() + " "));
});

test("a column nobody expected is reported, so a live-form edit cannot vanish", () => {
  const { report } = mapResponse(row({ "What is your favourite colour?": "blue" }), MAP);
  assert.deepEqual(report.unrecognised_columns, ["What is your favourite colour?"]);
  assert.equal(report.ok, false);
});

test("Google's own columns are expected and never reported", () => {
  const { report } = mapResponse(
    { Timestamp: "2026-08-24", "Email Address": "x@y.z", [L.exposure]: "Built it" }, MAP);
  assert.deepEqual(report.unrecognised_columns, []);
});

test("an over-length answer is flagged against the limit the form cannot enforce", () => {
  const { report } = mapResponse(row({ [L.feature_1]: "x".repeat(1600) }), MAP);
  assert.deepEqual(report.over_length, [{ field: "feature_1", length: 1600, limit: 1500 }]);
});

test("an option value not on the form is reported", () => {
  const { report } = mapResponse(row({ [L.exposure]: "Wrote a blog post" }), MAP);
  assert.deepEqual(report.unexpected_option_values, [{ field: "exposure", values: ["Wrote a blog post"] }]);
});

test("every field in the map appears in the result, answered or not", () => {
  const { answers } = mapResponse(row({ [L.exposure]: "Built it" }), MAP);
  for (const f of MAP.fields) assert.ok(f.id in answers, `${f.id} missing`);
});
