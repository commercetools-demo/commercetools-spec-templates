# Runbook

Procedures only. For why any of it is shaped this way, see the [README](../README.md) and
[`docs/adr/`](./adr).

Prerequisites: Node >= 20.19. `npm install` once (the engine has no runtime dependencies; this is
for the authoring tool). Collector ingest additionally needs `COLLECTOR_PSEUDONYM_KEY` from the team
vault.

---

## A. Bring specs into a project

Run from the target project, not from this repo.

1. Make sure the project has a spec framework. If not, run its own initializer —
   `npx -y @fission-ai/openspec@latest init` — never create `openspec/` or `.specify/` by hand.
2. `npx commercetools-spec-templates init`
3. Answer the questions. Pick **Generic** if your industry is not listed.
4. Read the file list, then confirm.
5. Verify: `npx -y @fission-ai/openspec@latest validate --specs --strict`

Skip the questions if you already know the answers:

```bash
npx commercetools-spec-templates plan  --industry grocery --model B2B   # writes nothing
npx commercetools-spec-templates apply --industry grocery --model B2B
```

Undo: `npx commercetools-spec-templates remove` — takes back only files it wrote and you did not
edit. The commercetools overlay is separate:
`npx -y @commercetools/commercetools-ai-plugin-sdd remove`.

---

## B. Open a collection round

Once per industry, steps 1–3 are one-time.

1. Confirm the industry exists in `taxonomy/industries.yaml`. If not, do procedure **C** first.
2. `node bin/ctsx.mjs collect:render`
3. Open [script.google.com](https://script.google.com), paste
   `collector/forms/<industry>.gs`, then **Run > setup**. Copy the published URL from the execution
   log. Re-running `setup` reuses the same form; it never creates a second one.
4. `node bin/ctsx.mjs collect:invite --industry <industry> --url <published URL>`
5. Paste the printed message into Slack, and DM the named experts. Set the reminder it prints.
6. When responses have landed: in Sheets, **File > Download > Comma-separated values**.
7. ```bash
   export COLLECTOR_PSEUDONYM_KEY='<from the team vault>'
   node bin/ctsx.mjs collect:ingest --csv ~/Downloads/responses.csv --industry <industry>
   ```
8. Exit 1 means some responses are in `inbox/raw/<round>/_needs-a-human/`. Nothing was dropped —
   read each file's `mapping` block and fix by hand.

`inbox/` is gitignored. Never commit a raw response; commit the reviewed capability instead.

---

## C. Add a collector for a new industry

1. Add four lines to `taxonomy/industries.yaml`:
   ```yaml
     automotive-parts:
       label: Automotive parts & aftermarket
       group: industrial          # must exist under `groups:` in the same file
       maturity: draft
   ```
2. `node bin/ctsx.mjs collect:render`
3. Commit `taxonomy/industries.yaml` and the generated
   `collector/forms/<industry>.gs` and `form-map-<industry>-v<n>.json`.
4. Continue with procedure **B** from step 3.

Nothing else is authored — the questionnaire is shared and the industry name is interpolated at
render time. `maturity: draft` keeps the industry out of the developer tool until it has published
capabilities.

**If you change a question**, bump `version:` in `collector/questions/expert-intake.yaml` before
re-rendering. Form maps are versioned by filename and old ones are kept, so earlier rounds still
map; skip the bump and you overwrite the map those responses need.

---

## D. Create or extend a vertical

1. Create the directory and its manifest:
   ```
   catalog/verticals/<industry>/vertical.yaml        supported_models, ordered epics, owners
   catalog/verticals/<industry>/capabilities/
   ```
2. Write capability YAML. Follow
   [`plugin/skills/commercetools-vertical-authoring/SKILL.md`](../plugin/skills/commercetools-vertical-authoring/SKILL.md)
   — it is the procedure, not a summary of one. One file, one capability, one `SHALL`.
3. A rights record is required **only** for material you did not author. In-house work uses
   `provenance.source: authored`. See the table in that skill.
4. ```bash
   node bin/ctsx.mjs build            # registry.json, dist/, rendered/
   node bin/ctsx.mjs lint --strict
   node bin/ctsx.mjs coverage
   ```
5. Prove it against the real framework before opening a PR:
   ```bash
   mkdir -p /tmp/probe && cp -R fixtures/openspec-init/. /tmp/probe/
   node bin/cts.mjs apply --cwd /tmp/probe --industry <industry> --model B2B --no-overlay
   (cd /tmp/probe && npx -y @fission-ai/openspec@latest validate --specs --strict)
   ```
6. Commit the sources **and** the regenerated `registry.json`, `dist/` and `rendered/`. CI fails if
   they disagree.
7. Set `maturity` in `taxonomy/industries.yaml` above `draft` once the vertical is worth offering.

---

## Exit codes

| Code | Means | Do |
| ---: | :--- | :--- |
| 0 | Fine | — |
| 1 | Lint errors, or responses needing a human | Read the reported paths |
| 2 | Bad arguments, or a missing `COLLECTOR_PSEUDONYM_KEY` | Read the message; it names the fix |
| 3 | Generated output drifted from its sources | `node bin/ctsx.mjs build` and commit the result |
| 4 | No framework, or a half-initialized one | Run the framework's own initializer |
| 5 | That industry and business model combination is not supported | `cts list` for what is |
| 6 | Would overwrite files that are not ours | Move them aside, or `--force` |
| 7 | That renderer is not implemented | Use `--framework openspec` |
