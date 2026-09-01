# 8. B2B2X is a pair of storefronts, modelled as sides

Status: **proposed** · 2026-08-26 · awaiting decision · would supersede the B2B2X modelling in
`taxonomy/business-models.yaml` (schema_version 1)

## Context

The taxonomy models B2B2C as `inherits: [B2C]` plus a flat `gap_capabilities` list, B2B2B as
`inherits: [B2B]` plus its own, and `resolveCombination` returns **one bundle per (industry,
model)**. That is wrong, and it is wrong in a way that ships the wrong specs rather than refusing.

B2B2X is a **pair of storefronts**: the seller buying from the brand and running their own shop,
and that seller's own customers buying from them. Two deployments, two sessions, two identity
populations.

Ten agents surveyed the two reference implementations — `commercetools-demo/b2b2c-starter` and
`commercetools-demo/b2b2b-starter`, 197 page routes and 246 API handlers across four Next.js apps —
and produced 164 candidate capabilities, of which 118 were judged normative. Two adversarial passes
then attacked the result for completeness and for requirement quality. What follows is what the
evidence forced, including three places it contradicted the initial design.

### The defect this fixes

`_base|B2B2C` today resolves **30 capabilities — identical to B2C, zero native**, because B2B2C
inherits from B2C only. Meanwhile 21 published capabilities are tagged `[B2B, B2B2B]`, and the
seller portal in *both* starters implements every one of them verbatim: contract pricing, approval
workflows, quote negotiation, role administration, company profile, the nine B2B journeys.

So a developer building a B2B2C seller portal is handed 30 consumer page specs and told it is an
exact match. Moving `inherits` from the model onto the *side* resolves all 21 with **no capability
authored and no file edited**. That single move is the highest-value change in the analysis.

## Decision

Declare **sides** in a new top-level block, and have each model reference side ids rather than
carrying `inherits` itself.

```yaml
schema_version: 2
sides:
  seller-portal:
    label: The portal your sellers sign in to — where they buy from you and run the store they sell from
    inherits: [B2B]
    supported_models: [B2B2C, B2B2B]
    gap_capabilities: [seller-onboarding, seller-scoped-assortment, ...]   # shared by both models
  consumer-storefront:
    label: The shop your sellers' own customers buy from
    inherits: [B2C]
    supported_models: [B2B2C]
    gap_capabilities: [...]
  business-storefront:
    label: The shop your sellers' business customers buy from
    inherits: [B2C, B2B]
    supported_models: [B2B2B]
    gap_capabilities: [...]
business_models:
  B2C: { ... }                      # no `sides:` key — resolves exactly as today
  B2B: { ... }                      # ditto; a model without sides is the compatibility hinge
  B2B2C:
    sides:
      seller-portal:        { gap_capabilities: [commission-and-payout, brand-guardrails, ...] }
      consumer-storefront:  { gap_capabilities: [seller-directory, single-seller-cart, ...] }
  B2B2B:
    sides:
      seller-portal:        { gap_capabilities: [supplier-account-statement, buyer-credit-standing, ...] }
      business-storefront:  { gap_capabilities: [buying-capacity-resolution, two-owner-cart, ...] }
```

A combination becomes **(industry × model × side)**. `cts apply --model B2B2C` with no `--side`
**writes nothing and exits 2**, naming both sides. It never defaults.

### Three findings that changed the design

**1. The upstream side is ONE shared side, not one per model.** Diffing the two seller portals: 63
pages vs 65, 58 shared of which **52 are byte-identical**; 110 API routes vs 111, 103 shared of
which **99 are byte-identical**. `dealer/lib/nav-items.ts` declares the same three relationships in
both repos — the customers I sell to, the store I run, my relationship with my supplier — and every
model-specific route is a *leaf inside one of those three sections*, behind a feature flag that
404s when off. The axis of difference is the **compensation model**, not the capability set: B2B2C
upstream is an agent earning commission on brand-fulfilled sales; B2B2B upstream is a distributor
buying stock on credit at its own margin.

The decisive argument is negative. The two forks **have already drifted**: four shared API routes
differ, and in every case the marketplace fork carries a fix the distributor fork lacks — including
a quote-request ship-to fix where a country-only placeholder address cannot match a state-scoped tax
rate. None of those are model differences; they are maintenance lag between two copies of one
capability set. Two independent upstream definitions in the taxonomy would reproduce that failure.
**One shared definition cannot drift.**

**2. `downstream(B2B2B)` is not "B2B + tweaks".** This was the initial assumption and it is wrong. A
file-by-file diff of the two consumer apps returns **zero changed lines** for every shopping and
account page — cart, checkout and its steps, confirmation, PLP, category, PDP, search, all eight
`/account/*` pages — and for `components/{cart,checkout,product,account}`. The B2B-ness is three
additions on top: a capacity resolution at sign-in, a dispatch behind the unchanged basket UI
(`resolveCartMode(session)` → `plain | associate`), and 19 pages under `/[locale]/business/*`
unlocked when the signed-in shopper turns out to be an associate. So it `inherits: [B2C, B2B]`, and
the B2B-ness is a **per-session branch, not a different storefront**.

**3. The seller portal is two products in one deployment.** Its own demo script says so: "a Shop tab
and a Dashboard tab, and they are different products with the same header." The Shop half is a B2B
storefront; the Manage half is a merchant admin console — assortment curation, price writes,
promotion ordering, CMS, campaigns, customer roster, commission — and roughly **two thirds of it has
no home in the six global epics**, which are all storefront page groups.

