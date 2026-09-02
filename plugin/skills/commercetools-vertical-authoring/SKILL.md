---
name: commercetools-vertical-authoring
description: Author a commercetools industry vertical — turn a source document (PDF, RFP, page inventory, or collector answers) into framework-agnostic capability YAML in the commercetools-spec-templates repo, annotated with the right commercetools-* skill and grounded in verified API surface. Use when creating or extending a vertical, or promoting collector responses into published capabilities.
when_to_use:
  - "Authoring a new industry vertical (grocery, telecom, fashion) from a PDF, RFP or requirements document"
  - "Adding, revising or deprecating capabilities in an existing vertical in commercetools-spec-templates"
  - "Triaging raw commercetools-spec-collector answers into candidate capabilities"
  - "Assigning [SKILL: commercetools-*] annotations and business-model tags to industry capabilities"
metadata:
  contentType: SKILL
  area:
    - spec-driven-development
    - authoring
---

# commercetools Vertical Authoring

Turns a source document into **capability YAML** — the framework-agnostic source of truth for an
industry vertical. Renderers own OpenSpec and Spec Kit shape; you never write framework markdown.

| Rule | |
| :--- | :--- |
| One capability = one file = **exactly one** normative requirement with one SHALL/MUST | non-negotiable |
| Write only under `catalog/{common,verticals}/` and `taxonomy/` | `registry.json`, `dist/`, `rendered/`, `collector/forms/` are generated |
| Never assert commercetools API surface you have not grounded in this session | step 5 |
| Never copy a source document into git, and never quote more of it than a locator needs | step 2 |
| A rights record is required only for material you did **not** author — see step 2 | step 2 |

## Workflow

