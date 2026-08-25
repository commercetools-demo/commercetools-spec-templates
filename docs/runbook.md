# Runbook

Procedures only. For why any of it is shaped this way, see the [README](../README.md) and
[`docs/adr/`](./adr).

The published package is `@commercetools-demo/commercetools-spec-templates` and its binary is
`cts`. Examples below spell the package out; once it is installed, `cts <command>` is the same
thing.

Prerequisites: Node >= 20.19. `npm install` once (the engine has no runtime dependencies; this is
for the authoring tool). Collector ingest additionally needs `COLLECTOR_PSEUDONYM_KEY` from the team
vault.

---

## A. Bring specs into a project

Run from the target project, not from this repo.

1. Make sure the project has a spec framework. If not, run its own initializer —
   `npx -y @fission-ai/openspec@latest init` — never create `openspec/` or `.specify/` by hand.
2. `npx @commercetools-demo/commercetools-spec-templates init`
3. Answer the questions. Pick **Generic** if your industry is not listed.
4. Read the file list, then confirm.
5. Verify: `npx -y @fission-ai/openspec@latest validate --specs --strict`

Skip the questions if you already know the answers:

```bash
npx @commercetools-demo/commercetools-spec-templates plan  --industry grocery --model B2B   # writes nothing
npx @commercetools-demo/commercetools-spec-templates apply --industry grocery --model B2B
```

Undo: `npx @commercetools-demo/commercetools-spec-templates remove` — takes back only files it wrote and you did not
edit. The commercetools overlay is separate:
`npx -y @commercetools/commercetools-ai-plugin-sdd remove`.

---

## B. Open a collection round

There is **one form for every industry** — the industry is its first question — so steps 1–5 are
done once, ever, not once per industry.

1. `node bin/ctsx.mjs build` (or `collect:render`, which does just the form).
2. Open [script.google.com](https://script.google.com) > **New project**. Click into `Code.gs`,
   select all, and paste `collector/forms/expert-intake.gs` over it. **Keep the project at one
   file** — every `.gs` in a project shares one global scope, so a second copy fails with
   `SyntaxError: Identifier 'TITLE' has already been declared` before anything runs.
3. Pick **`setup`** in the function dropdown beside **Run**, click **Run**, and allow the
   authorization prompt (Forms, Drive, Sheets).
   **Do not use Deploy.** This is not a web app; deploying it gives
   `Script function not found: doGet`. The script builds a Google Form and is finished once it has
   run — the form is what has a URL.
4. Copy the URL under `=== PASTE THIS INTO SLACK ===` in the **Execution log** at the bottom. Keep
   it; it is the only URL you will ever need to share.
5. Keep the script project. Re-running `setup` is how you update the live form (procedure **C**).
6. `node bin/ctsx.mjs collect:invite --url <published URL>` for the all-industries post, or add
   `--industry <industry>` to tailor the wording for one channel. **The URL is the same either
   way** — only the words change.
7. Paste the printed message into Slack, and DM the named experts. Set the reminder it prints.
8. When responses have landed: in Sheets, **File > Download > Comma-separated values**.
9. ```bash
   export COLLECTOR_PSEUDONYM_KEY='<from the team vault>'
   node bin/ctsx.mjs collect:ingest --csv ~/Downloads/responses.csv
   ```
   Every industry in the export is ingested, each response filed by its own answer. Add
   `--industry <industry>` to ingest only one industry's rows.
10. Read the output:
   - **exit 1** — some responses are in `inbox/raw/<round>/_needs-a-human/`. Nothing was dropped;
     read each file's `mapping` block and fix by hand.
   - **exit 2, "duplicated column heading"** — the sheet has two columns under one heading, so
     one would silently overwrite the other. Delete the *empty* duplicate in Sheets and export
     again.
   - **`filed as 'unlisted'`** — someone picked *Something else* in the dropdown. Their answer
     names an industry we do not have. Read it: that is the argument for the next vertical.

Three errors the Apps Script editor can give you, and what each means:

| What you see | What it is |
| --- | --- |
| `SyntaxError: Identifier 'TITLE' has already been declared` | Two copies of the script in one project. Keep one file; paste over it, not beside it. |
| `Script function not found: doGet` | You used **Deploy**. This is not a web app — pick `setup` and press **Run**. |
| `The form currently has no response destination` | An older copy of the generated script. Re-render and paste the current one. |

`inbox/` is gitignored. Never commit a raw response; commit the reviewed capability instead.

---

## C. Add an industry to the collector

1. Add four lines to `taxonomy/industries.yaml`:
   ```yaml
     automotive-parts:
       label: Automotive parts & aftermarket
       group: industrial          # must exist under `groups:` in the same file
       maturity: draft
   ```
2. `node bin/ctsx.mjs build`
3. Commit `taxonomy/industries.yaml` and the regenerated `collector/forms/expert-intake.gs` and
   `form-map-v<n>.json`. (`lint` fails with exit 3 if you skip the rebuild.)
4. In the **same** Apps Script project from procedure B, select all in the file you pasted last
   time, paste the regenerated `expert-intake.gs` over it, and Run **`setup`** again. Paste over
   the file, never beside it — see step B2.

Same form, same URL, same responses sheet — the dropdown just gains an option. The log should say
`Updated N question(s) in place`. If it says the shape changed instead, the questionnaire itself
was edited, not just the taxonomy; export the sheet before trusting it, because rebuilt questions
start new empty columns beside the old ones.

Nothing else is authored — the questionnaire is shared and the industry is a question, not a form.
`maturity: draft` keeps the industry out of the developer tool until it has published capabilities.

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
