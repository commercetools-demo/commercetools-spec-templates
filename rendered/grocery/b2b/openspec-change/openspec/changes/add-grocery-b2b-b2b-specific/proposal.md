<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Add grocery B2B: B2B-specific pages

## Why

The grocery vertical requires behaviour a bare B2B storefront does not have. This change introduces the b2b-specific pages capabilities for it.

## What Changes

- Invoice history and outstanding balance on account (P1)
- Quick order and bulk upload with per-line results (P1)
- Budget monitoring against committed order spend (P2)
- Company profile with permission-gated editing (P2)
- Contract pricing shown as the cart will price it (P2)
- Cost center codes assignable to a purchase (P3)

## Capabilities

### New Capabilities

- `invoice-and-billing-history`
- `quick-order-entry`
- `budget-and-spending-limits`
- `company-profile`
- `contract-pricing`
- `cost-center-management`

## Impact

Skills required: `commercetools-connect`, `commercetools-storefront`, `commercetools-commerce-patterns`, `commercetools-platform`.

## Open Questions

- Which system is the invoice master, and can it be queried inside the page's latency budget, or does the storefront need a synchronised projection?
- Does pay-now settle one invoice, a selection, or a statement balance - and who reconciles a partial payment or an unallocated receipt?
- Is the credit line and its remaining headroom exposed to the buyer, and does exceeding it block new orders, new invoices, or neither?
- Does an invoice ever cover several orders or part of one, and if so what does the buyer see against each order?
- Does the buyer's own part number need to resolve alongside the seller's SKU, and where does that cross-reference live?
- What is the accepted maximum number of lines in one upload given the 500-action and cart-size guidance, and is a partially added cart acceptable or does the whole upload fail closed?
- Which file layouts and column orders must be accepted, and is a header row guaranteed?
- Should a line whose quantity exceeds stock be added at the available quantity, added in full for backorder, or refused?
- Which system owns the budget period and the committed-spend figure - commercetools order data, or the finance system that also issues invoices?
- Does a budget bind to a cost center, a business unit, or an individual associate, and what happens to in-flight approvals when a budget is edited mid-period?
- Do quotes, recurring orders and orders awaiting approval count against committed spend, or only orders in a placed state?
- Is the seller's ERP or commercetools the master for legal name and tax identifiers, and is the storefront view read-only as a result?
- Which role in the buyer's own vocabulary maps to the permission that can change company details, and who assigns it during onboarding?
- Does the account manager assignment need to be visible to every associate, or only to administrators?
- Is the contract service or commercetools the master for negotiated prices? Only one can be authoritative, and the other has to be derived.
- Are the discount levels on an agreement genuinely Cart or Product Discounts, or are they just how the negotiated rate is expressed against list price?
- Who is notified when an agreement lapses with no successor, and does the buyer keep browsing at list price or lose access to the assortment?
- Does a cost center apply to the whole order or per line item, and does a single requisition need to split across several?
- Is the code list mastered in the buyer's ERP and synchronised in, or maintained by the buyer's administrator in the storefront?
- What happens to a buyer's in-flight cart when their cost-center assignment is revoked?
