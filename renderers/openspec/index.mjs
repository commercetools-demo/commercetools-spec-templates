/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// OpenSpec renderer.
//
// Two placements:
//   specs  (default) -> openspec/specs/<capability>/spec.md          a browsable baseline catalog
//   change (opt-in)  -> openspec/changes/add-<i>-<m>-<epic>/...      a reviewable change with tasks
//
// Format contract, taken from a real OpenSpec project and the tool's own schema instructions:
//   `### Requirement: <name>` carries exactly one SHALL/MUST.
//   `#### Scenario: <name>` uses EXACTLY four hashes — three fails silently — with GIVEN/WHEN/THEN.
//   Every requirement has at least one scenario.
// In `change` placement the delta file uses `## ADDED Requirements`.
//
// Note on `specs` placement: a main spec asserts the system already behaves this way, and it has no
// tasks.md, which is the only artifact the commercetools overlay's `rules.tasks` acts on. The
// `## commercetools skills` section below is what keeps the [SKILL:] contract visible in that mode.

import {
  slugOf, tidy, licensed, componentsTable, DATA_SOURCE_LEGEND, excludedFooter,
  platformSection, skillsSection, openQuestionsSection, gapQuestions,
} from "../shared.mjs";

export const name = "openspec";
export const label = "OpenSpec";

function scenarioBlock(s) {
  const lines = [`#### Scenario: ${s.id.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase())}`];
  if (s.given) lines.push(`- **GIVEN** ${s.given}`);
  lines.push(`- **WHEN** ${s.when}`);
  lines.push(`- **THEN** ${s.then}`);
  return lines.join("\n");
}

/**
 * The pages a journey traverses, derived from every page capability's `journeys` field.
 * Derived rather than authored: a journey and its pages cannot drift out of agreement.
 */
function journeyPages(cap, all) {
  const code = (cap.journeys ?? [])[0];
  if (!code) return [];
  return all
    .filter((c) => c.kind === "page" && (c.journeys ?? []).includes(code))
    .map((c) => `- [${c.title}](../${slugOf(c.id)}/spec.md)`);
}

function specBody(cap, model, { deltaHeader, all = [] } = {}) {
  const parts = [`# ${cap.title}`, "", "## Purpose", "", cap.rationale.trim(), ""];
  if (deltaHeader) parts.push(`## ${deltaHeader}`, "");
  else parts.push("## Requirements", "");
  parts.push(`### Requirement: ${cap.title}`, "", cap.requirement.trim(), "");
  for (const s of cap.scenarios) parts.push(scenarioBlock(s), "");
  if (cap.kind === "journey") {
    const pages = journeyPages(cap, all);
    if (pages.length) parts.push("## Pages", "", ...pages, "");
  }
  if (cap.components_included?.length) {
    parts.push("## Components", "", DATA_SOURCE_LEGEND, "", componentsTable(cap.components_included), "");
  }
  const platform = platformSection(cap);
  if (platform) parts.push("## commercetools", "", platform);
  const skills = skillsSection(cap);
  if (skills) parts.push("## commercetools skills", "", skills, "");
  const oq = openQuestionsSection(cap);
  if (oq) parts.push("## Open questions", "", oq, "");
  const excluded = excludedFooter(cap.components_excluded, model);
  if (excluded) parts.push("---", "", excluded, "");
  return licensed(tidy(parts.join("\n")));
}

function proposal(resolved, epic, caps) {
  const parts = [
    `# Add ${resolved.industry} ${resolved.model}: ${epic.title}`,
    "",
    "## Why",
    "",
    `The ${resolved.industry} vertical requires behaviour a bare ${resolved.model} storefront does ` +
      `not have. This change introduces the ${epic.title.toLowerCase()} capabilities for it.`,
    "",
    "## What Changes",
    "",
    ...caps.map((c) => `- ${c.title} (${c.priority})`),
    "",
    "## Capabilities",
    "",
    "### New Capabilities",
    "",
    ...caps.map((c) => `- \`${slugOf(c.id)}\``),
    "",
    "## Impact",
    "",
    `Skills required: ${[...new Set(caps.map((c) => c.skill).filter(Boolean))].map((s) => `\`${s}\``).join(", ") || "none"}.`,
    "",
  ];
  const questions = [...caps.flatMap((c) => c.open_questions ?? []), ...gapQuestions(resolved.gaps, resolved.model)];
  if (questions.length) parts.push("## Open Questions", "", ...questions.map((q) => `- ${q}`), "");
  return licensed(tidy(parts.join("\n")));
}

function tasks(caps) {
  const parts = ["# Tasks", ""];
  let group = 0;
  for (const c of caps) {
    group += 1;
    parts.push(`## ${group}. ${c.title}`, "");
    const annotation = c.skill ? ` [SKILL: ${c.skill}]` : "";
    (c.tasks_hint ?? [c.title]).forEach((t, i) => {
      parts.push(`- [ ] ${group}.${i + 1}${annotation} ${t}`);
    });
    parts.push("");
  }
  return licensed(tidy(parts.join("\n")));
}

/**
 * @returns {{path: string, content: string}[]} paths are relative to the project root.
 */
export function render(resolved, { placement = "specs" } = {}) {
  const files = [];
  if (placement === "specs") {
    for (const cap of resolved.capabilities) {
      files.push({
        path: `openspec/specs/${slugOf(cap.id)}/spec.md`,
        content: specBody(cap, resolved.model, { all: resolved.capabilities }),
        capability: cap.id,
        priority: cap.priority,
        epic: cap.epic,
      });
    }
    return files;
  }
  // change placement: reviewable changes per epic. OpenSpec's schema caps a change at 10
  // requirement deltas, and a change nobody can review in one sitting is the bigger problem
  // anyway — so an epic larger than that is split into numbered parts rather than refused.
  const DELTA_CAP = 10;
  const parts = [];
  for (const epic of resolved.epics) {
    const caps = resolved.capabilities.filter((c) => c.epic === epic.slug);
    if (!caps.length) continue;
    for (let i = 0; i < caps.length; i += DELTA_CAP) {
      const chunk = caps.slice(i, i + DELTA_CAP);
      const part = Math.floor(i / DELTA_CAP) + 1;
      const total = Math.ceil(caps.length / DELTA_CAP);
      parts.push({
        epic: total > 1 ? { ...epic, title: `${epic.title} (part ${part} of ${total})` } : epic,
        slug: total > 1 ? `${epic.slug}-${part}` : epic.slug,
        caps: chunk,
      });
    }
  }
  for (const { epic, slug, caps } of parts) {
    const dir = `openspec/changes/add-${resolved.industry}-${resolved.model.toLowerCase()}-${slug}`;
    // An epic's proposal and tasks carry the epic's highest priority, so `--scope mvp` keeps a
    // change reviewable rather than shipping a tasks.md whose spec deltas were filtered away.
    const epicPriority = caps.map((c) => c.priority).sort()[0];
    files.push({ path: `${dir}/proposal.md`, content: proposal(resolved, epic, caps), epic: slug, priority: epicPriority });
    files.push({ path: `${dir}/tasks.md`, content: tasks(caps), epic: slug, priority: epicPriority });
    for (const cap of caps) {
      files.push({
        path: `${dir}/specs/${slugOf(cap.id)}/spec.md`,
        content: specBody(cap, resolved.model, { deltaHeader: "ADDED Requirements", all: resolved.capabilities }),
        capability: cap.id,
        priority: cap.priority,
        epic: cap.epic,
      });
    }
  }
  return files;
}
