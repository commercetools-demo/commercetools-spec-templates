# Working in this repo

- To **author or extend a vertical**, read `plugin/skills/commercetools-vertical-authoring/SKILL.md`
  and follow it. It is the procedure, not a summary of one.
- `registry.json`, `dist/`, `rendered/` and `collector/forms/` are **generated**. Never hand-edit
  them; run `node bin/ctsx.mjs build` and commit the result.
- Source of truth is `catalog/**/*.yaml` plus `taxonomy/*.yaml`. Framework markdown is never
  authored by hand — `renderers/` owns it.
- Before reporting done: `node bin/ctsx.mjs build && node bin/ctsx.mjs lint --strict && npm test`.
