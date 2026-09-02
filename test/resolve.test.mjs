/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveCombination, effectiveModels } from "../lib/resolve.mjs";

const catalog = {
  business_models: {
    B2C: { label: "B2C", inherits: [] },
    B2B: { label: "B2B", inherits: [] },
    B2B2C: { label: "B2B2C", inherits: ["B2C"], gap_capabilities: ["seller-onboarding", "payout"] },
  },
  verticals: {
    grocery: {
      supported_models: ["B2C", "B2B2C"],
      epics: [{ slug: "first", title: "First" }, { slug: "second", title: "Second" }],
    },
  },
  capabilities: [
    cap({ id: "grocery.a", business_models: ["B2C"], epic: "second", priority: "P2" }),
    cap({ id: "grocery.b", business_models: ["B2B2C"], epic: "first", priority: "P1" }),
    cap({ id: "grocery.c", business_models: ["B2C"], epic: "first", priority: "P1" }),
    cap({ id: "grocery.payout", business_models: ["B2B2C"], epic: "second", priority: "P3" }),
    cap({ id: "grocery.draft", business_models: ["B2C"], epic: "first", status: "candidate" }),
    cap({ id: "grocery.secret", business_models: ["B2C"], epic: "first", visibility: "internal" }),
    cap({ id: "other.x", industry: ["telecom"], business_models: ["B2C"], epic: "first" }),
  ],
};

function cap(o) {
  return {
    industry: ["grocery"], status: "published", visibility: "public", priority: "P1",
    scenarios: [{ id: "s", when: "w", then: "t" }], components: [], ...o,
  };
}

test("inheritance is transitive and includes the model itself", () => {
  assert.deepEqual(effectiveModels("B2B2C", catalog.business_models).sort(), ["B2B2C", "B2C"]);
  assert.deepEqual(effectiveModels("B2C", catalog.business_models), ["B2C"]);
});

test("a model the vertical does not support is refused, not derived", () => {
  const r = resolveCombination({ industry: "grocery", model: "B2B", catalog });
  assert.equal(r.status, "unsupported");
  assert.deepEqual(r.supported_models, ["B2C", "B2B2C"]);
  assert.equal(r.capability_count, 0);
});

test("candidate, internal and other-industry capabilities never resolve", () => {
  const ids = resolveCombination({ industry: "grocery", model: "B2C", catalog }).capabilities.map((c) => c.id);
  assert.ok(!ids.includes("grocery.draft"), "candidate leaked");
  assert.ok(!ids.includes("grocery.secret"), "internal leaked");
  assert.ok(!ids.includes("other.x"), "other industry leaked");
});

test("B2C is exact; ordering is epic, then priority, then id", () => {
  const r = resolveCombination({ industry: "grocery", model: "B2C", catalog });
  assert.equal(r.match, "exact");
  assert.deepEqual(r.capabilities.map((c) => c.id), ["grocery.c", "grocery.a"]);
  assert.equal(r.derived, 0);
});

test("B2B2C inherits B2C content, marks it derived, and reports the real gaps", () => {
  const r = resolveCombination({ industry: "grocery", model: "B2B2C", catalog });
  assert.equal(r.match, "derived");
  assert.equal(r.native, 2, "b and payout are native to B2B2C");
  assert.equal(r.derived, 2, "a and c arrived via inheritance from B2C");
  // 'payout' is covered by grocery.payout, so only seller-onboarding remains a gap.
  assert.deepEqual(r.gaps, ["seller-onboarding"]);
});

