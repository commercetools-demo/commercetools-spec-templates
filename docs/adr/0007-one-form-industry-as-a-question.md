# 7. One collector form; the industry is a question

Status: accepted · 2026-08-25 · supersedes the fan-out in [ADR 3](./0003-collector-on-generated-forms.md)

## Context

[ADR 3](./0003-collector-on-generated-forms.md) established a real constraint: **no form platform —
Google Forms, GitHub Issue Forms, Slack Workflow Builder — can pipe an earlier answer into a later
question's label.** From that it concluded that the industry must be the choice of *form*, and
`ctsx collect:render` fanned out one Apps Script per industry.

The constraint is still true. The conclusion did not survive contact with running it:

- **Three forms is three of everything.** Three Apps Script projects to paste and re-run, three
  published URLs to keep straight, three responses spreadsheets to export and reconcile per round.
  All of it grows linearly with the taxonomy, and all of it is manual.
- **Adding an industry meant standing up a new collection point**, not extending the existing one.
  A colleague who had already answered had no way to answer about a second industry except through
  a URL they had never been given.
- **The wrong link is unrecoverable.** Post the telecom URL in the grocery channel and the answers
  are filed under telecom with nothing in the data to reveal it — the form never asked, so no
  answer contradicts the assumption.
- **What fan-out actually bought was wording.** `"...to make it work for Grocery & q-commerce?"`
  instead of `"...for the industry you picked?"`. That is worth something, and it is not worth
  three of everything.

## Decision

One form. The industry is its first question — a required dropdown whose options are generated from
`taxonomy/industries.yaml`, so it cannot drift from what the developer tool offers.

`ctsx collect:render` emits a single `collector/forms/expert-intake.gs` and one
`form-map-v<n>.json`. Later questions say "the industry you picked", which is the price of the
constraint ADR 3 identified, paid once in wording instead of every round in operations.

Three consequences had to be designed rather than assumed:

1. **Re-running `setup` must not cost answers.** Deleting a form item does not delete its column in
   the responses sheet: the old column keeps its data and heading, and re-adding the question
   appends a *second* column with the same heading. A CSV export then has duplicate headings, and
   the row is keyed by heading, so the empty column wins. `setup` therefore updates items **in
   place** whenever the questionnaire's shape still matches, rebuilds only when it does not, and
   says so in the log. `collect:ingest` refuses an export with duplicated headings outright.
2. **The industry is read per row**, not passed to `collect:ingest`. The label → taxonomy token
   mapping is recorded in the form map *as that form asked it*, so relabelling an industry later
   cannot orphan the rows already filed under the old label.
3. **The dropdown has an escape hatch.** A closed list forces an expert in an industry we have not
   declared to file under the nearest wrong one, and that answer is the most valuable kind the
   collector receives: it says which vertical to create next. Those rows are filed as `unlisted`
   with the answer kept verbatim, and reported separately — never guessed at.

## Consequences

- Adding an industry is: four lines of taxonomy, `ctsx build`, re-paste, Run `setup`. Same form,
  same URL, same responses sheet, one more option in the dropdown.
- One URL for every Slack channel. `collect:invite --industry <i>` still tailors the *wording* per
  channel, because "Grocery experts" reads better in `#grocery` — the form's first question then
  confirms what the channel implied rather than being the only place it is recorded.
- `collector/forms/` is now part of `ctsx build` and part of the golden-drift check, because the
  dropdown is derived from the taxonomy. Adding an industry without re-rendering fails `lint` with
  exit 3, instead of quietly shipping a form that cannot collect for it.
- Lint gate K refuses a questionnaire without exactly one required industry question. Ingest files
  every response by that answer; without it a response says what to build and never says who for.
- One responses sheet mixes industries, so the industry is in each ingested filename —
  `ls inbox/raw/<round>/*grocery*` has to be the whole selection step for triage.
- The per-industry scripts and maps are deleted, and `collect:render` prunes any that reappear.
  A leftover `grocery.gs` is not inert: pasting it starts a second form collecting into a second
  sheet that nothing reads.
- Later questions no longer name the industry. Rung 2 of the fallback ladder (a Bolt app with a
  Block Kit modal) is still the only option that could restore that, and it still needs Enterprise
  Grid app approval.
