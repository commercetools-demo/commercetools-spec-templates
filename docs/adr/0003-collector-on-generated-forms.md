# 3. The collector ships as generated forms, not a Slack app

Status: accepted · 2026-08-21

## Context

Colleague input is needed roughly twice a year per vertical. The questions must stay editable as
data and must share the industry taxonomy with Tool 1.

The blocking technical fact: **neither Slack Workflow Builder nor Google Forms can interpolate an
earlier answer into a later question's label.** Workflow Builder forms are also single-select only,
and their questions live in Slack's UI where they are not data, not diffable, and cannot share the
taxonomy. Polly has no branching. Typeform has piping, but forms with logic jumps cannot be answered
inside Slack. Only a Block Kit modal does it natively — and that needs Enterprise Grid app approval.

## Decision

Keep the questionnaire in `collector/questions/expert-intake.yaml`. Generate one form **per
industry** at build time (`ctsx collect:render`) and distribute the link through Slack.

Superseded in part by [ADR 4](./0004-one-private-repo.md): the forms live on **this** repo, which is
private, not on a separate internal repo.

## Consequences

- Build-time fan-out dissolves the interpolation problem: industry becomes the choice of form, so
  the later question's text is fully interpolated in committed bytes. No branching engine, and it
  works identically on GitHub Issue Forms, Google Forms and a Slack modal.
- Zero procurement: no app approval, no OAuth scopes, no bot token, no hosted service, no on-call.
- Nothing is thrown away on the way up the ladder — rung 2 (a Bolt app with a Block Kit modal)
  consumes the same YAML, and the storage shape does not change.
- `repeat: 3` on the free-text question yields three pre-atomized candidates per respondent instead
  of one paragraph to split, which is most of the triage work done at collection time.
- GitHub's `required` on checkboxes is public-repo only, so every required multi-select renders as
  a dropdown with `multiple: true`.
