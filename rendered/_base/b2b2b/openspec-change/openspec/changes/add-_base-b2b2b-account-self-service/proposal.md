# Add _base B2B2B: Account & self-service pages

## Why

The _base vertical requires behaviour a bare B2B2B storefront does not have. This change introduces the account & self-service pages capabilities for it.

## What Changes

- Account request held until the seller activates it (P1)
- Buyer sign-in with password or federated identity (P1)
- Address book with a default delivery location (P1)
- Order history scoped to what the buyer may see (P1)
- Company user and role administration (P1)
- Session-scoped account dashboard with explicit empty states (P2)
- Order approval rules and the approver queue (P2)
- Saved payment methods and account payment terms (P2)
- Quote acceptance at the negotiated price (P2)
- Saved and requisition lists with bulk add to cart (P2)

## Capabilities

### New Capabilities

- `account-registration-request`
- `account-sign-in`
- `address-book`
- `order-history`
- `user-and-role-management`
- `account-dashboard`
- `approval-workflows`
- `payment-methods`
- `quote-negotiation`
- `saved-lists`

## Impact

Skills required: `commercetools-storefront`, `commercetools-platform`, `commercetools-commerce-patterns`, `commercetools-checkout`.

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
- Where do per-user spending limits actually live? A limit per person has no home in the platform; it can be approximated with one role and one approval rule per spend band, which multiplies roles quickly. Confirm the buyer accepts band granularity before designing around it.
- There is no pending-invite resource - a member either exists as a Customer and Associate or does not. Decide whether the middleware owns invite tokens, expiry and re-send, and what an unaccepted invite looks like in the user list.
- Does deactivating a member mean removeAssociate, or assigning a role with no permissions? Removal is cleaner but loses the record of who they were on resources that only reference the association.
- Which permission gates the page itself? UpdateAssociates governs the write, but the me endpoints do not validate View permissions, so read access has to be gated in the middleware.
- Who owns the outstanding balance figure, and can it be read inside the dashboard's latency budget or must it be cached with a staleness marker?
- Is the approvals count scoped to the buyer's own organisation only, or to every organisation they are a member of?
- The source's approver picker is an account user list, but commercetools binds approvers to Associate Roles and offers no way to name an individual. Confirm the buyer accepts role-level approver assignment, or scope a role-per-named-approver shim and price the role sprawl it causes.
- Approval is evaluated on the Order, so a requester only learns their order needs approval after placing it. Does the buyer need a pre-submission warning, and if so what recomputes the predicate against the cart, given the predicate language targets Orders?
- Which permission lets a buyer administrator create and edit rules from the portal at all? manage_approval_rules is an OAuth scope rather than an Associate Permission, so the gate has to be built in the middleware - decide what it checks.
- Should the history log show only the flow's own approvals and rejection, or a fuller audit assembled from messages? The flow records the outcome but not the intermediate views of who was pending when.
- Does PaymentMethodSetDefaultAction clear the flag on the account's previously default method, or does the storefront clear it explicitly? The action takes a boolean per method, which suggests the latter - confirm before shipping, because getting it wrong leaves the buyer with two defaults or none.
- Which system owns the credit line, and can it be read inside the account page's latency budget, or does it have to be cached with a visible staleness marker?
- Are net terms held per company or per sub-account? A Business Unit division can carry its own Custom Fields, but the finance system may only model the parent, in which case a division cannot show its own terms.
- Who may remove a payment method that the whole company uses - the person who added it, any administrator, or nobody from the storefront at all?
- Does the conversation with the sales rep live in the CRM, or is the round-by-round comment history on the quote series sufficient to render the thread?
- Who generates the quote PDF, and must it be re-issued per round so the document always matches the offer the buyer accepted?
- Where do list detail prices come from at view time - a price-selection read per line, or a throwaway cart? The first costs a round trip per render, the second creates carts the buyer never sees and never cleans up.
- Does a shared list need visibility narrower than the Business Unit, for example one project team within a division? Associate permissions are per role and per unit, not per list.
- What happens to a list line whose product is still purchasable but whose price has moved since the list was built - silently reprice, or surface the delta?
- B2B2B normally requires `seller-onboarding`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2B normally requires `reseller-tiered-pricing`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2B normally requires `commission-and-payout`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
