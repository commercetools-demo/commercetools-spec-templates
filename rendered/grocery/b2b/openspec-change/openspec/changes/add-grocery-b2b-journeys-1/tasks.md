# Tasks

## 1. B2B-1 — Company account setup

- [ ] 1.1 [SKILL: commercetools-platform] Model the company as a BusinessUnit, with divisions where buying is decentralised
- [ ] 1.2 [SKILL: commercetools-platform] Implement the registration-to-activation handoff, including the declined outcome
- [ ] 1.3 [SKILL: commercetools-platform] Ensure every activated company has at least one administering associate

## 2. B2B-2 — Managing team members & access

- [ ] 2.1 [SKILL: commercetools-platform] Define the seller's AssociateRole catalogue, with both halves of each My/Others pair
- [ ] 2.2 [SKILL: commercetools-platform] Implement invite, role change and deactivate through the as-associate endpoints
- [ ] 2.3 [SKILL: commercetools-platform] Render 403 refusals from the platform rather than gating only in the UI

## 3. B2B-3 — Viewing contract & account pricing

- [ ] 3.1 [SKILL: commercetools-commerce-patterns] Model negotiated rates as Channel-scoped Standalone Prices per company
- [ ] 3.2 [SKILL: commercetools-commerce-patterns] Carry the buyer's distribution Channel on every price-bearing call and cart line
- [ ] 3.3 [SKILL: commercetools-commerce-patterns] Overlay per-buyer prices onto cached listing and search results
- [ ] 3.4 [SKILL: commercetools-commerce-patterns] Surface which tier or contract produced the displayed price

## 4. B2B-4 — Requisition & shopping lists

- [ ] 4.1 [SKILL: commercetools-commerce-patterns] Create and read lists through the as-associate / in-business-unit path
- [ ] 4.2 [SKILL: commercetools-commerce-patterns] Convert a list to a cart with addShoppingList, always passing the buyer's distributionChannel
- [ ] 4.3 [SKILL: commercetools-commerce-patterns] Design roles with both halves of each shopping-list My/Others permission pair
- [ ] 4.4 [SKILL: commercetools-commerce-patterns] Report lines that cannot be added rather than dropping them

## 5. B2B-5 — Quote request & negotiation

- [ ] 5.1 [SKILL: commercetools-commerce-patterns] Build a quote-request-shaped cart: shippingMode Single, a shipping address, no discount codes
- [ ] 5.2 [SKILL: commercetools-commerce-patterns] Implement the request, staged-quote and acceptance transitions with their permissions
- [ ] 5.3 [SKILL: commercetools-commerce-patterns] Create the order from the Pending quote with quoteStateToAccepted, preserving quoted prices
- [ ] 5.4 [SKILL: commercetools-commerce-patterns] Preserve every negotiation round's comments as an auditable history

## 6. B2B-6 — Approval workflows

- [ ] 6.1 [SKILL: commercetools-commerce-patterns] Define the company's ApprovalRule predicates and the roles that may approve
- [ ] 6.2 [SKILL: commercetools-commerce-patterns] Show the requester the approval outcome at submission, not after silence
- [ ] 6.3 [SKILL: commercetools-commerce-patterns] Build the approver queue and approve/reject actions from ApprovalFlow state

## 7. B2B-7 — Purchase order & payment terms

- [ ] 7.1 [SKILL: commercetools-commerce-patterns] Set purchaseOrderNumber on the cart, not the order, and verify it propagates to the quote path
- [ ] 7.2 [SKILL: commercetools-commerce-patterns] Model invoice-on-terms settlement with Payments; make card capture the exception
- [ ] 7.3 [SKILL: commercetools-commerce-patterns] Configure net pricing with includedInPrice false and fix the tax calculation and rounding modes
- [ ] 7.4 [SKILL: commercetools-commerce-patterns] Surface a credit-limit breach before submission, from whichever system owns the limit

## 8. B2B-8 — Bulk & repeat ordering

- [ ] 8.1 [SKILL: commercetools-commerce-patterns] Implement batch SKU/part-number resolution with per-line validation feedback
- [ ] 8.2 [SKILL: commercetools-commerce-patterns] Implement CSV upload with column mapping, validating fully before touching the cart
- [ ] 8.3 [SKILL: commercetools-commerce-patterns] Implement reorder by replicating a past cart or order, reporting lines that lapsed
- [ ] 8.4 [SKILL: commercetools-commerce-patterns] Offer SoftFreeze or HardFreeze for baskets under internal review

## 9. B2C-1 — Discovery & browse

- [ ] 9.1 [SKILL: commercetools-storefront] Implement category and search listing against Product Search with the buyer's store scope
- [ ] 9.2 [SKILL: commercetools-storefront] Overlay per-buyer price and availability onto cached catalog results

## 10. B2C-2 — Cart management

- [ ] 10.1 [SKILL: commercetools-storefront] Create the cart with store and currency context before the first add-to-cart
- [ ] 10.2 [SKILL: commercetools-storefront] Re-render totals from the returned cart after every mutation
