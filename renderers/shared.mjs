/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Helpers every renderer shares. Keeping these here is what makes a third framework cheap:
// a renderer is six functions and no duplicated formatting logic.

export const slugOf = (capabilityId) => capabilityId.split(".").pop();

export const pad3 = (n) => String(n).padStart(3, "0");

/** Collapse the runaway blank lines that templating naturally produces, and end with exactly one. */
export const tidy = (text) => text.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").replace(/\n*$/, "\n");

/**
 * The licence notice every rendered file carries. Rendered specs are copied into a developer's own
 * project, far away from this repo's LICENSE, so the notice has to travel in the file or not at all.
 *
 * HTML comment rather than a heading on purpose: a `#` line would give every spec a second H1, and
 * OpenSpec's own `validate --strict` — which CI runs for real — rejects that.
 */
export const LICENSE_NOTICE = [
  "<!-- SPDX-License-Identifier: MIT -->",
  "<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->",
].join("\n");

/**
 * Prefix rendered markdown with the licence notice. Deliberately a sibling of `tidy` rather than
 * part of it: a function named "tidy" that also licenses its input is a trap for the next renderer.
 */
export const licensed = (text) => `${LICENSE_NOTICE}\n\n${text}`;

/** The `| Component | Data Source | Notes |` table, as used in both hand-built spec sets. */
export function componentsTable(components) {
  if (!components?.length) return "";
  const rows = components
    .map((c) => `| ${c.name} | \`[${c.data_source}]\` | ${c.notes ?? ""} |`)
    .join("\n");
  return [
    "| Component | Data Source | Notes |",
    "| --- | --- | --- |",
    rows,
  ].join("\n");
}

export const DATA_SOURCE_LEGEND =
  "Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared " +
  "middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the " +
  "response is session-specific.";

/** The `_Excluded (…)_` footer, reproducing the convention already used by hand. */
export function excludedFooter(excluded, model) {
  if (!excluded?.length) return "";
  const names = excluded.map((c) => c.name).join("; ");
  return `_Excluded for ${model}: ${names}._`;
}

/** commercetools grounding, rendered so an implementer sees the constraints before coding. */
export function platformSection(cap) {
  const ct = cap.commercetools;
  if (!ct) return "";
  const lines = [];
  if (ct.entities?.length) lines.push(`**Entities:** ${ct.entities.map((e) => `\`${e}\``).join(", ")}`, "");
  const byKind = (kind) => (ct.api_surface ?? []).filter((a) => a.kind === kind);
  const constraints = byKind("constraint");
  const rest = (ct.api_surface ?? []).filter((a) => a.kind !== "constraint");
  if (rest.length) {
    lines.push("**Verified API surface**", "");
    for (const a of rest) lines.push(`- (${a.kind}) ${a.ref} — [docs](${a.doc})`);
    lines.push("");
  }
  if (constraints.length) {
    lines.push("**Constraints that change the design**", "");
    for (const a of constraints) lines.push(`- ${a.ref} — [docs](${a.doc})`);
    lines.push("");
  }
  if (ct.modeling_notes) lines.push("**Modeling notes**", "", ct.modeling_notes.trim(), "");
  return lines.join("\n");
}

export function skillsSection(cap) {
  if (!cap.skill) return "";
  const supporting = cap.supporting_skills?.length
    ? ` Supporting: ${cap.supporting_skills.map((s) => `\`${s}\``).join(", ")}.`
    : "";
  return (
    `Load \`${cap.skill}\` before implementing this capability.${supporting} ` +
    `Any task generated from this spec carries \`[SKILL: ${cap.skill}]\`.`
  );
}

export function openQuestionsSection(cap) {
  if (!cap.open_questions?.length) return "";
  return cap.open_questions.map((q) => `- ${q}`).join("\n");
}

/** Gaps are rendered as questions, never as invented content. */
export function gapQuestions(gaps, model) {
  if (!gaps?.length) return [];
  return gaps.map(
    (g) =>
      `${model} normally requires \`${g}\`, and no published capability covers it. ` +
      `Decide whether this build needs it and specify it yourself.`,
  );
}
