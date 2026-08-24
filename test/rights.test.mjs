import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRights } from "../lib/rights.mjs";

const cap = (o = {}) => ({
  status: "published",
  visibility: "public",
  provenance: { source: "authored", contributors: ["a@b.c"] },
  ...o,
});
const rec = (o = {}) => ({ _file: "sources/x.provenance.yaml", uri: "https://dms/x", rights: { basis: "owned" }, ...o });

test("in-house material needs no rights record", () => {
  assert.deepEqual(checkRights(cap(), null), []);
  assert.deepEqual(checkRights(cap({ provenance: { source: "collector" } }), null), []);
});

test("a rights record for in-house material is reported as pointless, not ignored", () => {
  // This is the exact dead weight that produced a permanently-closed gate once already.
  const errs = checkRights(cap(), rec());
  assert.equal(errs.length, 1);
  assert.match(errs[0], /needs no rights record/);
});

test("material we did not author requires a record", () => {
  const errs = checkRights(cap({ provenance: { source: "pdf" } }), null);
  assert.match(errs[0], /requires a rights record, and none was found/);
});

test("owned and public need a basis and nothing more — no clearance to chase", () => {
  for (const basis of ["owned", "public"]) {
    const errs = checkRights(cap({ provenance: { source: "pdf" } }), rec({ rights: { basis } }));
    assert.deepEqual(errs, [], `${basis} should publish with no named clearer`);
  }
  // ...and without a uri either, since nothing has to be citable to a third party.
  assert.deepEqual(
    checkRights(cap({ provenance: { source: "pdf" } }), { _file: "s.yaml", rights: { basis: "owned" } }),
    [],
  );
});

test("licensed material requires a named clearance and a citable uri", () => {
  const noClearer = checkRights(cap({ provenance: { source: "pdf" } }), rec({ rights: { basis: "licensed" } }));
  assert.equal(noClearer.length, 1);
  assert.match(noClearer[0], /requires cleared_by and cleared_at/);

  const noUri = checkRights(
    cap({ provenance: { source: "pdf" } }),
    { _file: "s.yaml", rights: { basis: "licensed", cleared_by: "legal@x", cleared_at: "2026-08-21" } },
  );
  assert.equal(noUri.length, 1);
  assert.match(noUri[0], /requires a citable uri/);

  const ok = checkRights(
    cap({ provenance: { source: "pdf" } }),
    rec({ rights: { basis: "licensed", cleared_by: "legal@x", cleared_at: "2026-08-21" } }),
  );
  assert.deepEqual(ok, []);
});

test("customer-nda forces internal visibility", () => {
  const cleared = { basis: "customer-nda", cleared_by: "legal@x", cleared_at: "2026-08-21" };
  const pub = checkRights(cap({ provenance: { source: "customer-project" } }), rec({ rights: cleared }));
  assert.equal(pub.length, 1);
  assert.match(pub[0], /permits visibility 'internal' at most, got 'public'/);

  const partner = checkRights(
    cap({ visibility: "partner", provenance: { source: "customer-project" } }), rec({ rights: cleared }));
  assert.match(partner[0], /at most/, "partner is still too permissive for an NDA");

  const internal = checkRights(
    cap({ visibility: "internal", provenance: { source: "customer-project" } }), rec({ rights: cleared }));
  assert.deepEqual(internal, []);
});

test("a fair-use extract may reach partner but never public", () => {
  const cleared = { basis: "fair-use-extract", cleared_by: "legal@x", cleared_at: "2026-08-21" };
  assert.match(
    checkRights(cap({ provenance: { source: "pdf" } }), rec({ rights: cleared }))[0],
    /permits visibility 'partner' at most/,
  );
  assert.deepEqual(
    checkRights(cap({ visibility: "partner", provenance: { source: "pdf" } }), rec({ rights: cleared })),
    [],
  );
});

test("an unknown basis is refused rather than treated as permissive", () => {
  const errs = checkRights(cap({ provenance: { source: "pdf" } }), rec({ rights: { basis: "probably-fine" } }));
  assert.equal(errs.length, 1);
  assert.match(errs[0], /unknown rights basis/);
});

test("a REPLACE placeholder blocks publication", () => {
  const errs = checkRights(
    cap({ provenance: { source: "pdf" } }),
    rec({ uri: "REPLACE-WITH-DMS-URI", rights: { basis: "owned" } }),
  );
  assert.match(errs[0], /unresolved REPLACE token/);
});

test("nothing is gated until a capability is actually published", () => {
  assert.deepEqual(checkRights(cap({ status: "candidate", provenance: { source: "pdf" } }), null), []);
});