1. **Docs search (required, run first).** The mandatory grounding step — it gathers verified
   documentation as context. Do not skip it and do not replace it with an MCP search tool:

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/docs-search.mjs \
     --query "<the industry's commerce concepts, e.g. grocery substitution slot booking weight pricing>" \
     --app-name "<current-app>" --model "<current-model>" \
     --skill-name "commercetools-vertical-authoring" --limit 10
   ```

   Query the **commerce domain**, not the industry's marketing vocabulary.

2. **Inventory before you extract.** `node bin/ctsx.mjs coverage` and read
   `taxonomy/*.yaml`, `schema/capability.schema.json`, and the vertical's `vertical.yaml`.
   Anything already present is **revised** (bump `version`), never re-added. Read the document from
   the path you were given — it lives outside the repo and stays there.

   **Decide whether a rights record is needed, before writing anything.** Its only job is to stop
   us redistributing material we have no right to redistribute:

   | The source is | `provenance.source` | Rights record |
   | :--- | :--- | :--- |
   | Written in-house by commercetools | `authored` | **None.** There is nobody to get permission from. Record the section in `locator`. |
   | Licensed, third-party, or quoted under fair use | `pdf` | **Required**: `sources/<id>.provenance.yaml` with `uri`, `rights.basis`, `cleared_by`, `cleared_at`. `fair-use-extract` caps `visibility` at `partner`. |
   | From a customer engagement or under NDA | `customer-project` | **Required**, `basis: customer-nda`, which forces `visibility: internal`. |
   | Expert answers from the collector | `collector` | None; name the respondent pseudonyms in `contributors`. |

   If a record is required and does not exist, stop and ask the admin to create one — do not
   invent a clearance. If the source is in-house, do not create one: a rights record for a
   document nobody needs permission for is a gate that can never open.

3. **One capability per testable behaviour.** Split anything containing "and also" or two modal
   verbs. Fill `requirement` (surface-agnostic, exactly one SHALL/MUST, ≤400 chars), `rationale`,
   `components` (with per-component `business_models` — that is what generates the `_Excluded for X_`
   footer), at least one `given/when/then` scenario, `priority`, `epic` from `vertical.yaml`,
   `domains`, `visibility`, and `provenance` with a locator a human can use to re-find the passage.
   Narrow `business_models` to what you can defend; `["*"]` is almost always wrong. Unknowns go in
   `open_questions`, never into invented requirement text.

   **If `business_models` names a paired model (B2B2C, B2B2B), `sides:` is mandatory.** Those
   models are two storefronts — a seller portal and the storefront the seller's own customers buy
   from — and an absent `sides` means EVERY side, which puts commission content on a consumer
   storefront and the seller directory inside a portal. Lint refuses it. `sides` narrows at the
   same three levels `business_models` does: the capability, each `components[]` entry, and each
   `scenarios[]` entry. `node bin/ctsx.mjs coverage` lists the legal side tokens.

4. **Assign the skill annotation.** `skill:` is the single hardest judgement here; the rest go in
   `supporting_skills`.

   | Capability is mainly about | `skill:` |
   | :--- | :--- |
   | Pricing, discounts, tax, shipping rules, catalog/ProductType modeling, B2B order flows | `commercetools-commerce-patterns` |
   | A shopper- or buyer-facing surface (PDP, PLP, cart, account, B2B portal) | `commercetools-storefront` |
   | SDK/auth, project data model, GraphQL vs REST, search, platform limits | `commercetools-platform` |
   | The Checkout product, payment sessions, PSP connectors | `commercetools-checkout` |
   | A connector, subscription, job, API extension, or external-system sync | `commercetools-connect` |

   Those five are the closed set in `taxonomy/skills.yaml`. A purely business capability omits
   **both** `commercetools:` and `skill:`; lint enforces the pairing in both directions.

5. **Ground every API claim.** For each `commercetools.api_surface` entry use the
   `commercetools-knowledge` MCP — `commercetools-documentation-search` for concepts and
   constraints, `commercetools-oas-schemata` / `commercetools-graphql-schemata` for fields and
   types, `commercetools-rest-validate` / `commercetools-graphql-validate` for anything shaped like
   a call. Record `grounded_by`, the returned `doc` URL and `verified_at`. **If it does not verify,
   delete the claim and add an open question.**

   Capture `kind: constraint` aggressively — constraints are what implementers get wrong, and they
   are the highest-value thing a vertical spec carries. Worked examples from the grocery vertical:
   an Order Edit requires `InventoryMode: None`, which conflicts with `ReserveOnCart`; applying an
   Order Edit re-prices **every** line, not just the edited one; commercetools has no
   unit-of-measure price type and no delivery-slot resource.

6. **Place files.**

   | Content | Path |
   | :--- | :--- |
   | Published capability, one industry | `catalog/verticals/<v>/capabilities/<slug>.yaml` |
   | Applies to every industry | `catalog/common/capabilities/<any-folder>/<slug>.yaml` |
   | Only one side of a paired model | same place, with `sides: [<side>]` — the folder is filing, `sides` is the contract |
   | Vertical metadata, epic order, supported models | `catalog/verticals/<v>/vertical.yaml` |
   | Rights record, **only** for material we did not author | `catalog/verticals/<v>/sources/<id>.provenance.yaml` |
   | The source document itself | **nowhere in git** — the DMS URI in the rights record is the reference |
   | New industry, domain or group token | `taxonomy/*.yaml`, added **before** anything references it |
   | `registry.json`, `dist/`, `rendered/`, `collector/forms/` | **generated — never hand-edit** |

   The file stem must equal the id's last segment; lint enforces it.

7. **Regenerate and validate.** All three must pass before you report done:

   ```bash
   node bin/ctsx.mjs build
   node bin/ctsx.mjs lint --strict     # 0 ok · 1 errors · 3 golden drift
   node bin/ctsx.mjs coverage
   ```

   Exit 3 means the goldens moved: read the render diff and confirm the change is intended, then
   commit the rebuild. Then prove it against the real framework:

   ```bash
   node bin/cts.mjs apply --cwd /tmp/probe --industry <v> --model <m> --no-overlay
   # a paired model needs --side, and each side needs its own directory
   node bin/cts.mjs apply --cwd /tmp/probe-portal --industry <v> --model B2B2C --side seller-portal --no-overlay
   (cd /tmp/probe && openspec validate --specs --strict)
   ```

8. **Report** — capabilities added or changed by id and version, the coverage matrix, every
   `open_question` you left, and **every claim you dropped for lack of grounding**. Never publish a
   capability whose provenance you cannot state.

## Anti-patterns

| Do not | Instead |
| :--- | :--- |
| **Invent API surface** — a plausible-sounding update action, field or endpoint | Ground it via MCP, or move it to `open_questions` |
| **Copy the source document into the repo**, or paste long passages into the YAML | Record the rights file and a locator; rewrite in your own words |
| **One giant spec** — a 20-requirement `grocery.yaml` | One capability per testable requirement; `depends_on` links them |
| **Framework vocabulary in the source** — `FR-003`, "user story", "ADDED Requirements", "Phase 2", `tasks.md` | Plain normative prose; the renderer adds framework vocabulary. Lint rejects these |
| `business_models: ["*"]` to avoid deciding | Tag only what you can defend; inheritance handles the rest |
| Naming B2B2C or B2B2B and leaving `sides` off | Decide which shop it belongs to. Both is a legitimate answer; not saying is not |
| Authoring an operator/brand-facing capability | There is no side for the brand. Do not file it under `seller-portal` — see ADR 8 |
| Two modal verbs in one `requirement` | Split into two capabilities |
| Hand-edit `rendered/`, `registry.json`, `dist/` or `collector/forms/` | Re-run `ctsx build` |
| Name a customer in any field | Describe the pattern; set `visibility: internal` if the pattern itself is confidential |
| Put implementation code in `modeling_notes` | Record the decision; the `[SKILL:]` skill supplies the code |

## Checklist

- [ ] `docs-search.mjs` ran first and its results grounded the work
- [ ] Existing capabilities were revised, not duplicated
- [ ] Every `requirement` has exactly one SHALL/MUST and at least one scenario
- [ ] Every capability naming B2B2C or B2B2B declares `sides:`
- [ ] A rights record exists for every non-`authored` source, and none was created for in-house material
- [ ] Every `api_surface` entry has `grounded_by`, `doc` and `verified_at`; unverified claims were deleted
- [ ] Every capability with a `commercetools:` block has a `skill:` from the closed set, and vice versa
- [ ] `ctsx build && ctsx lint --strict && ctsx coverage` all pass, and the rebuild is committed
- [ ] The rendered output was applied to a probe project and passed the framework's own validator
- [ ] Open questions and dropped claims were reported, not quietly omitted
