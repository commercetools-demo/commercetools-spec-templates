// The write receipt. Same discipline as the overlay's marker blocks: record exactly what was
// written and its hash, so `cts status` can tell "unchanged" from "the developer edited it", and
// `cts remove` refuses to delete work that is no longer ours.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const RECEIPT_PATH = ".commercetools/spec-templates.lock.json";

export const sha256 = (text) => crypto.createHash("sha256").update(text, "utf8").digest("hex");

export function readReceipt(cwd) {
  const f = path.join(cwd, RECEIPT_PATH);
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, "utf8"));
}

export function writeReceipt(cwd, receipt) {
  const f = path.join(cwd, RECEIPT_PATH);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(receipt, null, 2) + "\n");
  return RECEIPT_PATH;
}

/** unchanged | modified | missing — decided against the hash we recorded when we wrote it. */
export function fileState(cwd, entry) {
  const abs = path.join(cwd, entry.path);
  if (!fs.existsSync(abs)) return "missing";
  return sha256(fs.readFileSync(abs, "utf8")) === entry.sha256 ? "unchanged" : "modified";
}
