<!-- ct-audit-ignore-file org-references -->
<!-- This report names commercetools-demo deliberately: it is the historical record of what was
     audited and where. Rewriting the org name here would falsify it. -->

# Publish readiness: commercetools-spec-templates

**NOT YET — no automated blocker remains, but 4 decisions are outstanding and 1 of them is gate 0.**

Audited and remediated 2026-09-01 against the ct-builders publishing rules. 775 files scanned.
Score **70/100** (needs-work), up from 21/100 (blocked) at the start of the day. Blockers: **1 → 0**.

The repository is **already public** at `commercetools-demo/commercetools-spec-templates`, so the
mechanical work below closed live exposures rather than pre-launch ones. What is left is
deliberately not mechanical: nobody has cleared gate 0, and this report will not say "publishable"
until somebody does.

## Summary

| | |
|---|---|
| Blockers | 0 |
| High | 3 (2 are explained below and need no code) |
| A script can fix | 1 (and it should not — see Refused) |
| A person must decide | 4 |
| Of those, judgement calls | 3 |
| Suppressions in the tree | 3 |

## What changed today

| # | Work | Result |
|---|---|---|
| 1 | **Licence reconciled.** Two files named two different holders — `LICENSE` said "commercetools-demo", `LICENSE-MIT` said "commercetools GmbH" — and `package.json` shipped one while GitHub displayed the other. | One `LICENSE`, holder **commercetools GmbH**. `LICENSE-MIT` deleted; `package.json` `files:` and the README reference updated. The README's claim that "there is no second licence today" is now true. |
| 2 | **88 SPDX headers** added across `catalog/`, `lib/`, `test/`, `taxonomy/`, `renderers/`, `bin/`, `questions/`, `collector/`, and the CI workflow. | 62 YAML-family files carry `#` lines (61 `.yaml`, 1 `.yml`) and 26 `.mjs` files carry `/* … */` blocks, both `bin/*.mjs` headered below their shebang. |
| 3 | **Support terms stated.** `SUPPORT.md` and `CONTRIBUTING.md` created; README opens with the unsupported banner and has a `## Support` section. | The one blocker is closed. The banner sits below the tagline, so a reader learns what the thing is before being told it is unsupported. |
| 4 | **Licence headers in generated output** — the gap the original audit under-counted. | 657 rendered files previously carried **zero** licence text. A `licensed()` helper in `renderers/shared.mjs` now prefixes every emitted spec, and `manifest.json` and `registry.json` carry a `license` key. |
| 5 | **Personal data removed.** A work email appeared in all 51 capability YAMLs; an internal guild alias was compiled into `registry.json`. | `provenance.contributors` is now `["@behnamt"]` in all 51 files. `owners` on the grocery vertical is empty with a comment saying a GitHub team handle belongs there. No real address remains in any tracked file. |
| 6 | **Org strings rewritten** to `ct-builders` — 13 references plus the npm scope and the lockfile. | No tracked file names `commercetools-demo` any more, except this report on purpose. |
| 7 | **Regression guard.** A new CI step fails the build when a source file lands without a header. | Negative-tested: a bare probe file was correctly caught, and removed again. |

`.gitignore` also learned `.env` / `.env.*`, and `content_version` was bumped `0.1.0 → 0.2.0`
because every rendered byte changed.

### Two corrections to the original audit

- It reported "80/80 tests pass". The true count is **81**, confirmed by five runs and by the
  per-file sum, at both the original commit and now. The first observation was simply wrong.
- It said the sweep "missed" the contributor emails. It did not: `EMAIL_ALLOW` deliberately exempts
  `commercetools.com`, so that finding was a judgement call rather than a detector gap. The action
  taken was the same.

## What needs a decision, and whose

### 1. Does this overlap the product roadmap? — gate 0, still not cleared

Nothing done today touches this, and it remains the gate that makes the rest worth doing or not.

By its signals this is not a storefront starter: `dependencies: {}`, no frontend framework, no
runtime `@commercetools/*` SDK, no routes. It is a CLI plus a YAML catalog compiled into spec
bundles. But the *payload* is 51 opinionated specs describing cart, checkout, PDP, PLP, account
dashboard, approval workflows and quote negotiation — a written description of the surface the
forthcoming storefront builder covers. Storefront starters are ruled out by name; a spec catalog
for building one sits close enough to that ruling that I cannot resolve it from inside the repo.
It also hands off to `@commercetools/commercetools-ai-plugin-sdd` (`lib/overlay.mjs:11`), so it
already operates where a commercetools-owned package exists.

Read: **genuine maybe**, closest to the "page / site builder" shape the rules mark as an explicit
maybe needing a product answer *before* shipping. It has already shipped.

**Decides:** the product owner for the storefront builder. **Unblocks on:** is a published,
commercetools-branded spec catalog for storefront capabilities in scope for, or in tension with,
the builder?

### 2. Is `source: authored` the right attestation? — gate 1b

All 51 capabilities declare `provenance.source: authored`, which per `lib/rights.mjs:30-32` is
exactly the value requiring no rights record — it is what makes the repo's own publish gate pass.
48 of them also carry a `locator` into a structured external document
(`"1. Core Shopping Pages › Cart Page"`), and the inline comment says commercetools authored that
page inventory and that it is not retained.

