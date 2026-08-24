// Handoff to the commercetools-spec-driven-development overlay.
//
// A Node CLI cannot invoke a Claude Code slash command, and shelling into a plugin directory that
// may not exist is worse than saying what to run. So: if the overlay's npm package is reachable we
// run it; otherwise we emit an explicit, copy-pasteable instruction and a machine-readable handoff
// the calling agent can act on. We never hand-edit the framework's files ourselves — that is the
// overlay's job, and only it knows how to remove its own marker blocks.

import { execFileSync } from "node:child_process";

export const OVERLAY_PACKAGE = "@commercetools/commercetools-ai-plugin-sdd";
export const OVERLAY_SKILL = "commercetools:commercetools-spec-driven-development";

export function overlayHandoff(framework) {
  return {
    skill: OVERLAY_SKILL,
    command: `npx -y ${OVERLAY_PACKAGE} init --framework ${framework}`,
    instruction:
      `Run the ${OVERLAY_SKILL} skill (or \`npx -y ${OVERLAY_PACKAGE} init --framework ${framework}\`) ` +
      `so that every task touching commercetools carries its [SKILL: ...] annotation.`,
  };
}

/** Best-effort. Returns {ok, output} — a failure is reported, never fatal. */
export function runOverlay(framework, cwd) {
  try {
    const output = execFileSync(
      "npx",
      ["-y", OVERLAY_PACKAGE, "init", "--framework", framework],
      { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120000 },
    );
    return { ok: true, output };
  } catch (e) {
    return { ok: false, output: (e.stdout || "") + (e.stderr || e.message) };
  }
}
