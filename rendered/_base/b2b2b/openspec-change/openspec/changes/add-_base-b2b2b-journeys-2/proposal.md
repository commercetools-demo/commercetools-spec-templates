<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Add _base B2B2B: User journeys (part 2 of 2)

## Why

The _base vertical requires behaviour a bare B2B2B storefront does not have. This change introduces the user journeys (part 2 of 2) capabilities for it.

## What Changes

- B2C-3 — Authentication & identity (P1)
- B2C-4 — Checkout (P1)
- B2B-9 — Account-level order history (P2)
- B2C-5 — Order management (post-purchase) (P2)
- B2C-6 — Account & self-service (P2)
- B2C-7 — Switching region or language (P2)
- B2C-8 — Subscriptions & recurring orders (P3)

## Capabilities

### New Capabilities

- `journey-b2c-3-authentication-identity`
- `journey-b2c-4-checkout`
- `journey-b2b-9-account-level-order-history`
- `journey-b2c-5-order-management`
- `journey-b2c-6-account-self-service`
- `journey-b2c-7-switching-region-or-language`
- `journey-b2c-8-subscriptions-recurring-orders`

## Impact

Skills required: `commercetools-platform`, `commercetools-checkout`, `commercetools-storefront`, `commercetools-commerce-patterns`.

## Open Questions

- Are buyers global or store-scoped Customers? That decides which sign-in endpoint is correct.
- Is SSO or federated login required, and if so which identity provider fronts it?
- On a total change after authorization: re-authorize, or hold the original amount and reconcile downstream?
- Which roles get company-wide order visibility, and is it scoped per division?
- Is cost-center reporting needed in the storefront, or does finance take an export?
- Who owns the returns process of record — commercetools, an OMS, or a third-party returns service?
- What is the returns window, and is it per category?
- Which account data is personal to a buyer and which is shared company data that only an admin may change?
- On a region switch with a populated cart: carry lines over where a price exists, or start empty?
- Fixed or Dynamic price selection — and is that a per-product or project-wide decision?
- B2B2B normally requires `seller-onboarding`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2B normally requires `reseller-tiered-pricing`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2B normally requires `commission-and-payout`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
