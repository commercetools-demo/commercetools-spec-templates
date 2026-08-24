# Add _base B2B: Core shopping pages

## Why

The _base vertical requires behaviour a bare B2B storefront does not have. This change introduces the core shopping pages capabilities for it.

## What Changes

- Cart with engine-calculated totals after every change (P1)
- Checkout re-reading totals after each shipping change (P1)
- Landing page with session-resolved buyer context (P1)
- Order confirmation stating reference and true order state (P1)
- Product detail page showing the buyer's effective price (P1)
- Category listing with request-derived filter and page state (P1)
- Search results with exact part-number resolution (P2)

## Capabilities

### New Capabilities

- `cart-page`
- `checkout-page`
- `home-landing-page`
- `order-confirmation-page`
- `product-detail-page`
- `product-listing-page`
- `search-results-page`

## Impact

Skills required: `commercetools-storefront`, `commercetools-platform`.

## Open Questions

- Where is the minimum order value configured, and is it per store, per account or per currency?
- Is the list of valid cost centers held on the Business Unit, in an external finance system, or both?
- Which system decides whether net terms or a credit line are available to this account at this total, and is that check synchronous within the checkout latency budget?
- Is delivery to multiple addresses in one order in scope, given that it changes when tax becomes calculable?
- Which system owns the hero, announcements and footer copy, and does its targeting key off the Business Unit key or the Customer Group?
- Is 'recently ordered' computed from the buyer's own orders or the whole company account's orders?
- What generates the printable receipt, and is it the same document as the eventual invoice?
- Where does carrier tracking come from once a delivery exists, and is the tracking reference held on the order or in the fulfillment system?
- What computes a delivery estimate for a buyer's address before a cart exists? commercetools carries restock information, not a per-address delivery date.
- Are datasheets and safety data sheets served as product assets or from a separate document system with its own access rules?
- Are prices modelled as Embedded or Standalone, given that a price facet or price sort constrains the choice?
- Should availability be an offered facet at all, given the indexing lag on availability data?
- Is a real 'did you mean' correction in scope? It needs an external search engine; commercetools offers fuzzy matching and keyword autocomplete, not correction.
- Who curates the no-results fallback content, and is it per category or global?
