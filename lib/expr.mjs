/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Closed expression language for question `ask_when` and `{{...}}` interpolation.
//
// There is no eval, no arithmetic, no member calls, no user-supplied code path. Operators are
// a fixed set; operands are either a dotted path rooted in a known scope, or a literal. Anything
// outside the grammar throws at build time, so a malformed question file fails `ctsx build`
// rather than surprising a developer at prompt time.

const SCOPES = new Set(["answers", "detect", "registry", "resolved", "flags", "option", "cwd"]);

const OPS = {
  and: (args, s) => args.every((a) => truth(evaluate(a, s))),
  or: (args, s) => args.some((a) => truth(evaluate(a, s))),
  not: (arg, s) => !truth(evaluate(arg, s)),
  eq: ([a, b], s) => norm(resolve(a, s)) === norm(resolve(b, s)),
  ne: ([a, b], s) => norm(resolve(a, s)) !== norm(resolve(b, s)),
  in: ([a, b], s) => {
    const list = resolve(b, s);
    return Array.isArray(list) && list.map(norm).includes(norm(resolve(a, s)));
  },
  gt: ([a, b], s) => Number(resolve(a, s)) > Number(resolve(b, s)),
  lt: ([a, b], s) => Number(resolve(a, s)) < Number(resolve(b, s)),
};

const truth = (v) => v === true || v === "true";
// A String wrapper carries `.value`/`.label` for interpolation; compare on its primitive.
const norm = (v) => {
  if (v === null || v === undefined) return null;
  if (v instanceof String) return String(v);
  return typeof v === "object" ? JSON.stringify(v) : v;
};

/** Read a dotted path out of the scopes. Returns undefined for a miss, never throws. */
export function readPath(path, scopes) {
  const parts = String(path).split(".");
  let cur = scopes;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[p];
  }
  return cur;
}

/** A bare string whose first segment is a known scope is a path; everything else is a literal. */
function resolve(operand, scopes) {
  if (typeof operand !== "string") return operand;
  const head = operand.split(".")[0];
  if (!SCOPES.has(head)) return operand;
  return readPath(operand, scopes);
}

/** Evaluate a condition node. `undefined`/`null` condition means "always ask". */
export function evaluate(node, scopes) {
  if (node === null || node === undefined) return true;
  if (typeof node === "boolean") return node;
  if (typeof node === "string") return truth(resolve(node, scopes));
  if (Array.isArray(node)) throw new Error(`expr: bare array is not a condition: ${JSON.stringify(node)}`);
  const keys = Object.keys(node);
  if (keys.length !== 1) throw new Error(`expr: a condition node needs exactly one operator, got [${keys}]`);
  const [op] = keys;
  if (!(op in OPS)) throw new Error(`expr: unknown operator '${op}'. Allowed: ${Object.keys(OPS).join(", ")}`);
  const arg = node[op];
  if (["and", "or", "eq", "ne", "in", "gt", "lt"].includes(op) && !Array.isArray(arg)) {
    throw new Error(`expr: operator '${op}' takes an array`);
  }
  if (["eq", "ne", "in", "gt", "lt"].includes(op) && arg.length !== 2) {
    throw new Error(`expr: operator '${op}' takes exactly 2 operands, got ${arg.length}`);
  }
  return OPS[op](arg, scopes);
}

const FUNCS = {
  len: (v) => (Array.isArray(v) || typeof v === "string" ? v.length : 0),
  count: (v) => (Array.isArray(v) ? v.length : 0),
  join: (v, sep) => (Array.isArray(v) ? v.join(sep ?? ", ") : String(v ?? "")),
  coverage: (v) => (Array.isArray(v) ? `${v.length}` : String(v ?? "")),
  // Internal kebab-case ids are not prose. "seller-onboarding" -> "seller onboarding".
  humanize: (v, sep) =>
    (Array.isArray(v) ? v : [v])
      .filter((x) => x !== undefined && x !== null)
      .map((x) => String(x).replace(/-/g, " "))
      .join(sep ?? ", "),
};

/**
 * Substitute {{ path }} / {{ fn(path) }} / {{ fn(path, 'sep') }} in a template string.
 * An unresolved path renders as the empty string and is reported by `ctsx lint`, so a typo
 * shows up in CI rather than as a literal "{{...}}" in a developer's prompt.
 */
export function interpolate(template, scopes, onMiss) {
  if (typeof template !== "string") return template;
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, body) => {
    const call = body.match(/^([a-z]+)\(\s*([^,)]+?)\s*(?:,\s*(?:'([^']*)'|"([^"]*)")\s*)?\)$/);
    if (call) {
      const [, fn, path, sepSingle, sepDouble] = call;
      const sep = sepSingle ?? sepDouble;
      if (!(fn in FUNCS)) throw new Error(`interpolate: unknown function '${fn}'`);
      const v = readPath(path.trim(), scopes);
      if (v === undefined && onMiss) onMiss(path.trim());
      return String(FUNCS[fn](v, sep));
    }
    const v = readPath(body, scopes);
    if (v === undefined) {
      if (onMiss) onMiss(body);
      return "";
    }
    if (v instanceof String) return String(v);
    return typeof v === "object" ? JSON.stringify(v) : String(v);
  });
}
