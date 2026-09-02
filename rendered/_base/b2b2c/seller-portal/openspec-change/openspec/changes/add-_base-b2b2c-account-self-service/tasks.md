<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Tasks

## 1. Account request held until the seller activates it

- [ ] 1.1 [SKILL: commercetools-storefront] Implement account request submission that creates an inactive organisation and a customer record
- [ ] 1.2 [SKILL: commercetools-storefront] Implement the pending, verified and activated states of the request as distinct buyer-visible states

## 2. Buyer sign-in with password or federated identity

- [ ] 2.1 [SKILL: commercetools-platform] Implement password sign-in with anonymous cart assignment and a generic failure path
- [ ] 2.2 [SKILL: commercetools-platform] Implement federated sign-in that links the provider identity to a buyer record server-side

## 3. Address book with a default delivery location

- [ ] 3.1 [SKILL: commercetools-storefront] Implement address create, edit, remove and set-default against the customer or business unit address set
- [ ] 3.2 [SKILL: commercetools-storefront] Integrate the address validation provider in the BFF and gate the write on the buyer's decision
- [ ] 3.3 [SKILL: commercetools-storefront] Re-read the cart after applying a saved address so shipping and tax totals stay consistent

## 4. Order history scoped to what the buyer may see

- [ ] 4.1 [SKILL: commercetools-storefront] Implement own-orders and company-wide order queries behind one entitlement decision in the server tier
- [ ] 4.2 [SKILL: commercetools-storefront] Implement reorder as a cart replication that reports items it could not carry over

## 5. Company user and role administration

- [ ] 5.1 [SKILL: commercetools-storefront] Build the member list from the business unit's explicit and inherited associates, labelling each
- [ ] 5.2 [SKILL: commercetools-storefront] Filter the role selector to buyer-assignable roles and surface a refused assignment as a permission message
- [ ] 5.3 [SKILL: commercetools-storefront] Implement deactivation as associate removal plus explicit handling of the resources still naming that associate

## 6. Session-scoped account dashboard with explicit empty states

- [ ] 6.1 [SKILL: commercetools-storefront] Implement the dashboard as independent per-panel queries with per-panel empty and error states
- [ ] 6.2 [SKILL: commercetools-storefront] Implement the awaiting-approval count from the buyer's roles against the flows' current tier

## 7. Order approval rules and the approver queue

- [ ] 7.1 [SKILL: commercetools-commerce-patterns] Build the pending queue from approval flows in Pending status and gate the action buttons on the approver's roles against currentTierPendingApprovers
- [ ] 7.2 [SKILL: commercetools-commerce-patterns] Implement approve and reject with the flow's current version and a 409 re-read path
- [ ] 7.3 [SKILL: commercetools-commerce-patterns] Wire approver notification from an ApprovalFlow message subscription, resolving roles to associates
- [ ] 7.4 [SKILL: commercetools-commerce-patterns] Implement rule create and edit with a currency-constrained threshold predicate and role-based requesters and approvers

## 8. Saved payment methods and account payment terms

- [ ] 8.1 [SKILL: commercetools-checkout] List, add, remove and set-default saved payment methods through the Payment Methods API and the PSP connector
- [ ] 8.2 [SKILL: commercetools-checkout] Render the account terms panel from the finance integration with an explicit unavailable state and a last-known timestamp

## 9. Quote acceptance at the negotiated price

- [ ] 9.1 [SKILL: commercetools-commerce-patterns] Implement quote list and detail with actions driven by the offer's state and the buyer's permissions
- [ ] 9.2 [SKILL: commercetools-commerce-patterns] Implement order creation from a pending quote that records acceptance in the same call

## 10. Saved and requisition lists with bulk add to cart

- [ ] 10.1 [SKILL: commercetools-storefront] Implement list-to-cart conversion with addShoppingList, passing the buyer's distribution Channel
- [ ] 10.2 [SKILL: commercetools-storefront] Resolve and display list line prices against the buyer's Store and Channel, separately from the list read
- [ ] 10.3 [SKILL: commercetools-storefront] Model list sharing with My and Others associate permissions and enforce it on the as-associate endpoints
