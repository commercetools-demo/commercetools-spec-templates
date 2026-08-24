// Write the plan. Every file is staged in a temp directory inside the project, fsync'd, then
// moved into place; the receipt is written last. A crash therefore leaves either the old state
// or a complete new state, never a project half-seeded with specs.

import fs from "node:fs";
import path from "node:path";
import { writeReceipt, sha256 } from "./receipt.mjs";

export function applyFiles({ cwd, files, plan, force = false, dryRun = false }) {
  const skip = new Set(
    force ? [] : plan.entries.filter((e) => e.action === "foreign" || e.action === "ours-edited").map((e) => e.path),
  );
  const written = [];
  const staged = fs.mkdtempSync(path.join(cwd, ".tmp-cts-"));
  try {
    for (const f of files) {
      if (skip.has(f.path)) continue;
      const tmp = path.join(staged, f.path);
      fs.mkdirSync(path.dirname(tmp), { recursive: true });
      const fd = fs.openSync(tmp, "w");
      fs.writeFileSync(fd, f.content);
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      written.push(f);
    }
    if (dryRun) return { written: written.map((f) => f.path), skipped: [...skip], receipt: null };
    for (const f of written) {
      const dest = path.join(cwd, f.path);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.renameSync(path.join(staged, f.path), dest);
    }
  } finally {
    fs.rmSync(staged, { recursive: true, force: true });
  }

  const receipt = {
    receipt_version: 1,
    tool: "commercetools-spec-templates",
    content_version: plan.content_version,
    applied_at: new Date().toISOString(),
    framework: plan.framework,
    industry: plan.industry,
    model: plan.model,
    placement: plan.placement,
    scope: plan.scope,
    plan_hash: plan.plan_hash,
    files: written.map((f) => ({ path: f.path, sha256: sha256(f.content) })),
  };
  writeReceipt(cwd, receipt);
  return { written: written.map((f) => f.path), skipped: [...skip], receipt };
}
