/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { mapResponse, splitMultiSelect } from "../lib/response.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

// The parser's behaviour is tested against a fixture covering every field SHAPE, not against the
// live questionnaire. Deleting a question is a content decision; it must not silently remove
// coverage of a code path — which is exactly what happened when the only single-choice question
// went away and the option-validation branch stopped being exercised.
const FIXTURE = {
  map_version: 3,
  questionnaire_version: 1,
  fields: [
    { label: "How deep is your experience?", id: "depth", type: "single", multiple: false,
      required: true, options: ["Built it", "Sold it", "Advised on it"], max_length: null },
    { label: "Which models have you seen?", id: "models", type: "multi", multiple: true,
      required: true, options: ["B2C", "B2B", "B2B2C"], max_length: null },
    { label: "Feature 1: what would you add?", id: "feature_1", type: "long_text", multiple: false,
      required: true, options: null, max_length: 1500 },
    { label: "Feature 2: what would you add?", id: "feature_2", type: "long_text", multiple: false,
      required: false, options: null, max_length: 1500 },
    { label: "A competitor doing this well", id: "reference", type: "short_text", multiple: false,
      required: false, options: null, max_length: null },
    // An option whose own label contains the separator. This is not hypothetical — a live form in
    // the wild offers "Other (plase, specify in the Steps to Reproduce)".
    { label: "Where did you see it?", id: "where", type: "multi", multiple: true, required: false,
      options: ["In production", "Other (plase, specify below)"], max_length: null },
  ],
};

const row = (o) => ({ Timestamp: "2026-08-24 09:12:03", ...o });
const L = Object.fromEntries(FIXTURE.fields.map((f) => [f.id, f.label]));

test("a complete response maps to field ids", () => {
  const { answers, report } = mapResponse(row({
    [L.depth]: "Built it",
    [L.models]: "B2C, B2B2C",
    [L.feature_1]: "Catch-weight pricing with tolerance bands.",
    [L.feature_2]: "",
    [L.reference]: "",
    [L.where]: "",
  }), FIXTURE);

  assert.equal(answers.depth, "Built it");
  assert.deepEqual(answers.models, ["B2C", "B2B2C"]);
  assert.equal(answers.feature_2, null, "an empty cell is null, not an empty string");
  assert.equal(report.ok, true, JSON.stringify(report));
});

test("a multi-select option whose own label contains a comma survives", () => {
  const line = "In production, Other (plase, specify below)";
  assert.equal(line.split(", ").length, 3, "documenting why the naive split is wrong");
  const { answers, report } = mapResponse(row({ [L.where]: line }), FIXTURE);
  assert.deepEqual(answers.where, ["In production", "Other (plase, specify below)"]);
  assert.deepEqual(report.inexact_multiselect, []);
});

test("splitMultiSelect on its own", () => {
  const opts = ["macOS (Apple Silicon)", "Other (plase, specify below)"];
  assert.deepEqual(splitMultiSelect(opts.join(", "), opts), { values: opts, exact: true });
});

test("an unmatchable multi-select falls back and flags itself rather than guessing", () => {
  const { answers, report } = mapResponse(row({ [L.models]: "B2C, Invented" }), FIXTURE);
  assert.deepEqual(answers.models, ["B2C", "Invented"]);
  assert.deepEqual(report.inexact_multiselect, ["models"]);
  assert.equal(report.ok, false);
});

test("free prose with commas and newlines arrives intact", () => {
  const prose = "Substitutions, because fresh lines are picked hours later.\n\nAlso catch weight.";
  const { answers } = mapResponse(row({ [L.feature_1]: prose }), FIXTURE);
  assert.equal(answers.feature_1, prose);
});

test("a missing required field is reported, not silently null", () => {
  const { report } = mapResponse(row({ [L.depth]: "" }), FIXTURE);
  assert.ok(report.missing_required.includes("depth"));
  assert.equal(report.ok, false);
});

// This branch is keyed on the PRESENCE of an option list. Keying it on a type name once made it
// silently dead the moment the map recorded the questionnaire's own type instead of a platform's.
test("an option value not on the form is reported, for single and multi alike", () => {
  const single = mapResponse(row({ [L.depth]: "Wrote a blog post" }), FIXTURE).report;
  assert.deepEqual(single.unexpected_option_values, [{ field: "depth", values: ["Wrote a blog post"] }]);
  const multi = mapResponse(row({ [L.models]: "B2C, B2B" }), FIXTURE).report;
  assert.deepEqual(multi.unexpected_option_values, []);
});

test("a hand-edited sheet header is recovered by loose match", () => {
  const header = L.depth.toUpperCase() + " ";
  const { answers, report } = mapResponse(row({ [header]: "Sold it" }), FIXTURE);
  assert.equal(answers.depth, "Sold it");
  assert.ok(!report.unrecognised_columns.includes(header));
});

test("a column nobody expected is reported, so a live-form edit cannot vanish", () => {
  const { report } = mapResponse(row({ "What is your favourite colour?": "blue" }), FIXTURE);
  assert.deepEqual(report.unrecognised_columns, ["What is your favourite colour?"]);
  assert.equal(report.ok, false);
});

test("Google's own columns are expected and never reported", () => {
  const { report } = mapResponse(
    { Timestamp: "2026-08-24", "Email Address": "x@y.z", [L.depth]: "Built it" }, FIXTURE);
  assert.deepEqual(report.unrecognised_columns, []);
});

test("an over-length answer is flagged against the limit the form cannot enforce", () => {
  const { report } = mapResponse(row({ [L.feature_1]: "x".repeat(1600) }), FIXTURE);
  assert.deepEqual(report.over_length, [{ field: "feature_1", length: 1600, limit: 1500 }]);
});

test("every field in the map appears in the result, answered or not", () => {
  const { answers } = mapResponse(row({ [L.depth]: "Built it" }), FIXTURE);
  for (const f of FIXTURE.fields) assert.ok(f.id in answers, `${f.id} missing`);
});

// ---------------------------------------------------------------------------------------------
// One integration test against whatever the questionnaire currently is, so a real generated map
// is always exercised — without any test asserting which questions exist.
// ---------------------------------------------------------------------------------------------
test("the live generated map maps a well-formed response cleanly", () => {
  const newest = fs.readdirSync(path.join(ROOT, "collector/forms"))
    .filter((f) => /^form-map-v\d+\.json$/.test(f))
    .sort((a, b) => Number(b.match(/v(\d+)/)[1]) - Number(a.match(/v(\d+)/)[1]))[0];
  const live = JSON.parse(fs.readFileSync(path.join(ROOT, "collector/forms", newest), "utf8"));
  assert.ok(live.fields.length, "the questionnaire has no questions");

  const cells = {};
  for (const f of live.fields) {
    cells[f.label] = f.multiple ? f.options.slice(0, 2).join(", ")
      : f.options?.length ? f.options[0]
      : "A grounded, plausible answer.";
  }
  const { answers, report } = mapResponse(row(cells), live);
  assert.equal(report.ok, true, JSON.stringify(report, null, 2));
  for (const f of live.fields) assert.notEqual(answers[f.id], undefined, `${f.id} unmapped`);
});
