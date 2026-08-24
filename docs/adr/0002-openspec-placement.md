# 2. OpenSpec content lands in `openspec/specs/` by default

Status: accepted · 2026-08-21

## Context

Two placements are possible. `openspec/specs/<capability>/spec.md` is a browsable baseline catalog —
and is what the team already produced by hand. `openspec/changes/add-…/` is a reviewable change with
`proposal.md` and `tasks.md`.

The argument for `changes/` is real: `tasks.md` is the only artifact carrying `[SKILL: …]`, and the
commercetools overlay patches `rules.tasks`. A `specs/` entry also asserts the system already
behaves this way, which is false on day one.

## Decision

Default to `specs/`, matching existing practice. `--placement change` produces the change form.

## Consequences

- The default is what the team already reviews and browses, so adoption costs nothing.
- The overlay's `rules.tasks` does not fire in the default placement. Mitigated by rendering a
  `## commercetools skills` section into every seeded spec, which states the skill to load and the
  annotation any derived task must carry. The overlay is still applied, so `config.yaml` context
  governs every later change.
- `--placement change` remains available and is validated in CI; changes are capped at 10
  requirement deltas each, split along `vertical.yaml.epics`.
- Both placements pass `openspec validate --strict` against the real CLI.
