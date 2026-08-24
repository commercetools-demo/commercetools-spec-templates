# 5. This repository is public; collector answers are not

Status: accepted · 2026-08-24 · supersedes [ADR 4](./0004-one-private-repo.md)

## Context

ADR 4 chose a single private repository, on the grounds that nothing forced this one to be public
and that committing `inbox/` bought a reviewable audit trail from a colleague's sentence to a
published capability. That reasoning was sound but the premise was wrong: this repository, and
everything in it, is public.

The constraint that decides everything here is unchanged, only its direction:

> GitHub has no "public repository, private issues". A public repository's issues are public.

Collector answers are colleagues' free-text opinions about industries, and a respondent will
eventually paste a customer name into a text box. Those cannot be issues on a public repository, and
`inbox/raw/` cannot be committed to one.

## Decision

- This repository is **public**: the engine, the catalog sources, the taxonomy, the rendered output,
  the questionnaire and the generated forms. MIT throughout.
- Collector answers arrive as issues on a **separate private repository**, and `inbox/` lives there.
  `ctsx collect:install --into <checkout>` puts the forms on it; ingest writes into it.
- `inbox/` and `.github/ISSUE_TEMPLATE/collect-*.yml` are in this repository's `.gitignore`, so a
  local ingest run can never be committed here by accident.

## Consequences

- The forms and the questionnaire stay public. They are a methodology, not data — publishing how we
  ask is fine; publishing what people answered is not.
- Triage moves to the private repository's pull requests. The audit trail still exists, it is just
  not world-readable, which is the point.
- The rights machinery in `lib/rights.mjs` stops being theoretical. Anything sourced from a licensed
  document, a customer engagement or an NDA must carry a rights record before it can be published,
  and `visibility: internal` keeps it out of `rendered/` entirely. Both are now load-bearing rather
  than latent.
- A pre-publication audit found no secrets, no customer or partner names, no absolute local paths,
  and one internal Slack URL baked into a generated file. The contact link is now opt-in and unset,
  so nothing internal reaches a generated artifact.
- `provenance.contributors` records a real work email address in every capability. That is normal
  open-source attribution and it is also now scrapeable; swapping it for a team alias is a
  one-command change if that is preferred.
