// Runs the questionnaire defined in questions/*.yaml (compiled to dist/questions/*.json).
//
// Two surfaces consume the SAME resolved question objects:
//   agent -> AskUserQuestion, one mapping function, four options max
//   cli   -> readline prompts
// Neither surface knows what the questions are, which is the whole point of requirement 1.

import { evaluate, interpolate, readPath } from "./expr.mjs";

/** Turn `options_from: registry.industries` plus filters/badges into a concrete option list. */
function deriveOptions(q, scopes) {
  if (!q.options_from) {
    return (q.options ?? []).map((o) => ({
      ...o,
      label: pickVariant(o.label_when, scopes) ?? interpolate(o.label, scopes),
      description: interpolate(o.description ?? "", scopes) || undefined,
    }));
  }
  const source = readPath(q.options_from, scopes) ?? {};
  let entries = Object.entries(source)
    .map(([value, meta]) => ({ value, ...meta }))
    .filter((e) => !e.hidden);

  if (q.options_filter?.supports_model) {
    const model = readPath(q.options_filter.supports_model, scopes);
    entries = entries
      .filter((e) => !Array.isArray(e.supported_models) || e.supported_models.includes(model))
      // Resolve the count for the model actually chosen, so `{{option.capability_count}}` in a
      // note cannot quote a different model's number.
      .map((e) => (e.counts ? { ...e, capability_count: e.counts[String(model)] ?? 0 } : e));
  }
  // Never offer a choice that would immediately fail — an unimplemented renderer, say.
  for (const field of q.options_filter?.requires ?? []) entries = entries.filter((e) => e[field]);
  const derived = entries.map((e) => {
    const badge = q.option_badge && e[q.option_badge] ? ` (${e[q.option_badge]})` : "";
    const note = q.option_note ? interpolate(q.option_note, { ...scopes, option: e }) : undefined;
    return {
      value: e.value,
      label: `${e.label ?? e.value}${badge}`,
      // The badge belongs on the option chip, not in a later question's prose, so the
      // undecorated label is kept for `{{answers.<id>.label}}` interpolation.
      plain: e.label ?? e.value,
      description: note || e.description || undefined,
    };
  });
  // Fixed choices that sit alongside a derived list — "Generic", for instance. Declared here
  // rather than invented by a surface, so every surface renders the same words and the label
  // resolves when a later prompt quotes it.
  for (const o of q.options_append ?? []) {
    derived.push({
      value: o.value,
      label: interpolate(o.label, scopes),
      plain: interpolate(o.plain ?? o.label, scopes),
      description: o.description ? interpolate(o.description, scopes) : undefined,
    });
  }
  return derived;
}

const pickVariant = (variants, scopes) => {
  for (const v of variants ?? []) if (evaluate(v.when, scopes)) return interpolate(v.prompt ?? v.label, scopes);
  return null;
};

/** The scope object every question is evaluated against. One builder, so surfaces cannot diverge. */
function scopesFor(questionnaire, state) {
  return {
    answers: labelled(state.answers ?? {}, questionnaire, state),
    detect: state.detect ?? {},
    registry: state.registry ?? {},
    flags: state.flags ?? {},
    resolved: state.resolved ?? {},
  };
}

/**
 * Answers that need no question. A question whose `prefill` resolves unambiguously is noise —
 * asking "which framework?" when only one can be written wastes the developer's attention.
 * Returns { id: {value, label, reason} } so a surface can SAY what it decided; deciding
 * silently is worse than one redundant prompt.
 */
