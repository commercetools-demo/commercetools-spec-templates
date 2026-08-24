# 1. One framework-agnostic source, compiled to committed per-framework output

Status: accepted · 2026-08-21

## Context

The same industry requirement has to appear in OpenSpec shape and in Spec Kit shape, for up to four
business models, across a growing set of industries. Two hand-built spec sets already existed
(`customer-gartner2026` in Spec Kit form, `kotlin-app-b2c-starter` in OpenSpec form) and the
`| Component | Data Source | Notes |` table appears **verbatim in both** — evidence that the
invariant payload is real and separable from framework shape.

## Decision

Author one neutral capability YAML per requirement. Render it in CI into per-framework bundles under
`rendered/`, and **commit them**.

## Consequences

- No duplication: one requirement, one file, regardless of framework or model count.
- The `[SKILL:]` token sits in a different position per framework; as a `skill:` field the renderer
  places it by construction rather than by hand-copying prose.
- Committing the rendered output keeps the reviewer benefit of authoring finished files: a PR shows
  the exact bytes a developer will receive. `ctsx lint` exits 3 if they drift from source.
- A third framework costs one renderer, not a re-authoring of the catalog.
