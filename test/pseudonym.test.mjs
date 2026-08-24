import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { pseudonym, collisions, generateKey, KEY_ENV } from "../lib/pseudonym.mjs";

const key = crypto.createHash("sha256").update("fixed test key").digest("base64");

test("the same person always gets the same handle", () => {
  assert.equal(pseudonym(281523, { key }), pseudonym(281523, { key }));
  assert.equal(pseudonym(281523, { key }), pseudonym("281523", { key }), "id type must not matter");
});

test("the handle is shaped to be readable aloud", () => {
  const h = pseudonym(281523, { key });
  assert.match(h, /^p1-[0-9abcdefghjkmnpqrstvwxyz]{7}$/);
  assert.ok(!/[ilou]/.test(h.slice(3)), "Crockford base32 excludes i, l, o and u");
});

test("different people get different handles", () => {
  const handles = new Set([1, 2, 3, 42, 281523, 999999].map((id) => pseudonym(id, { key })));
  assert.equal(handles.size, 6);
});

test("a different key gives a different handle for the same person", () => {
  const other = crypto.createHash("sha256").update("another key").digest("base64");
  assert.notEqual(pseudonym(281523, { key }), pseudonym(281523, { key: other }));
});

test("an epoch bump changes every handle, and is bound into the MAC not just the prefix", () => {
  const e1 = pseudonym(281523, { key, epoch: 1 });
  const e2 = pseudonym(281523, { key, epoch: 2 });
  assert.notEqual(e1.slice(3), e2.slice(3), "the token itself must change, not only the prefix");
  assert.ok(e1.startsWith("p1-") && e2.startsWith("p2-"));
});

test("a weak or missing key is refused rather than silently accepted", () => {
  assert.throws(() => pseudonym(1, {}), new RegExp(KEY_ENV));
  assert.throws(() => pseudonym(1, { key: Buffer.alloc(16).toString("base64") }), /at least 32 bytes/);
  assert.throws(() => pseudonym(null, { key }), /numeric GitHub user id is required/);
});

test("a generated key is strong enough for its own check", () => {
  assert.doesNotThrow(() => pseudonym(1, { key: generateKey() }));
});

test("two people landing on one handle is detected, and no id is retained", () => {
  assert.deepEqual(collisions([{ id: 1, handle: "p1-aaa" }, { id: 2, handle: "p1-bbb" }]), []);
  assert.deepEqual(collisions([{ id: 1, handle: "p1-aaa" }, { id: 2, handle: "p1-aaa" }]), ["p1-aaa"]);
  // The same person appearing twice in a round is normal, not a collision.
  assert.deepEqual(collisions([{ id: 1, handle: "p1-aaa" }, { id: "1", handle: "p1-aaa" }]), []);
});

test("35 bits is enough that a realistic programme never collides", () => {
  const seen = new Map();
  for (let id = 1; id <= 2000; id++) {
    const h = pseudonym(id, { key });
    assert.ok(!seen.has(h), `collision at id ${id} against ${seen.get(h)}`);
    seen.set(h, id);
  }
});
