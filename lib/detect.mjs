/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Framework detection: presence, version, and COMPLETENESS. A half-initialized framework is the
// most common real-world state (someone ran the initializer, it failed partway, or a template was
// deleted) and it is the state that silently produces broken output, so it is detected explicitly.

import fs from "node:fs";
import path from "node:path";

export const FRAMEWORKS = {
  openspec: {
    label: "OpenSpec",
    description: "Specs live in openspec/specs/; work is proposed as a change and archived when done",
    detectDir: "openspec",
    // Every path that must exist for us to write into this framework.
    requires: ["openspec/config.yaml"],
    optional: ["openspec/specs", "openspec/changes"],
    init: "npx -y @fission-ai/openspec@latest init",
  },
  speckit: {
    label: "GitHub Spec Kit",
    description: "Numbered features in specs/NNN-slug/, driven by /speckit slash commands",
    detectDir: ".specify",
    requires: [
      ".specify/memory/constitution.md",
      ".specify/templates/spec-template.md",
      ".specify/templates/plan-template.md",
      ".specify/templates/tasks-template.md",
    ],
    optional: ["specs"],
    init: "uvx --from git+https://github.com/github/spec-kit.git specify init . --integration claude --script sh",
  },
};

const exists = (p) => fs.existsSync(p);

/** Spec Kit records its own version in .specify/init-options.json; OpenSpec does not. */
function versionOf(name, cwd) {
  if (name !== "speckit") return null;
  const f = path.join(cwd, ".specify", "init-options.json");
  if (!exists(f)) return null;
  try {
    return JSON.parse(fs.readFileSync(f, "utf8")).speckit_version ?? null;
  } catch {
    return null;
  }
}

export function detect(cwd = process.cwd()) {
  const found = [];
  for (const [name, fw] of Object.entries(FRAMEWORKS)) {
    const dir = path.join(cwd, fw.detectDir);
    if (!exists(dir) || !fs.statSync(dir).isDirectory()) continue;
    const missing = fw.requires.filter((r) => !exists(path.join(cwd, r)));
    found.push({
      name,
      label: fw.label,
      detectDir: fw.detectDir,
      version: versionOf(name, cwd),
      complete: missing.length === 0,
      missing,
    });
  }
  return {
    cwd,
    frameworks: found,
    framework_count: found.length,
    framework: found.length === 1 ? found[0].name : null,
    framework_label: found.length === 1 ? found[0].label : null,
    framework_state: found.length > 0 ? "have" : "instantiate",
  };
}

/** Highest NNN already used under specs/, so seeded Spec Kit features continue the sequence. */
export function highestFeatureNumber(cwd = process.cwd()) {
  const dir = path.join(cwd, "specs");
  if (!exists(dir)) return 0;
  let highest = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    // Sequential prefixes only; skip timestamp dirs (YYYYMMDD-HHMMSS-).
    if (!/^\d{3,}-/.test(entry.name) || /^\d{8}-\d{6}-/.test(entry.name)) continue;
    const n = parseInt(entry.name.match(/^\d+/)[0], 10);
    if (n > highest) highest = n;
  }
  return highest;
}
