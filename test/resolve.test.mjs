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