test("scenarios and components are narrowed per model, and exclusions are reported", () => {
  const c = {
    ...cap({ id: "grocery.z", business_models: ["B2C", "B2B2C"], epic: "first" }),
    scenarios: [
      { id: "always", when: "w", then: "t" },
      { id: "marketplace-only", business_models: ["B2B2C"], when: "w", then: "t" },
    ],
    components: [
      { name: "shared", data_source: "CACHED" },
      { name: "marketplace", data_source: "MIDDLEWARE", business_models: ["B2B2C"] },
    ],
  };
  const cat = { ...catalog, capabilities: [c] };
  const b2c = resolveCombination({ industry: "grocery", model: "B2C", catalog: cat }).capabilities[0];
  assert.deepEqual(b2c.scenarios.map((s) => s.id), ["always"]);
  assert.deepEqual(b2c.components_included.map((k) => k.name), ["shared"]);
  assert.deepEqual(b2c.components_excluded.map((k) => k.name), ["marketplace"]);

  const mkt = resolveCombination({ industry: "grocery", model: "B2B2C", catalog: cat }).capabilities[0];
  assert.deepEqual(mkt.scenarios.map((s) => s.id), ["always", "marketplace-only"]);
  assert.equal(mkt.components_excluded.length, 0);
});

// ---------------------------------------------------------------------------------------------
// One test against the real repo, guarding a class of bug rather than a value: loadCatalog used to
// read a hardcoded list of subdirectories under catalog/common/capabilities, so a capability filed
// in a new folder was silently never loaded — no error, no warning, just absent from every render.
// ---------------------------------------------------------------------------------------------
test("every capability YAML on disk is loaded, whatever folder it is filed in", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const { loadCatalog } = await import("../lib/catalog.mjs");
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

  const onDisk = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".yaml") && e.name !== "vertical.yaml") {
        onDisk.push(path.relative(root, p));
      }
    }
  };
  for (const d of ["catalog/common/capabilities", "catalog/verticals"]) {
    const abs = path.join(root, d);
    if (fs.existsSync(abs)) walk(abs);
  }
  // Rights records live beside capabilities but are not capabilities.
  const expected = onDisk.filter((p) => !p.includes("/sources/")).sort();
  const loaded = loadCatalog(root).capabilities.map((c) => c._file).sort();
  assert.deepEqual(loaded, expected);
});

// ---------------------------------------------------------------------------------------------
// SIDES (ADR 8). A paired model is TWO storefronts with different inheritance roots. The fixture
// above deliberately keeps a sideless B2B2C, because "a model with no sides resolves exactly as
// it did before" is itself the contract that stops this change touching B2C and B2B.
// ---------------------------------------------------------------------------------------------

const paired = {
  business_models: {
    B2C: { label: "B2C", inherits: [] },
    B2B: { label: "B2B", inherits: [] },
    B2B2C: {
      label: "B2B2C",
      sides: {
        "seller-portal": { gap_capabilities: ["commission"] },
        "consumer-storefront": {},
      },
    },
  },
  sides: {
    "seller-portal": { label: "The seller portal", inherits: ["B2B"], gap_capabilities: ["onboarding"] },
    "consumer-storefront": { label: "The shopper storefront", inherits: ["B2C"], gap_capabilities: ["directory"] },
  },
  verticals: {},
  capabilities: [
    cap({ id: "base.b2b-only", industry: ["*"], business_models: ["B2B"], epic: "first" }),
    cap({ id: "base.b2c-only", industry: ["*"], business_models: ["B2C"], epic: "first" }),
    cap({ id: "base.everywhere", industry: ["*"], business_models: ["*"], epic: "first" }),
    cap({
      id: "base.portal-only", industry: ["*"], business_models: ["B2B2C"],
      sides: ["seller-portal"], epic: "first",
    }),
    cap({ id: "base.commission", industry: ["*"], business_models: ["B2B2C"], sides: ["seller-portal"], epic: "first" }),
  ],
};

test("a paired model refuses to resolve without a side, rather than picking one", () => {
  assert.throws(
    () => resolveCombination({ industry: "_base", model: "B2B2C", catalog: paired }),
    /pair of storefronts/,
    "defaulting here is what handed a seller-portal build 30 consumer specs",
  );
});