Probably correct. Flagged because the source document is gone, so the declaration is now the only
evidence, and a self-declaration is doing the work a record would normally do.

**Decides:** whoever authored the catalog, in one sentence on the record.

### 3. The 14 commits of already-public history — gate 6

Unchanged and unexaminable by any worktree scan. The repo was public before today, so the history
is already out. `*.pdf` and `*.docx` are gitignored and the source document was reportedly never
committed; confirming that held across all 14 commits is one `git log --diff-filter=A --name-only`
away. Nobody has run it.

### 4. Sequencing the `ct-builders` migration

The rewrite in item 6 is done in the files. Until the org, repo and npm package actually exist, the
README's `npx @ct-builders/commercetools-spec-templates …` commands and `package.json`'s
`repository.url` describe an intended future state rather than a working one. This was a deliberate
choice, kept as a separate commit so it can be held or landed independently.

**Decides:** you. Also still open: the recorded delivery decision for this project was an
**unscoped** package name, chosen because `commercetools-demo` did not own a suitable npm scope —
a rationale that a new `@ct-builders` scope resolves. The scoped name is applied; confirm it is
what you want before anything is published.

## Dismissed, with reasons

**"GCP project id — 6 occurrences" (HIGH).** False positive, unchanged from the first audit. Every
hit is the string `commercetools-spec-driven-development`; the detector's pattern is
`\b(?:ct-|commercetools-)[a-z0-9-]*(?:dev|prod|staging|…)` and `dev` matches inside
"dri**ven**-**dev**elopment". It is a public Claude Code plugin skill identifier paired with the
public npm package `@commercetools/commercetools-ai-plugin-sdd`. The count rose from 5 to 6 only
because this report now quotes the string.

**All 4 candidate customer names (71 occurrences).** Every one a coincidence:

| Term | Hits | Why |
|---|---|---|
| `grocery` | 31 | A taxonomy industry vertical — `catalog/verticals/grocery/`, `"label": "Retail & grocery"`. The repo is *about* verticals. |
| `drive` | 31 | The English verb ("drive the intake flow") and Google Drive (the collector's Forms/Drive/Sheets scopes). |
| `development` | 5 | "spec-driven development" — the repo's subject. |
| `eval` | 4 | JavaScript's `eval`, in comments stating the expression evaluator does *not* use it (`lib/expr.mjs:3`). |

A 60-term candidate list against a 363-repo org producing zero real hits is a clean sweep, not a
thin one.

## Gate by gate

| Gate | Result | Notes |
|---|---|---|
| 0. Roadmap overlap | **NOT CLEARED** | Unchanged. Needs a named product-side owner. |
| 1. MIT + header in every source file | **PASS** | One `LICENSE` (commercetools GmbH); 88 source files headered; 657 generated files now carry the notice too. CI enforces it going forward. |
| 1b. Files that are not ours | **PASS, with one refusal** | No vendored subtrees. `fixtures/openspec-init/` deliberately left unheadered — see Refused. |
| 2. "Unsupported" said out loud | **PASS** | `SUPPORT.md`, `CONTRIBUTING.md`, README banner and README `## Support`. Said three times, as the rule asks. |
| 3. Credentials | **PASS** | No credential-shaped strings; no `.env` committed; `.gitignore` now ignores `.env` / `.env.*`. |
| 4. Customer & internal information | **PASS** | No customer names. Personal email and internal guild alias both removed. |
| 5. Internal tooling | **PASS** | The one hit is the false positive above. |
| 6. History | **STILL EXPOSED** | 14 public commits, unreviewed. Not fixable from the worktree. |
| 7. Prove it still works | **PASS** | `build` reproduces committed output, `lint --strict` OK on 51 capabilities, **81/81** tests, and OpenSpec's own `validate --specs --strict` passes 33/33 on applied output. |
| Shared change-set (org strings) | **DONE IN FILES** | No tracked file names the old org. The migration itself is outstanding. |

## Refused

**`fixtures/openspec-init/openspec/config.yaml`** — the sweep still reports this as "1 source file
missing the SPDX header", and it should stay that way. The file is a verbatim copy of what
`openspec init` emits, kept so CI can validate against a real scaffold. Stamping
`Copyright (c) 2026 commercetools GmbH` on it would assert ownership of another project's output —
exactly what gate 1b exists to prevent — and would stop the fixture being what the vendor actually
produces. The fix script headers it on every run; it is reverted each time, and the CI header check
excludes that path with a comment saying why.

Note that `spdx-headers` is **not** suppressible via `ct-audit-ignore`, so this finding cannot be
annotated away and will recur in every future report. That is the correct trade: a permanent,
explained finding beats a silent exemption.

The 3 suppressions counted in the tree are the `org-references` markers on this report.

## Not covered by this audit

- **Git history.** Worktree only. All 14 commits are already public and unexamined.
- **The GitHub repo surface** — description (empty), topics, issues, PR titles, releases, tags. No
  `gh` command was run for this report. Issues matter here specifically: the repo's own `.gitignore`
  explains that collector answers must never become issues in a public repo because colleagues'
  free text may name customers. Nobody has checked whether that held.
- **The rendered specs as content.** Checked for names, secrets and headers; not read for
  commercial sensitivity.
- **Anything a person has not confirmed** — every item in the decisions section, gate 0 included.

A reader who treats this as exhaustive will skip exactly the parts that need a human.