export function resolvePrefills(questionnaire, state) {
  const auto = {};
  const answers = { ...(state.answers ?? {}) };
  for (const q of questionnaire.questions) {
    if (q.id in answers || !q.prefill) continue;
    const scopes = scopesFor(questionnaire, { ...state, answers });
    if (!evaluate(q.ask_when, scopes)) continue;
    const options = deriveOptions(q, scopes);
    if (!options.length) continue;

    const from = readPath(q.prefill.from, scopes);
    const match = options.find((o) => String(o.value) === String(from));
    const confirm = q.prefill.confirm ?? "always";

    let pick = null;
    let reason = "";
    if (confirm === "never") {
      if (match) { pick = match; reason = "already set up in this project"; }
      else if (options.length === 1) { pick = options[0]; reason = "the only option available"; }
    } else if (confirm === "when-ambiguous" && options.length === 1 && match) {
      pick = match;
      reason = "the only option available";
    }
    if (!pick) continue;
    auto[q.id] = { value: pick.value, label: pick.plain ?? pick.label, reason };
    answers[q.id] = pick.value;
  }
  return auto;
}

/**
 * Resolve the next question to ask, given the answers so far. Returns null when the flow is done.
 * `resolve` is a callback that recomputes `resolved.*` from the answers collected so far — that is
 * how a later prompt can quote the real gap list and capability count.
 */
export function nextQuestion(questionnaire, state) {
  const { answers = {} } = state;
  for (const q of questionnaire.questions) {
    if (q.id in answers) continue;
    const scopes = scopesFor(questionnaire, state);
    if (!evaluate(q.ask_when, scopes)) continue;
    const options = deriveOptions(q, scopes);
    // A question whose options all vanished cannot be asked; skipping beats an empty prompt.
    if (!options.length && !q.allow_other) continue;
    return {
      id: q.id,
      header: q.header,
      type: q.type ?? "single",
      required: q.required ?? false,
      prompt: pickVariant(q.prompt_when, scopes) ?? interpolate(q.prompt, scopes),
      hint: q.hint ? interpolate(q.hint, scopes).trim() : undefined,
      options,
      allow_other: !!q.allow_other,
      on_other: q.on_other,
      overflow: q.overflow,
      prefill: q.prefill,
    };
  }
  return null;
}

/**
 * Expose each answer as both `.value` and `.label` so prompts can quote a human-readable label.
 *
 * Labels are resolved in question order, accumulating the answers seen so far, because a
 * question's option list may itself depend on an earlier answer — `industry` is filtered by
 * `business_model`. Resolving with an empty answer scope silently falls back to the raw value.
 */
function labelled(answers, questionnaire, state) {
  const out = {};
  const wrap = (value, label) => Object.assign(new String(value), { value, label });
  for (const q of questionnaire.questions) {
    if (!(q.id in answers)) continue;
    const value = answers[q.id];
    const scopes = {
      answers: out,
      detect: state.detect ?? {},
      registry: state.registry ?? {},
      flags: state.flags ?? {},
      resolved: state.resolved ?? {},
    };
    let label = value;
    try {
      const opt = deriveOptions(q, scopes).find((o) => o.value === value);
      if (opt) label = opt.plain ?? opt.label;
    } catch {
      // A malformed option source must not break the whole flow; fall back to the raw value.
    }
    out[q.id] = wrap(value, label);
  }
  // Answers with no matching question (e.g. injected by a caller) still resolve as themselves.
  for (const [id, value] of Object.entries(answers)) if (!(id in out)) out[id] = wrap(value, value);
  return out;
}

/** Map the `outputs:` block to a flat result object. */
export function outputs(questionnaire, state) {
  // Same labelled answers the prompts saw, so `answers.<id>.value` resolves here too.
  const scopes = scopesFor(questionnaire, state);
  const out = {};
  for (const [key, expr] of Object.entries(questionnaire.outputs ?? {})) {
    if (typeof expr === "string" && expr.includes("==")) {
      const [lhs, rhs] = expr.split("==").map((s) => s.trim().replace(/^'|'$/g, ""));
      out[key] = String(readPath(lhs, scopes) ?? "") === rhs;
    } else {
      out[key] = readPath(expr, scopes) ?? null;
    }
  }
  return out;
}
