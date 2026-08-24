# commercetools-spec-templates

Industry vertical specs for commercetools, rendered into your spec-driven development project.

> **This repository is public, and it is the only one.** The engine, the catalog, the taxonomy and
> the rendered specs all live here under MIT. Collector *answers* do not: they arrive through a
> Google Form, never touch GitHub, and are ingested into a gitignored `inbox/`. What gets committed
> is the reviewed capability, never the raw response.

```bash
# in a project already initialized with `openspec init` (or `specify init`)
npx @commercetools-demo/commercetools-spec-templates plan --industry grocery --model B2C
npx @commercetools-demo/commercetools-spec-templates apply --industry grocery --model B2C
```

That writes the grocery B2C spec set into `openspec/specs/`, runs the
[commercetools SDD overlay](https://www.npmjs.com/package/@commercetools/commercetools-ai-plugin-sdd)
so every commercetools-touching task carries its `[SKILL: …]` annotation, and leaves a receipt at
`.commercetools/spec-templates.lock.json` so `status`, `update` and `remove` all work.

Step-by-step procedures for every task — bringing specs into a project, opening a collection
round, adding an industry, authoring a vertical — are in **[`docs/runbook.md`](docs/runbook.md)**.
This README explains why things are shaped the way they are.

## Three ways to answer the questions

The questions live in `questions/developer-intake.yaml` and are asked by whichever surface you use.
There is one question set, not three.

| Surface | How you answer | Use when |
| :--- | :--- | :--- |
| `cts init` | Numbered choices at a terminal | You are a human with a shell |
| The plugin skill | `AskUserQuestion` buttons in Claude Code, Cursor, Codex or Copilot | You are working with an agent |
| `cts questions --answers '<json>'` | A JSON request/response loop | You are building your own front end |

The third is the protocol the other two are built on: pass the answers you have, get back the next
question or the resolved outputs. `cts init` refuses to run without a TTY and names the flag-based
alternative, so it can never hang a CI job.

A question that has only one real answer is not asked — it is reported. If the project already has
a framework, you see `Using OpenSpec — already set up in this project.` rather than a prompt with
one option. That is `prefill` in the question file, not a special case in the code.

**Prompts are a product surface.** Nothing in a question may show a developer our internal
vocabulary — no `_base`, no `P1`, no "capability", no raw kebab-case ids, no unrendered `{{...}}`.
A test walks every question the flow can reach and fails the build on any of them.

## What's in the catalog

| Bundle | Capabilities | What it is |
| :--- | ---: | :--- |
| `_base` x B2C | 30 | The industry-agnostic storefront: 8 journeys + 22 pages |
| `_base` x B2B | 48 | Adds the 9 B2B journeys and the 6 B2B-specific pages |
| `grocery` x B2C | 33 | The base plus 3 grocery capabilities |
| `grocery` x B2B | 50 | The base plus 2 grocery capabilities that apply to business buyers |

Every industry inherits `_base`, so a new vertical starts from a complete storefront and adds only
what makes it that industry. An industry with no `vertical.yaml` yet resolves to the base alone —
`cts coverage` labels those rows `base only` so they cannot be mistaken for industry content.

## How it fits together

One hand-authored source, compiled into per-framework output:

```
catalog/verticals/<industry>/capabilities/*.yaml     authored: framework-agnostic capability YAML
        │  ctsx build
        ▼
rendered/<industry>/<model>/<framework>-<placement>/  committed: the exact bytes cts copies
registry.json                                        committed: the single discovery root
        │  cts apply
        ▼
your project's openspec/specs/ or specs/NNN-<slug>/
```

Authoring finished spec files per framework would mean up to `industries × models × frameworks`
copies of one requirement. Authoring one neutral source and committing the rendered output gets
both: no duplication, and a PR diff that shows the exact bytes a developer will receive.

## Commands

```
cts detect                                   what framework is here, and is it complete
cts list [--industry <i>]                    what content exists
cts questions [--answers '<json>']           drive the intake flow (data-driven)
cts plan   --industry <i> --model <m> [...]  preview what would be written, and its hash
cts apply  [--plan <f>] [...]                write it, atomically, and leave a receipt
cts status | cts remove                      inspect or undo exactly what we wrote
cts why    --industry <i> --model <m>        explain why a combination resolves as it does
```

Options: `--framework openspec|speckit` · `--placement specs|change` · `--scope all|mvp` ·
`--cwd <dir>` · `--force` · `--dry-run` · `--json` · `--no-overlay`

Exit codes: `0` ok · `2` bad args · `4` no or incomplete framework · `5` unsupported combination ·
`6` blocked by conflicts · `7` renderer not implemented.

## What lands where

| Framework | Placement | Destination |
| :--- | :--- | :--- |
| OpenSpec | `specs` (default) | `openspec/specs/<capability>/spec.md` — a browsable baseline catalog |
| OpenSpec | `change` | `openspec/changes/add-<i>-<m>-<epic>/{proposal,tasks}.md` + delta specs |
| Spec Kit | — | `specs/<NNN>-<slug>/spec.md`, rebased onto `max(NNN)+n`. **Not implemented in 0.1.0.** |

Two placement notes that are easy to get wrong, and that this tool gets right:

- **Spec Kit numbering comes from disk, not from git.** `create-new-feature.sh` scans `specs/*` for
  `^[0-9]{3,}-` and takes max+1, so seeded feature directories are safe and the next
  `/speckit.specify` continues the sequence.
- **We never write a `plan.md` or a pre-ticked `checklists/` file.** `setup-plan.sh` skips its
  template copy when `plan.md` already exists, which would strip the overlay's *Platform Skills
  Resolution* table out of the feature. A pre-ticked checklist would forge Spec Kit's own
  content-quality attestations.

## Nothing is written until you have seen it

`cts plan` produces a file list, an action per path, and a `plan_hash`. `cts apply --plan <file>`
recomputes that hash and refuses if the project moved on. Files are staged in a temp directory,
fsync'd, then atomically renamed, and the receipt is written last — so a crash leaves either the
old state or a complete new one. A path we did not write (`foreign`), or one we wrote and you then
edited (`ours-edited`), blocks the run until you pass `--force`.

## Coverage, and honesty about gaps

`industry × business model` resolves three ways. A model the vertical explicitly excludes is a
**hard refusal**, not a guess. A model reached only through inheritance is reported as `derived`,
and whatever that model structurally needs but no capability covers is rendered as an **open
question** — never as invented content.

```
$ cts why --industry grocery --model B2B2C
grocery|B2B2C: derived match
  3 capabilit(ies): 3 native to B2B2C, 0 inherited
  4 model gap(s) with no published content: seller-onboarding, seller-scoped-assortment, …
  These are rendered as open questions, never as invented content.
```

## Authoring a vertical

`bin/ctsx.mjs` is the authoring tool; it is not shipped to developers.

```bash
node bin/ctsx.mjs build            # regenerate registry.json, dist/, rendered/, collector/forms/
node bin/ctsx.mjs lint --strict    # 0 ok · 1 errors · 3 golden drift
node bin/ctsx.mjs coverage         # the industry × model matrix
node bin/ctsx.mjs collect:render   # regenerate the collector's per-industry forms
npm test                           # 25 tests, offline
```

The full procedure is `plugin/skills/commercetools-vertical-authoring/SKILL.md`, including how to
turn a source PDF into capability YAML without ever committing the PDF.

## Licence

MIT throughout — see `LICENSE-MIT`. That covers the engine and the rendered specs the npm package
ships. If the catalog is ever opened up under a separate content licence, that is a decision to
take then, with a licence file to match; there is no second licence today.
