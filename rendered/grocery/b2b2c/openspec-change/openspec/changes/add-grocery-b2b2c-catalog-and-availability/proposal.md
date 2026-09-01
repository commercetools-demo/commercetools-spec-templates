<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Add grocery B2B2C: Catalog & availability

## Why

The grocery vertical requires behaviour a bare B2B2C storefront does not have. This change introduces the catalog & availability capabilities for it.

## What Changes

- Out-of-stock substitutions at picking time (P1)

## Capabilities

### New Capabilities

- `out-of-stock-substitutions`

## Impact

Skills required: `commercetools-commerce-patterns`.

## Open Questions

- Is the substitution price tolerance a fixed percentage per category, or a per-customer setting?
- Does this business need ReserveOnCart at checkout? If so, post-placement substitution cannot use Order Edits and needs a cancel-and-reorder flow instead.
- B2B2C normally requires `seller-onboarding`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2C normally requires `seller-scoped-assortment`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2C normally requires `commission-and-payout`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2C normally requires `split-fulfillment`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
