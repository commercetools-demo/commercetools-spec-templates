/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// (industry x business model x side) -> the ordered capability set, plus what is missing.
//
// Pure functions over a plain catalog object so they are unit-testable without touching disk,
// and so `ctsx build` and any future consumer resolve identically. There is exactly one
// implementation of this rule; a second one would drift.
//
// SIDES (ADR 8). A B2B2X model is a PAIR of storefronts, and the two sides inherit from different
// roots: the seller portal from B2B, the consumer storefront from B2C. So `inherits` lives on the
// side, not on the model. A model with no `sides` — B2C, B2B — resolves exactly as it did before,
// and `side` must then be absent.

/** The side ids a model declares, in declaration order. Empty for a single-storefront model. */
export function sidesOf(model, models) {
  return Object.keys(models?.[model]?.sides ?? {});
}

/**
 * A model's own tag plus everything it inherits, transitively.
 *
 * With a side, the walk is seeded from that SIDE's inherits — which is the entire point of the
 * sides model: `B2B2C x seller-portal` must reach the 21 published [B2B, B2B2B] capabilities, and
 * `B2B2C x consumer-storefront` must not.
 *
 * The 2-argument form is still valid and is what a sideless model uses.
 */
export function effectiveModels(model, models, side = null, sides = {}) {
  const seen = new Set();
  const walk = (m) => {
    if (seen.has(m) || !m) return;
    seen.add(m);
    for (const parent of models[m]?.inherits ?? []) walk(parent);
  };
  walk(model);
  // A side's roots are walked as models, so a root's own `inherits` still applies.
  if (side) for (const root of sides[side]?.inherits ?? []) walk(root);
  return [...seen];
}

const appliesToModel = (tags, effective) =>
  !tags || tags.length === 0 || tags.includes("*") || tags.some((t) => effective.includes(t));

const appliesToIndustry = (tags, industry) =>
  !tags || tags.length === 0 || tags.includes("*") || tags.includes(industry);

/**
 * Absent `sides` means every side, mirroring how an absent `business_models` means every model.
 * That default is convenient and dangerous in equal measure — it is why lint requires `sides` on
 * any capability naming a paired model — but for a model with no sides at all it is simply moot.
 */
const appliesToSide = (tags, side) =>
  !side || !tags || tags.length === 0 || tags.includes("*") || tags.includes(side);

const PRIORITY_ORDER = { P1: 0, P2: 1, P3: 2 };

/**
 * @returns {{
 *   status: 'ok'|'unsupported', match: 'exact'|'derived', capabilities: object[],
 *   side: string|null, side_label: string|null,
 *   native: number, derived: number, gaps: string[], epics: object[],
 *   capability_count: number, p1_count: number, open_questions: string[], skills: string[]
 * }}
 */
export function resolveCombination({ industry, model, side = null, catalog }) {
  const models = catalog.business_models;
  const sideDefs = catalog.sides ?? {};
  if (!models[model]) throw new Error(`unknown business model '${model}'`);

  // The single most important guard in this file. A paired model resolved WITHOUT a side used to
  // return the consumer set — so a developer building a seller portal was handed 30 consumer page
  // specs and told it was an exact match. Refusing is the only correct answer; defaulting just
  // moves the wrong bundle behind a choice nobody made.
  const declared = sidesOf(model, models);
  if (declared.length) {
    if (!side) {
      throw new Error(
        `${model} is a pair of storefronts — resolving it needs a side: ${declared.join(" | ")}`);
    }
    if (!declared.includes(side)) {
      throw new Error(`${model} has no side '${side}'. Sides: ${declared.join(" | ")}`);
    }
  } else if (side) {
    throw new Error(`${model} is a single storefront and has no sides, but side '${side}' was given`);
  }

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
      side,
      supported_models: vertical.supported_models,
      capabilities: [],
      gaps: [],
      capability_count: 0,
      p1_count: 0,
    };
  }

  const effective = effectiveModels(model, models, side, sideDefs);

  const picked = catalog.capabilities
    .filter((c) => c.status === "published" && c.visibility === "public")
    .filter((c) => (isBase ? (c.industry ?? []).includes("*") : appliesToIndustry(c.industry, industry)))
    .filter((c) => appliesToModel(c.business_models, effective))
    // A capability that names this model but excludes this side is not "derived", it is absent.
    .filter((c) => appliesToSide(c.sides, side))
    .map((c) => ({
      ...c,
      // "native" = the capability names this exact model AND this side. Otherwise it arrived by
      // inheritance and the developer is told so, rather than being sold a B2C spec as B2B2C
      // content — or a seller-portal spec as a storefront one.
      derivation:
        ((c.business_models ?? []).includes(model) || (c.business_models ?? []).includes("*")) &&
        (!side || !c.sides?.length || c.sides.includes(side) || c.sides.includes("*"))
          ? "native"
          : "derived",
      scenarios: (c.scenarios ?? [])
        .filter((s) => appliesToModel(s.business_models, effective))
        .filter((s) => appliesToSide(s.sides, side)),
      components_included: (c.components ?? [])
        .filter((k) => appliesToModel(k.business_models, effective) && appliesToSide(k.sides, side)),
      components_excluded: (c.components ?? [])
        .filter((k) => !(appliesToModel(k.business_models, effective) && appliesToSide(k.sides, side))),
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

  // Gaps: what this combination structurally needs that no published capability covers. For a
  // sided model that is the side's shared list UNIONED with this model's delta for that side —
  // the shared list is declared once so the two models cannot drift apart on it.
  const declaredGaps = side
    ? [...(sideDefs[side]?.gap_capabilities ?? []),
       ...(models[model].sides[side]?.gap_capabilities ?? [])]
    : (models[model].gap_capabilities ?? []);
  const covered = new Set(picked.map((c) => c.id.split(".").pop()));
  const gaps = [...new Set(declaredGaps)].filter((g) => !covered.has(g));

  const native = picked.filter((c) => c.derivation === "native").length;
  const derived = picked.length - native;

  const epics = [...(catalog.global_epics ?? []), ...(vertical?.epics ?? [])]
    .map((e) => ({ slug: e.slug, title: e.title, count: picked.filter((c) => c.epic === e.slug).length }))
    .filter((e) => e.count > 0);

  return {
    status: "ok",
    industry,
    model,
    side,
    side_label: side ? (sideDefs[side]?.label ?? side) : null,
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
