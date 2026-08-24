# 4. One private repository, not a public catalog plus a private collector

Status: accepted · 2026-08-24 · supersedes the two-repo split assumed in ADR 3

## Context

The original design assumed this repo would be public — with the catalog open under a content
licence — and that a second private repo would receive collector answers, hold
`visibility: internal` capabilities, and keep source rights records.

Three facts undercut the premise:

- **Nothing requires this repo to be public.** `catalog/` is not in the npm `files:` list, so the
  package ships the engine plus `rendered/` and `registry.json`. `npm publish` works from a private
  repo, so `npx commercetools-spec-templates` serves every developer regardless of repo visibility.
  The plugin front door lives in `commercetools-ai-plugins`, a different repo.
- **No internal content exists.** All 51 capabilities are `visibility: public`. The private-repo
  requirement was speculative.
- **GitHub has no "public repo, private issues".** Flipping a repo to public exposes its whole
  issue history retroactively. So collector answers filed as issues make repo visibility a one-way
  door, whichever repo they land in.

A public repo buys external contributors reading and PRing the catalog, and openly licensed
content. Both are choices, neither is a mechanic.

## Decision

One repository, private. Collector answers arrive as issues here, `inbox/` is committed, and the
npm package remains public.

## Consequences

- One repo to create, one to maintain, no cross-repo sync of forms or capability sources.
- `inbox/raw/` and `inbox/candidates/` are committed, so triage happens in pull requests with a
  full audit trail from a colleague's sentence to a published capability. That is the main win and
  it is only available because the repo is private.
- **This repo cannot later be made public without first purging the collector issues.** Recorded in
  `inbox/README.md` and the README banner, because it is the kind of constraint that gets forgotten.
- `visibility: internal` and the rights-record machinery stay in the schema and the linter. They
  cost nothing unused and are the right gate the day a customer-sourced capability appears.
- Licensing collapses to MIT throughout. The README previously promised CC BY 4.0 for `catalog/`,
  `rendered/` and `taxonomy/` with no such licence file present, while `package.json` published
  `rendered/` under MIT. The shipped reality wins.
