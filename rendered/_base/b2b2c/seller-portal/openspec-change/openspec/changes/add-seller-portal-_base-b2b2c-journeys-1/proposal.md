<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Add _base B2B2C: User journeys (part 1 of 2)

## Why

The _base vertical requires behaviour a bare B2B2C storefront does not have. This change introduces the user journeys (part 1 of 2) capabilities for it.

## What Changes

- B2B-1 — Company account setup (P1)
- B2B-2 — Managing team members & access (P1)
- B2B-3 — Viewing contract & account pricing (P1)
- B2B-4 — Requisition & shopping lists (P1)
- B2B-5 — Quote request & negotiation (P1)
- B2B-6 — Approval workflows (P1)
- B2B-7 — Purchase order & payment terms (P1)
- B2B-8 — Bulk & repeat ordering (P1)
- B2C-1 — Discovery & browse (P1)
- B2C-2 — Cart management (P1)

## Capabilities

### New Capabilities

- `journey-b2b-1-company-account-setup`
- `journey-b2b-2-team-members-access`
- `journey-b2b-3-contract-account-pricing`
- `journey-b2b-4-requisition-shopping-lists`
- `journey-b2b-5-quote-request-negotiation`
- `journey-b2b-6-approval-workflows`
- `journey-b2b-7-purchase-order-payment-terms`
- `journey-b2b-8-bulk-repeat-ordering`
- `journey-b2c-1-discovery-browse`
- `journey-b2c-2-cart-management`

## Impact

Skills required: `commercetools-platform`, `commercetools-commerce-patterns`, `commercetools-storefront`.

## Open Questions

- Where does seller-side activation happen — Merchant Center, a CRM, or a custom back office?
- Do divisions buy independently, and if so do they inherit the parent's pricing and entitlements?
- Which roles does the business actually need beyond buyer, approver and administrator?
- Are spending limits a role concern, an approval-rule concern, or both?
- Is the contract record of truth commercetools, an ERP, or a CPQ system?
- Does the business need contract expiry alerts in the storefront, or only in the back office?
- Which roles curate lists and which only order from them?
- Do lists need to be scoped to a Store as well as a Business Unit?
- Who prices a quote — a sales rep in Merchant Center, or a CPQ system?
- What is a quote's validity period, and who sets it?
- Who defines approval rules — the company's admin in the storefront, or the seller?
- Is multi-step or multi-approver escalation required?
- Which system owns credit limits and invoice generation, and how does the storefront read them?
- Is a purchase order number mandatory for every order, or per company?
- Is punch-out from a customer procurement system in scope? It is middleware work, not configuration.
- What is the largest realistic requisition size, and does it exceed the shopping-list line limits?
- Is the catalog identical for every buyer, or entitlement-scoped per company?
- B2B2C normally requires `seller-onboarding`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2C normally requires `seller-scoped-assortment`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2C normally requires `seller-tailored-product-content`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2C normally requires `store-scoped-selling-price`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2C normally requires `cost-price-separate-from-resale-price`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2C normally requires `seller-scoped-promotions`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2C normally requires `seller-order-book`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2C normally requires `seller-store-identity`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2C normally requires `assisted-ordering`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2C normally requires `commission-and-payout`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2C normally requires `brand-guardrails`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2C normally requires `seller-customer-roster`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
