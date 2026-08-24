---
name: commercetools-spec-templates
description: Bring a commercetools industry vertical's specs into a spec-driven development project — ask which framework, business model and industry, then copy the matching pre-compiled specs and wire in the commercetools skill annotations. Use when a developer wants industry-specific specs (grocery, telecom, fashion) for a commercetools build.
when_to_use:
  - "Starting a commercetools build for a specific industry and wanting the industry's specs up front"
  - "Adding an industry vertical's specs to an existing Spec Kit or OpenSpec project"
  - "Checking, updating or removing verticals that were previously brought in"
metadata:
  contentType: SKILL
  area:
    - spec-driven-development
    - verticals
---

# commercetools Spec Templates

Copies a pre-compiled, industry-specific spec set into the developer's spec-driven development
project. You ask the questions; the `cts` CLI decides and writes every byte. **Never write spec
files yourself** — determinism is the point, and the CLI leaves a receipt so its work is reversible.

`CTS` below is `npx -y @commercetools-demo/commercetools-spec-templates` (or the bundled `${CLAUDE_PLUGIN_ROOT}/bin/cts.mjs`
when offline).

## Workflow

1. **Detect first.** `CTS detect`
   - Exit 4 with "No spec-driven framework found" — the developer has no framework. Offer to run
     the initializer the output names (`openspec init` / `specify init`). Run **their** initializer;
     never hand-create `.specify/` or `openspec/`.
   - Exit 4 with "INCOMPLETE" — name the missing files and stop. Do not write into a half-initialized
     framework.

2. **Ask the questions the tool gives you, in order.** Never invent, reorder or reword them; they
   are data in `questions/developer-intake.yaml` and they change without a skill release.

   ```bash
   CTS questions --answers '{"framework_state":"have","framework":"openspec"}'
   ```

   Each call returns `{done:false, question:{...}}` or `{done:true, outputs:{...}}`. Map `question`
   straight onto `AskUserQuestion`: `header` → the chip, `prompt` → the question, `options[].label`
   and `.description` → the options. If `overflow` is present and there are more than four options,
   ask `overflow.group_question` first, then the filtered list. Feed every answer back in `--answers`
   and repeat until `done`.

3. **Plan, and show it.** `CTS plan --industry <i> --model <m> [--placement change] --json`
   Report the file list, the `match` (`exact` or `derived`), and any gaps, then get a yes.
   Exit 6 means paths would be overwritten — list them and ask before passing `--force`.
   Exit 5 means the combination is not supported; report the supported list, do not substitute
   a different one.

4. **Apply.** `CTS apply --industry <i> --model <m>`
   It runs the commercetools overlay first, then writes the specs, then the receipt. If the output
   says the overlay could not run, run the
   `commercetools:commercetools-spec-driven-development` skill yourself before continuing.

5. **Verify with the framework's own validator** and report the result verbatim:
   `npx -y @fission-ai/openspec@latest validate --specs --strict`

6. **Report**: how many specs landed and where, the match and the gaps, which
   `commercetools-*` skills the specs require, and every open question the specs carry.
   Open questions are the honest part of this content — surface them, do not summarize them away.

## Hard rules

| Rule | |
| :--- | :--- |
| The CLI writes files; you never do | non-negotiable |
| Ask exactly the questions `CTS questions` returns | they are data, not prose |
| Never hand-create a framework directory — run the framework's own initializer | |
| Never pass `--force` without naming the files it will overwrite and getting a yes | |
| Report gaps and open questions; never present a `derived` match as `exact` | |

## Checklist

- [ ] `cts detect` ran first and its exit code was honoured
- [ ] Every question came from `cts questions`, in the order it returned them
- [ ] The plan was shown to the developer before anything was written
- [ ] The overlay ran (by the CLI, or by the skill afterwards)
- [ ] The framework's own validator ran and its output was reported
- [ ] Gaps, open questions, and the required `commercetools-*` skills were reported