A third side is rejected: it would force two applies into one repo, collide on the single receipt
path, and offer a developer a choice that maps to nothing they can deploy separately. Instead a
global epic **`seller-operations`** carries the Manage half. That must be an explicit entry in
`taxonomy/epics.yaml`, whose current comment ("the page groups every storefront has") no longer
holds and needs amending.

### Two corrections to the current taxonomy, from evidence

- **`commission-and-payout` must be removed from B2B2B.** That fork has no commission code at all —
  no `earnings` page, no `lib/commissions.ts`, only a dangling copilot tool name. It has invoices
  and accounts receivable instead.
- **`seller-scoped-assortment` must be added to B2B2B.** Currently declared under B2B2C only, yet
  the whole distributor tier rests on it.

### What has no side, and must not acquire one

The **brand / network operator** has no surface in either starter. Everything the brand is said to
"keep" — price floor, approved-content rule, territory list, claims disclaimer, commission ladder —
is a compile-time constant in the *seller's* app config, deep-merged with one project-level custom
object, editable only by whoever redeploys. "The brand's terms with *this* seller" is un-modelled:
it is one brand per deployment.

Consequence: `brand-guardrails` is a legitimate gap on the seller-portal side (a seller must be able
to read the rules binding them), but the operator's *authoring and enforcement* of those rules has
nowhere to live. The first person who wants to specify "the brand sets the price floor" will file it
under `seller-portal`, because that is the only side available, and it will be rendered to a seller.
A comment in the taxonomy is a weak guard against this and is the only one proposed.

## Rejected alternatives

**Two flat model tokens** (`B2B2C-upstream` / `B2B2C-downstream` as members of `business_models`).
Rejected on five grounds: it takes the first question a developer answers from 4 options to 6, past
the `max_options: 4` agent cap; it fuses a fact they know (the network shape) with one they may not
have decided (which app they are starting with); it breaks `vertical.yaml.supported_models`, where
listing one token and forgetting the other yields a silent half-refusal; it makes the shared-upstream
finding **inexpressible**, leaving two tokens free to drift exactly as the two forks already have;
and it leaves nothing distinguishing "applies to the portal" from "applies to the model".

**`upstream` / `downstream`** — directionally ambiguous (upstream of whom?), and internal vocabulary,
which `questions/developer-intake.yaml` bans from anything user-facing.

**`seller` / `buyer`** — the seller *is* a buyer on the portal side; that dual role is the entire
content of the pair model, so these labels name the very thing they need to disambiguate.

**`dealer` / `customer`** (the starters' own directory names) — "dealer" is industry-specific and
wrong for a practitioner, franchisee, consultant or agency; "customer" collides with both the
`customers` domain token and the Customer API entity.

**Compound capability tags** (`business_models: [B2B2C/seller-portal]`) — changes the meaning of an
existing field across 51 published files and breaks the `["*"]` wildcard. An optional `sides:` list,
mirroring the existing per-component and per-scenario `business_models` narrowing, is additive.

## Consequences

- **38 identified change sites** across `taxonomy/`, `lib/{catalog,resolve,questions,plan,apply,
  receipt}.mjs`, `bin/{ctsx,cts}.mjs`, `schema/capability.schema.json`,
  `questions/developer-intake.yaml`, both test files, and the docs. `registry_version` 1 → 2
  (the combination key gains a segment) and `receipt_version` 1 → 2.
- **The render path gains a segment only for sided models**: `rendered/<industry>/<model>/<side>/…`,
  while B2C and B2B keep the two-level path so their goldens do not move. Churn is contained to the
  seven B2B2X combinations.
- **Four ways this could silently ship the wrong bundle**, all of which must be closed in the same
  change rather than discovered later:
  1. Defaulting a missing side. Must throw.
  2. A capability tagged `[B2B2C]` with no `sides:` lands on **both** sides — commission content on
     a consumer storefront, the seller directory inside a portal. Requires a lint gate: any
     capability naming a multi-sided model **must** declare `sides:`.
  3. The 21 inherited `[B2B, B2B2B]` capabilities are the right mechanism with the **wrong actor** —
     their prose was written for a business buying from a brand. `derived` understates that.
  4. `inherits: [B2C, B2B]` pulls invoice history, budgets, cost centres and payment terms onto the
     business storefront, where the counterparty is the **seller**, not the brand.
- **`match: exact` becomes unreachable** for every B2B2X side, since every side carries gaps. Honest,
  but the `gap_ack` question then fires on every B2B2X run, and anyone treating `exact` as a quality
  bar will see all B2B2X content permanently fail it.
- **`_base|B2B2C` jumps 30 → ~48 capabilities with nothing authored.** Anyone comparing counts across
  content versions sees what looks like new content and is not.
- **Applying both sides into one repo clobbers the receipt.** A monorepo holding both apps is the
  natural layout — both starters are exactly that — and `RECEIPT_PATH` is one file per project. The
  second apply sees the first's files as `foreign`, exits 6, and `--force` then drops them from the
  receipt. Must be resolved in `lib/receipt.mjs` as part of this change.
- **Question order becomes load-bearing**: `business_model → side → industry`. The industry question
  interpolates `{{option.capability_count}}`, which now differs per side (~50 portal vs ~30
  storefront), so asking for the side after the industry quotes a number that is wrong for one of
  them.
- **"Governance" is a landmine.** The B2B2C starter uses it for brand-over-seller guardrails; the
  B2B2B starter uses it for company-over-associate approval rules. Two unrelated concepts, one word.
  This ADR uses `brand-guardrails` for the first and leaves the second to `base.approval-workflows`.
  Reintroducing `governance` as a gap token or epic slug will author the two into each other.
