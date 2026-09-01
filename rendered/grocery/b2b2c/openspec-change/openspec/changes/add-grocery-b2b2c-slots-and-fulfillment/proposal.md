<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Add grocery B2B2C: Slots & fulfillment

## Why

The grocery vertical requires behaviour a bare B2B2C storefront does not have. This change introduces the slots & fulfillment capabilities for it.

## What Changes

- Delivery slot selection with finite capacity (P1)

## Capabilities

### New Capabilities

- `delivery-slot-booking`

## Impact

Skills required: `commercetools-commerce-patterns`.

## Open Questions

- Who owns slot capacity, and can it be queried synchronously within checkout latency budget?
- Is a slot held on selection, or only checked - and if held, for how long?
- B2B2C normally requires `seller-onboarding`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2C normally requires `seller-scoped-assortment`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2C normally requires `commission-and-payout`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2C normally requires `split-fulfillment`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
