/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Build the plan, then hash it. Nothing is written until a plan exists, and `cts apply --plan`
// re-checks the hash, so what a human approved is what lands on disk.

import fs from "node:fs";
import path from "node:path";
import { sha256, readReceipt, fileState } from "./receipt.mjs";

/**
 * Classify each rendered file against the target project.
 *   create      the path is free
 *   ours-same   we wrote it, byte-identical, nothing to do
 *   ours-stale  we wrote it, content has moved on -> update
 *   ours-edited we wrote it and the developer changed it -> needs --force
 *   foreign     someone else's file at our path -> needs --force
 */
export function buildPlan({ cwd, framework, industry, model, placement, scope, files, contentVersion }) {
  const receipt = readReceipt(cwd);
  const known = new Map((receipt?.files ?? []).map((f) => [f.path, f]));

  const entries = files.map((f) => {
    const abs = path.join(cwd, f.path);
    const hash = sha256(f.content);
    let action = "create";
    if (fs.existsSync(abs)) {
      const prior = known.get(f.path);
      if (!prior) action = "foreign";
      else if (fileState(cwd, prior) === "modified") action = "ours-edited";
      else action = prior.sha256 === hash ? "ours-same" : "ours-stale";
    }
    return { path: f.path, sha256: hash, bytes: Buffer.byteLength(f.content, "utf8"), action };
  });

  const plan = {
    plan_version: 1,
    tool: "commercetools-spec-templates",
    content_version: contentVersion,
    framework,
    industry,
    model,
    placement,
    scope,
    entries,
    summary: entries.reduce((acc, e) => ({ ...acc, [e.action]: (acc[e.action] ?? 0) + 1 }), {}),
  };
  plan.plan_hash = sha256(JSON.stringify({ ...plan, plan_hash: undefined }));
  return plan;
}

export const BLOCKING = new Set(["foreign", "ours-edited"]);

export const blockers = (plan) => plan.entries.filter((e) => BLOCKING.has(e.action));