test("an unknown side, and a side on a single-storefront model, both throw", () => {
  assert.throws(
    () => resolveCombination({ industry: "_base", model: "B2B2C", side: "nope", catalog: paired }),
    /no side 'nope'/,
  );
  assert.throws(
    () => resolveCombination({ industry: "_base", model: "B2B", side: "seller-portal", catalog: paired }),
    /has no sides/,
  );
});

test("each side inherits from its OWN root, which is the whole point of the change", () => {
  assert.deepEqual(
    effectiveModels("B2B2C", paired.business_models, "seller-portal", paired.sides).sort(),
    ["B2B", "B2B2C"],
  );
  assert.deepEqual(
    effectiveModels("B2B2C", paired.business_models, "consumer-storefront", paired.sides).sort(),
    ["B2B2C", "B2C"],
  );

  const portal = resolveCombination({ industry: "_base", model: "B2B2C", side: "seller-portal", catalog: paired });
  const shop = resolveCombination({ industry: "_base", model: "B2B2C", side: "consumer-storefront", catalog: paired });
  assert.ok(portal.capabilities.map((c) => c.id).includes("base.b2b-only"), "the portal must reach B2B content");
  assert.ok(!portal.capabilities.map((c) => c.id).includes("base.b2c-only"));
  assert.ok(shop.capabilities.map((c) => c.id).includes("base.b2c-only"));
  assert.ok(!shop.capabilities.map((c) => c.id).includes("base.b2b-only"));
});

test("a capability scoped to one side is absent from the other, not merely derived", () => {
  const shop = resolveCombination({ industry: "_base", model: "B2B2C", side: "consumer-storefront", catalog: paired });
  assert.ok(!shop.capabilities.map((c) => c.id).includes("base.portal-only"),
    "an untagged side default would have put commission content on a consumer storefront");
  const portal = resolveCombination({ industry: "_base", model: "B2B2C", side: "seller-portal", catalog: paired });
  const it = portal.capabilities.find((c) => c.id === "base.portal-only");
  assert.equal(it.derivation, "native", "it names both the model and this side");
});

test("scenarios and components narrow by side as well as by model", () => {
  const c = {
    ...cap({ id: "base.z", industry: ["*"], business_models: ["B2B2C"], sides: ["seller-portal", "consumer-storefront"], epic: "first" }),
    scenarios: [
      { id: "both", when: "w", then: "t" },
      { id: "portal-only", sides: ["seller-portal"], when: "w", then: "t" },
    ],
    components: [
      { name: "shared", data_source: "CACHED" },
      { name: "payout", data_source: "MIDDLEWARE", sides: ["seller-portal"] },
    ],
  };
  const cat = { ...paired, capabilities: [c] };
  const shop = resolveCombination({ industry: "_base", model: "B2B2C", side: "consumer-storefront", catalog: cat }).capabilities[0];
  assert.deepEqual(shop.scenarios.map((s) => s.id), ["both"]);
  assert.deepEqual(shop.components_included.map((k) => k.name), ["shared"]);
  assert.deepEqual(shop.components_excluded.map((k) => k.name), ["payout"]);

  const portal = resolveCombination({ industry: "_base", model: "B2B2C", side: "seller-portal", catalog: cat }).capabilities[0];
  assert.deepEqual(portal.scenarios.map((s) => s.id), ["both", "portal-only"]);
  assert.equal(portal.components_excluded.length, 0);
});

test("gaps are the side's shared list unioned with the model's delta, minus what is covered", () => {
  const portal = resolveCombination({ industry: "_base", model: "B2B2C", side: "seller-portal", catalog: paired });
  // side declares `onboarding`; B2B2C adds `commission` for this side; base.commission covers
  // the latter by id, so only onboarding is still missing.
  assert.deepEqual(portal.gaps, ["onboarding"]);
  const shop = resolveCombination({ industry: "_base", model: "B2B2C", side: "consumer-storefront", catalog: paired });
  assert.deepEqual(shop.gaps, ["directory"], "the other side's gaps must not leak across");
  assert.equal(shop.side_label, "The shopper storefront");
});
