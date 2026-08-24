// GitHub Spec Kit renderer — declared, not yet implemented (month 1 on the agreed build order).
//
// The contract it must honour, already established from a real .specify/ project, so it is
// recorded here rather than rediscovered:
//
//   * Destination is `specs/<NNN>-<slug>/spec.md`. NNN is assigned AT APPLY TIME as
//     `highestFeatureNumber(cwd) + n`, because create-new-feature.sh derives the next number by
//     scanning specs/* for /^[0-9]{3,}-/ and taking max+1. Rendered goldens therefore use a
//     1-based local index and are rebased on apply; file CONTENT stays byte-stable, and
//     cross-references between specs use slugs, never numbers.
//   * Write spec.md ONLY. Never plan.md: setup-plan.sh skips the template copy when plan.md
//     already exists, which would strip the commercetools overlay's Platform Skills Resolution
//     table from the feature. Never a pre-ticked checklists/ file either — that forges Spec Kit's
//     own content-quality attestations.
//   * Section order from .specify/templates/spec-template.md: `# Feature Specification: <title>`,
//     `## User Scenarios & Testing *(mandatory)*`, `### User Story N - <title> (Priority: PN)`,
//     `### Edge Cases`, `## Requirements *(mandatory)*` / `### Functional Requirements` (FR-###),
//     `### Key Entities`, `## Success Criteria *(mandatory)*` / `### Measurable Outcomes` (SC-###),
//     `## Assumptions`. The hand-built B2B set adds `**Page Group**`, `**User Journeys**` and a
//     `## Components` table; keep those.

export const name = "speckit";
export const label = "GitHub Spec Kit";

export function render() {
  const err = new Error(
    "The Spec Kit renderer is not implemented in 0.1.0 — OpenSpec only.\n" +
      "Run with --framework openspec, or implement renderers/speckit/index.mjs against the\n" +
      "contract documented at the top of that file.",
  );
  err.exitCode = 7;
  throw err;
}
