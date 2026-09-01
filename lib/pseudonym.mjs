/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Deriving a stable, non-reversible handle for a respondent.
//
// There is deliberately NO map file. The mapping is a function of the key and GitHub's own record
// of who filed which issue, so reversing it needs both the key and read access to the private
// repo's issues — two independent controls, and nothing that can be committed by accident.
//
// Two decisions worth stating, because both are easy to get wrong:
//
//   * Hash the numeric user id, never the login. GitHub releases a username after a rename, so
//     hashing the login both changes a colleague's handle when they rename AND hands their old
//     handle to whoever claims the freed name. The numeric id survives a rename.
//   * The epoch is bound INTO the MAC input, not just prefixed to the output, so reusing a key
//     across epochs cannot silently produce the same handle twice.
//
// Be honest about the limit: the input space is a few dozen known colleagues, so a leaked key is
// instant, total reversal. The gain over a stored map is not cryptographic strength — it is that
// reversal takes a deliberate act by a key holder rather than reading a file.

import crypto from "node:crypto";

// Crockford base32: no i, l, o or u, so a handle can be read aloud in a review without ambiguity.
const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

export const KEY_ENV = "COLLECTOR_PSEUDONYM_KEY";

/** 32 bytes of base64, for `COLLECTOR_PSEUDONYM_KEY`. Print once, store in the team vault. */
export const generateKey = () => crypto.randomBytes(32).toString("base64");

/**
 * @param {string|number} githubUserId the numeric user id (GraphQL `databaseId`), not the login
 * @param {{key: string, epoch?: number, chars?: number}} opts key is base64, >= 32 bytes
 * @returns {string} e.g. `p1-drnpn89`
 *
 * 7 characters is 35 bits. Over a lifetime of even 600 distinct respondents the chance of two
 * sharing a handle is about 5e-6; at 4 characters it would be ~2%, and a silent merge of two
 * people's answers is exactly the failure that must not happen quietly.
 */
export function pseudonym(githubUserId, { key, epoch = 1, chars = 7 } = {}) {
  if (!key) throw new Error(`${KEY_ENV} is not set`);
  let raw;
  try {
    raw = Buffer.from(key, "base64");
  } catch {
    throw new Error(`${KEY_ENV} must be base64`);
  }
  if (raw.length < 32) throw new Error(`${KEY_ENV} must decode to at least 32 bytes, got ${raw.length}`);
  if (githubUserId === null || githubUserId === undefined || githubUserId === "") {
    throw new Error("a numeric GitHub user id is required to derive a pseudonym");
  }

  const mac = crypto.createHmac("sha256", raw)
    .update(`gh:user:e${epoch}:${githubUserId}`, "utf8")
    .digest();

  let bits = 0n;
  for (const b of mac.subarray(0, 5)) bits = (bits << 8n) | BigInt(b);
  bits >>= BigInt(40 - chars * 5);
  let token = "";
  for (let i = chars - 1; i >= 0; i--) token += ALPHABET[Number((bits >> BigInt(i * 5)) & 31n)];
  return `p${epoch}-${token}`;
}

/**
 * Detect two respondents colliding onto one handle. An accounting failure rather than a privacy
 * one, but it silently merges two people's answers, so it must be loud. Never stores an id.
 * @param {Array<{id: string|number, handle: string}>} seen
 * @returns {string[]} handles claimed by more than one id
 */
export function collisions(seen) {
  const byHandle = new Map();
  for (const { id, handle } of seen) {
    if (!byHandle.has(handle)) byHandle.set(handle, new Set());
    byHandle.get(handle).add(String(id));
  }
  return [...byHandle.entries()].filter(([, ids]) => ids.size > 1).map(([h]) => h);
}
