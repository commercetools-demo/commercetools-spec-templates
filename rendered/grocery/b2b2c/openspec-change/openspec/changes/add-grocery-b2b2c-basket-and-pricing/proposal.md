<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Add grocery B2B2C: Basket & pricing

## Why

The grocery vertical requires behaviour a bare B2B2C storefront does not have. This change introduces the basket & pricing capabilities for it.

## What Changes

- Prices for goods sold by weight or measure (P1)

## Capabilities

### New Capabilities

- `weight-based-pricing`

## Impact

Skills required: `commercetools-commerce-patterns`.

## Open Questions

- Which fresh categories sell in fixed increments and which are genuinely continuous?
- Which system is the record of truth for the final billed weight, and how does it report back?
- B2B2C normally requires `seller-onboarding`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2C normally requires `seller-scoped-assortment`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2C normally requires `commission-and-payout`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2C normally requires `split-fulfillment`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
