/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate, interpolate, readPath } from "../lib/expr.mjs";

const S = {
  answers: { model: Object.assign(new String("B2C"), { value: "B2C", label: "B2C" }) },
  detect: { framework_count: 1, framework_label: "OpenSpec" },
  resolved: { capability_count: 3, p1_count: 3, gaps: ["a", "b"], match: "derived" },
  registry: { industries: { grocery: { label: "Grocery" } } },
  flags: {},
};

test("operators", () => {
  assert.equal(evaluate({ eq: ["answers.model", "B2C"] }, S), true);
  assert.equal(evaluate({ ne: ["resolved.match", "exact"] }, S), true);
  assert.equal(evaluate({ gt: ["resolved.capability_count", 2] }, S), true);
  assert.equal(evaluate({ lt: ["resolved.capability_count", 2] }, S), false);
  assert.equal(evaluate({ in: ["answers.model", ["B2B", "B2C"]] }, S), true);
  assert.equal(evaluate({ not: { eq: ["answers.model", "B2B"] } }, S), true);
  assert.equal(evaluate({ and: [{ eq: ["answers.model", "B2C"] }, { gt: ["resolved.p1_count", 1] }] }, S), true);
  assert.equal(evaluate({ or: [{ eq: ["answers.model", "B2B"] }, { eq: ["resolved.match", "derived"] }] }, S), true);
});

test("a missing condition means always ask", () => {
  assert.equal(evaluate(undefined, S), true);
  assert.equal(evaluate(null, S), true);
});

test("an unknown scope is a literal, not a silent undefined", () => {
  // 'B2C' is a literal; 'answers.model' is a path. Comparing them must still work.
  assert.equal(evaluate({ eq: ["B2C", "answers.model"] }, S), true);
  assert.equal(evaluate({ eq: ["nope.model", "B2C"] }, S), false);
});

test("the grammar is closed — anything outside it throws at build time", () => {
  assert.throws(() => evaluate({ regex: ["a", "b"] }, S), /unknown operator/);
  assert.throws(() => evaluate({ eq: ["a"] }, S), /exactly 2 operands/);
  assert.throws(() => evaluate({ eq: ["a", "b"], ne: ["c", "d"] }, S), /exactly one operator/);
  assert.throws(() => evaluate({ and: "x" }, S), /takes an array/);
  assert.throws(() => evaluate([1, 2], S), /bare array/);
});

test("interpolation, including the label of an earlier answer", () => {
  assert.equal(interpolate("for {{answers.model.label}}", S), "for B2C");
  assert.equal(interpolate("raw {{answers.model}}", S), "raw B2C");
  assert.equal(interpolate("{{len(resolved.gaps)}} gaps: {{join(resolved.gaps, ', ')}}", S), "2 gaps: a, b");
  assert.equal(interpolate("{{registry.industries.grocery.label}}", S), "Grocery");
});

test("an unresolved path renders empty and is reported, not left as {{...}}", () => {
  const misses = [];
  assert.equal(interpolate("x={{answers.nope}}", S, (p) => misses.push(p)), "x=");
  assert.deepEqual(misses, ["answers.nope"]);
});

test("readPath never throws on a partial miss", () => {
  assert.equal(readPath("a.b.c.d", S), undefined);
});
