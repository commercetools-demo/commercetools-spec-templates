// The publish gate for redistribution rights.
//
// Its only job is to stop us publishing material we have no right to publish. That is a real
// concern for a licensed report, a fair-use extract, or anything from a customer engagement —
// and no concern at all for a document commercetools wrote itself. So a named clearance is
// demanded only where somebody's permission is actually involved.
//
// Pure so it can be tested directly; `ctsx lint --strict` is the only caller.

export const BASES = ["owned", "public", "licensed", "fair-use-extract", "customer-nda"];

/** Bases that describe someone else's material, and therefore need a recorded clearance. */
const NEEDS_CLEARANCE = new Set(["licensed", "fair-use-extract", "customer-nda"]);

/** The most permissive visibility each basis allows. */
const MAX_VISIBILITY = { "customer-nda": "internal", "fair-use-extract": "partner" };
const VISIBILITY_RANK = { internal: 0, partner: 1, public: 2 };

/**
 * @param {{status: string, visibility: string, provenance?: object}} capability
 * @param {{uri?: string, rights?: object, _file?: string}|null} source rights record, if any
 * @returns {string[]} human-readable errors; empty means publishable
 */
export function checkRights(capability, source) {
  const errors = [];
  const at = source?._file ?? "the rights record";
  if (capability.status !== "published") return errors; // only publishing is gated

  const src = capability.provenance?.source;
  // In-house and collector-sourced material needs no rights record at all.
  if (!src || src === "authored" || src === "collector") {
    if (source) errors.push(`provenance.source '${src}' needs no rights record, but ${at} exists`);
    return errors;
  }
  if (!source) {
    errors.push(`provenance.source '${src}' requires a rights record, and none was found`);
    return errors;
  }

  const basis = source.rights?.basis;
  if (!BASES.includes(basis)) {
    errors.push(`unknown rights basis '${basis}' in ${at}. Valid: ${BASES.join(", ")}`);
    return errors;
  }

  if (NEEDS_CLEARANCE.has(basis)) {
    if (!source.rights?.cleared_by || !source.rights?.cleared_at) {
      errors.push(`rights basis '${basis}' requires cleared_by and cleared_at in ${at}`);
    }
    if (!source.uri) errors.push(`rights basis '${basis}' requires a citable uri in ${at}`);
  }

  const cap = MAX_VISIBILITY[basis];
  if (cap && VISIBILITY_RANK[capability.visibility] > VISIBILITY_RANK[cap]) {
    errors.push(
      `rights basis '${basis}' permits visibility '${cap}' at most, got '${capability.visibility}'`,
    );
  }

  if (JSON.stringify({ p: capability.provenance, s: source }).includes("REPLACE")) {
    errors.push(`unresolved REPLACE token in provenance or ${at}`);
  }
  return errors;
}
