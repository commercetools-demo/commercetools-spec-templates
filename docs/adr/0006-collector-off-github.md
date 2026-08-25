# 6. Collector answers never touch GitHub

Status: accepted · 2026-08-24 · supersedes the intake in [ADR 3](./0003-collector-on-generated-forms.md) and [ADR 5](./0005-public-repo-private-collector.md)

## Context

There is one repository and it is public. ADR 5 assumed a second, private repository would receive
collector answers as GitHub issues. With one public repository that option collapses:

- A public repository's issues are public, and an issue's author is visible. There is no setting
  that changes either.
- Pseudonymizing the stored file would be theatre: issue #42 is readable by anyone and names who
  wrote it.
- A confidentiality check cannot help. A respondent pastes a customer name and it is public the
  instant they submit, before any gate runs.
- The real cost is not a leak, it is candour. The questionnaire asks what is *missing* from a bare
  storefront. Colleagues answering that in public, attributed, about their employer's product, will
  hedge — and hedged answers are worthless as spec input.

## Decision

Answers arrive through a Google Form and never touch GitHub.

`ctsx collect:render` emits one Apps Script into `collector/forms/expert-intake.gs` — one form for
every industry, per [ADR 7](./0007-one-form-industry-as-a-question.md). The
admin pastes it into script.google.com and runs `setup` once; it creates (or reuses, by title) the
form and its responses spreadsheet under the admin's own Workspace account. Responses are exported
as CSV and read by `ctsx collect:ingest`, which writes one pseudonymized YAML per response into a
**gitignored** `inbox/`.

This repository therefore holds the methodology — the questionnaire, the generator, the form maps —
and never the data.

## Consequences

- Zero procurement: no Slack app, no OAuth client, no Cloud project, no hosted service, no admin
  approval. The script runs as the admin, with only the scopes they consent to.
- Build-time fan-out survives unchanged and is still the reason there is no branching engine: one
  form per industry means the later question's text is fully written in the emitted script, and no
  form platform can interpolate an earlier answer into a later question's label.
- The form map survives too, for the same reason as before — a responses sheet's column headers are
  the question titles, never the field ids, and the titles are industry-interpolated. Versioned
  filenames are kept so an older round still maps after the questionnaire is revised.
- **`splitMultiSelect` survives verbatim.** A Google Forms checkbox column joins its values with
  `", "` exactly as a GitHub dropdown did, and an option's own label may contain a comma. Splitting
  on the separator silently turns one answer into several wrong ones.
- Pseudonymization keeps its purpose: the form collects the respondent's email (Workspace
  auto-collect) so non-responders can be chased, and ingest derives a handle from it and discards
  the address. No `inbox/` file carries an identity.
- Deleted: the GitHub Issue Form emitter, `collect:install`, `collect:link`, the issue-body parser
  and its GraphQL identity lookup. What the issue-form research bought is recorded below so it is
  not relearned if this is ever revisited.
- The respondent experience is worse than an in-Slack form and better than nothing. Rung 2 of the
  original ladder — a Bolt app with a Block Kit modal reading this same questionnaire — remains the
  graduation path if response rate proves the problem.

## Recorded for the day someone revisits GitHub Issue Forms

All verified empirically before this decision, and all still true:

- There is **no structured API** for issue-form answers. The field `id` appears nowhere in the
  result; the GraphQL `issueFieldValues` union is a different feature and returns empty. Parsing
  the rendered body is the only route.
- `body.split(/^### /m)` does not work. Respondents paste `###` headings inside textareas; one
  observed issue had 14 such lines of which 5 were fields, so the split fabricates nine fields and
  shreds the real answers. A forward-only cursor over the *expected* labels is required.
- `gh issue list --json author` returns the respondent's real **name**. Identity must come from
  GraphQL `databaseId`, which is also the only identifier stable across a username change — GitHub
  releases a freed username for anyone to claim.
- A form applies its `labels:` **only if the label already exists in the repository**. Otherwise
  issues arrive unlabelled, the ingest query matches nothing, and nothing anywhere reports an error.
- `validations: required` works on every field type and on private repositories. The restriction
  was lifted in February 2025; GitHub's own docs still say otherwise.
- Only `input` and `textarea` can be prefilled from a URL, by field `id`. Dropdowns and checkboxes
  cannot; use the schema's `default:` index instead.
