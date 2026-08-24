# Add _base B2B2C: Account & self-service pages

## Why

The _base vertical requires behaviour a bare B2B2C storefront does not have. This change introduces the account & self-service pages capabilities for it.

## What Changes

- Account request held until the seller activates it (P1)
- Buyer sign-in with password or federated identity (P1)
- Address book with a default delivery location (P1)
- Order history scoped to what the buyer may see (P1)
- Session-scoped account dashboard with explicit empty states (P2)
- Saved payment methods and account payment terms (P2)
- Saved and requisition lists with bulk add to cart (P2)

## Capabilities

### New Capabilities

- `account-registration-request`
- `account-sign-in`
- `address-book`
- `order-history`
- `account-dashboard`
- `payment-methods`
- `saved-lists`

## Impact

Skills required: `commercetools-storefront`, `commercetools-platform`, `commercetools-checkout`.

## Open Questions

- Which attributes does credit and tax review actually need at submission (tax id, credit references, trade references), and are they held on the organisation or in the seller's CRM?
- Does a buyer with a recorded but unactivated request see a default assortment, a price-free catalog, or nothing at all?
- Which identity provider owns enterprise buyers, and does it also own multi-factor and lockout policy, or must the storefront tier rate-limit sign-in itself?
- Are buyer accounts store-scoped? If so the sign-in surface has to know the store before it can authenticate anyone.
- Which validation provider, and is it authoritative? A hard block on an unresolvable address will reject legitimate rural and industrial addresses; a warning-only mode returns the delivery failures the integration was bought to prevent.
- Do company sites need per-associate visibility, or may every buyer in a Business Unit ship to every site the company has saved? Associate permissions are per role and per unit, with no per-address granularity.
- Where does a job site that exists for one project live - a Business Unit address that has to be cleaned up later, or a cart-level address that is never reusable?
- Where do invoice documents live, and is the download proxied by the storefront tier or served as a signed link from the document service?
- Is cost centre modelled as a division of the buyer organisation or as an order custom field? The filter and the permission story differ between the two.
- Who owns the outstanding balance figure, and can it be read inside the dashboard's latency budget or must it be cached with a staleness marker?
- Is the approvals count scoped to the buyer's own organisation only, or to every organisation they are a member of?
- Does PaymentMethodSetDefaultAction clear the flag on the account's previously default method, or does the storefront clear it explicitly? The action takes a boolean per method, which suggests the latter - confirm before shipping, because getting it wrong leaves the buyer with two defaults or none.
- Which system owns the credit line, and can it be read inside the account page's latency budget, or does it have to be cached with a visible staleness marker?
- Are net terms held per company or per sub-account? A Business Unit division can carry its own Custom Fields, but the finance system may only model the parent, in which case a division cannot show its own terms.
- Who may remove a payment method that the whole company uses - the person who added it, any administrator, or nobody from the storefront at all?
- Where do list detail prices come from at view time - a price-selection read per line, or a throwaway cart? The first costs a round trip per render, the second creates carts the buyer never sees and never cleans up.
- Does a shared list need visibility narrower than the Business Unit, for example one project team within a division? Associate permissions are per role and per unit, not per list.
- What happens to a list line whose product is still purchasable but whose price has moved since the list was built - silently reprice, or surface the delta?
- B2B2C normally requires `seller-onboarding`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2C normally requires `seller-scoped-assortment`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2C normally requires `commission-and-payout`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2C normally requires `split-fulfillment`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
