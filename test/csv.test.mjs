/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, parseCsvObjects } from "../lib/csv.mjs";

test("plain rows", () => {
  assert.deepEqual(parseCsv("a,b,c\n1,2,3"), [["a", "b", "c"], ["1", "2", "3"]]);
});

// The whole reason this file exists.
test("a quoted field keeps its commas", () => {
  assert.deepEqual(
    parseCsv('a,b\n"catch-weight pricing, with tolerance bands",B2C'),
    [["a", "b"], ["catch-weight pricing, with tolerance bands", "B2C"]],
  );
});

test("a quoted field keeps its newlines, so a pasted list survives as one answer", () => {
  const csv = 'answer,model\n"one\ntwo\nthree",B2B';
  const rows = parseCsv(csv);
  assert.equal(rows.length, 2, "embedded newlines must not create extra records");
  assert.equal(rows[1][0], "one\ntwo\nthree");
});

test("a doubled quote is one literal quote", () => {
  assert.deepEqual(parseCsv('a\n"they said ""no"" twice"'), [["a"], ['they said "no" twice']]);
});

test("CRLF records, as Sheets exports them", () => {
  assert.deepEqual(parseCsv("a,b\r\n1,2\r\n"), [["a", "b"], ["1", "2"]]);
});

test("CRLF inside a quoted field is literal, not a record break", () => {
  const rows = parseCsv('a\r\n"line one\r\nline two"\r\n');
  assert.equal(rows.length, 2);
  assert.equal(rows[1][0], "line one\r\nline two");
});

test("a trailing newline does not invent an empty record", () => {
  assert.equal(parseCsv("a,b\n1,2\n").length, 2);
  assert.equal(parseCsv("a,b\n1,2").length, 2);
});

test("empty fields are preserved, including trailing ones", () => {
  assert.deepEqual(parseCsv("a,b,c\n1,,3"), [["a", "b", "c"], ["1", "", "3"]]);
  assert.deepEqual(parseCsv("a,b,c\n1,2,"), [["a", "b", "c"], ["1", "2", ""]]);
});

test("a Sheets BOM is stripped so the first header matches", () => {
  const { headers } = parseCsvObjects("﻿Timestamp,Answer\n2026-08-24,x");
  assert.equal(headers[0], "Timestamp", "a BOM would make the first header unmatchable");
});

test("objects are keyed by header, and blank padding lines are dropped", () => {
  const { rows } = parseCsvObjects('Timestamp,Answer\n2026-08-24,"x, y"\n\n,\n');
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], { Timestamp: "2026-08-24", Answer: "x, y" });
});

test("a short row does not throw, it yields empty strings", () => {
  const { rows } = parseCsvObjects("a,b,c\n1");
  assert.deepEqual(rows[0], { a: "1", b: "", c: "" });
});

test("a realistic Google Forms export round-trips", () => {
  const csv = [
    'Timestamp,Email Address,"How deep is your Grocery & q-commerce experience?","Which business models have you seen Grocery & q-commerce run as?","Feature 1: what would you add?"',
    '2026-08-24 09:12:03,expert@commercetools.com,Built it,"B2C, B2B2C","Catch-weight pricing.\nPicked to an approximate weight, so the charge is provisional."',
  ].join("\n");
  const { headers, rows } = parseCsvObjects(csv);
  assert.equal(headers.length, 5);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]["Which business models have you seen Grocery & q-commerce run as?"], "B2C, B2B2C");
  assert.match(rows[0]["Feature 1: what would you add?"], /provisional\.$/);
  assert.ok(rows[0]["Feature 1: what would you add?"].includes("\n"));
});
