<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Tasks

## 1. Cart with engine-calculated totals after every change

- [ ] 1.1 [SKILL: commercetools-storefront] Render the cart summary from the cart response returned by each update action
- [ ] 1.2 [SKILL: commercetools-storefront] Re-check every applied discount code's state after each mutation and surface the reason when one stops matching

## 2. Checkout re-reading totals after each shipping change

- [ ] 2.1 [SKILL: commercetools-storefront] Re-read the cart and re-render the summary after each address or delivery-method write
- [ ] 2.2 [SKILL: commercetools-storefront] Fetch delivery options for the current cart and handle the empty-options case as a blocking state

## 3. Landing page with session-resolved buyer context

- [ ] 3.1 [SKILL: commercetools-storefront] Split the landing page into a cacheable shell and per-session account fragments
- [ ] 3.2 [SKILL: commercetools-storefront] Resolve the buyer's Business Unit, Store and Customer Group once per request and pass it to both pricing and content selection

## 4. Order confirmation stating reference and true order state

- [ ] 4.1 [SKILL: commercetools-storefront] Render the confirmation from a read of the order by its reference rather than from the placement response held in memory
- [ ] 4.2 [SKILL: commercetools-storefront] Resolve and display the approval flow's pending state for orders that matched a rule

## 5. Product detail page showing the buyer's effective price

- [ ] 5.1 [SKILL: commercetools-storefront] Resolve the selected variant's price with the buyer's currency, country, customer group and channel on every request
- [ ] 5.2 [SKILL: commercetools-storefront] Render the tier table from the selected Price's own tiers and re-resolve the effective unit price when quantity changes

## 6. Category listing with request-derived filter and page state

- [ ] 6.1 [SKILL: commercetools-storefront] Map every listing URL parameter to a Product Search query, postFilter, sort and offset
- [ ] 6.2 [SKILL: commercetools-storefront] Overlay per-buyer price and availability onto cached card data at render time

## 7. Search results with exact part-number resolution

- [ ] 7.1 [SKILL: commercetools-platform] Combine an exact variants.sku expression with the full-text expression in one Product Search query
- [ ] 7.2 [SKILL: commercetools-platform] Implement the no-results fallback as configured content rather than a hardcoded message
