# Add grocery B2C: Slots & fulfillment

## Why

The grocery vertical requires behaviour a bare B2C storefront does not have. This change introduces the slots & fulfillment capabilities for it.

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
