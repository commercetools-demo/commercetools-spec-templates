/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// (industry x business model) -> the ordered capability set, plus what is missing.
//
// Pure functions over a plain catalog object so they are unit-testable without touching disk,
// and so `ctsx build` and any future consumer resolve identically. There is exactly one
// implementation of this rule; a second one would drift.

/** A model's own tag plus everything it inherits, transitively. */
export function effectiveModels(model, models) {
  const seen = new Set();
  const walk = (m) => {
    if (seen.has(m)) return;
    seen.add(m);
    for (const parent of models[m]?.inherits ?? []) walk(parent);
  };
  walk(model);
  return [...seen];
}

const appliesToModel = (tags, effective) =>
  !tags || tags.length === 0 || tags.includes("*") || tags.some((t) => effective.includes(t));

const appliesToIndustry = (tags, industry) =>
  !tags || tags.length === 0 || tags.includes("*") || tags.includes(industry);

const PRIORITY_ORDER = { P1: 0, P2: 1, P3: 2 };

/**
 * @returns {{
 *   status: 'ok'|'unsupported', match: 'exact'|'derived', capabilities: object[],
 *   native: number, derived: number, gaps: string[], epics: object[],
 *   capability_count: number, p1_count: number, open_questions: string[], skills: string[]
 * }}
 */
export function resolveCombination({ industry, model, catalog }) {
  const models = catalog.business_models;
  if (!models[model]) throw new Error(`unknown business model '${model}'`);
  // `_base` is the industry-agnostic storefront: only catalog/common/ content resolves for it.
  // It is what an "Other / my industry isn't listed" answer falls back to.
  const isBase = industry === "_base";
  const vertical = isBase ? null : catalog.verticals[industry];

  // A vertical that explicitly does not support this model is a refusal, not a derivation.
  if (vertical && !vertical.supported_models.includes(model)) {
    return {
      status: "unsupported",
      industry,
      model,
      supported_models: vertical.supported_models,
      capabilities: [],
      gaps: [],
      capability_count: 0,
      p1_count: 0,
    };
  }

  const effective = effectiveModels(model, models);

  const picked = catalog.capabilities
    .filter((c) => c.status === "published" && c.visibility === "public")
    .filter((c) => (isBase ? (c.industry ?? []).includes("*") : appliesToIndustry(c.industry, industry)))
    .filter((c) => appliesToModel(c.business_models, effective))
    .map((c) => ({
      ...c,
      // "native" = the capability names this exact model. Otherwise it arrived by inheritance
      // and the developer is told so, rather than being sold a B2C spec as B2B2C content.
      derivation: (c.business_models ?? []).includes(model) || (c.business_models ?? []).includes("*")
        ? "native"
        : "derived",
      scenarios: (c.scenarios ?? []).filter((s) => appliesToModel(s.business_models, effective)),
      components_included: (c.components ?? []).filter((k) => appliesToModel(k.business_models, effective)),
      components_excluded: (c.components ?? []).filter((k) => !appliesToModel(k.business_models, effective)),
    }));

  // Global epics (the base storefront's page groups) come first; a vertical's own epics are
  // industry deltas layered on top. Ordering is stable across every combination.
  const epicOrder = [
    ...(catalog.global_epics ?? []).map((e) => e.slug),
    ...(vertical?.epics ?? []).map((e) => e.slug),
  ];
  picked.sort((a, b) => {
    const ea = epicOrder.indexOf(a.epic);
    const eb = epicOrder.indexOf(b.epic);
    if (ea !== eb) return (ea < 0 ? 99 : ea) - (eb < 0 ? 99 : eb);
    const pa = PRIORITY_ORDER[a.priority] ?? 9;
    const pb = PRIORITY_ORDER[b.priority] ?? 9;
    if (pa !== pb) return pa - pb;
    return a.id.localeCompare(b.id);
  });

  // Gaps: what this business model structurally needs that no published capability covers.
  const covered = new Set(picked.map((c) => c.id.split(".").pop()));
  const gaps = (models[model].gap_capabilities ?? []).filter((g) => !covered.has(g));

  const native = picked.filter((c) => c.derivation === "native").length;
  const derived = picked.length - native;

  const epics = [...(catalog.global_epics ?? []), ...(vertical?.epics ?? [])]
    .map((e) => ({ slug: e.slug, title: e.title, count: picked.filter((c) => c.epic === e.slug).length }))
    .filter((e) => e.count > 0);

  return {
    status: "ok",
    industry,
    model,
    match: derived === 0 && gaps.length === 0 ? "exact" : "derived",
    capabilities: picked,
    native,
    derived,
    gaps,
    epics,
    capability_count: picked.length,
    p1_count: picked.filter((c) => c.priority === "P1").length,
    open_questions: picked.flatMap((c) => c.open_questions ?? []),
    journeys: [...new Set(picked.flatMap((c) => c.journeys ?? []))].sort(),
    skills: [...new Set(picked.flatMap((c) => [c.skill, ...(c.supporting_skills ?? [])]).filter(Boolean))],
  };
}
