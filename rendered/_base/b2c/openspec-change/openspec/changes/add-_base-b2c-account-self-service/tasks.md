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

## 5. Session-scoped account dashboard with explicit empty states

- [ ] 5.1 [SKILL: commercetools-storefront] Implement the dashboard as independent per-panel queries with per-panel empty and error states
- [ ] 5.2 [SKILL: commercetools-storefront] Implement the awaiting-approval count from the buyer's roles against the flows' current tier

## 6. Saved payment methods and account payment terms

- [ ] 6.1 [SKILL: commercetools-checkout] List, add, remove and set-default saved payment methods through the Payment Methods API and the PSP connector
- [ ] 6.2 [SKILL: commercetools-checkout] Render the account terms panel from the finance integration with an explicit unavailable state and a last-known timestamp

## 7. Saved and requisition lists with bulk add to cart

- [ ] 7.1 [SKILL: commercetools-storefront] Implement list-to-cart conversion with addShoppingList, passing the buyer's distribution Channel
- [ ] 7.2 [SKILL: commercetools-storefront] Resolve and display list line prices against the buyer's Store and Channel, separately from the list read
- [ ] 7.3 [SKILL: commercetools-storefront] Model list sharing with My and Others associate permissions and enforce it on the as-associate endpoints
