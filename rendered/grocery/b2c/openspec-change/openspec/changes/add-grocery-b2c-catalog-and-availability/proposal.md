# Add grocery B2C: Catalog & availability

## Why

The grocery vertical requires behaviour a bare B2C storefront does not have. This change introduces the catalog & availability capabilities for it.

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
