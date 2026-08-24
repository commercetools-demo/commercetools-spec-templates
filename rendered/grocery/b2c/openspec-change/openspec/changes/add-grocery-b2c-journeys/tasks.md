# Tasks

## 1. B2C-1 — Discovery & browse

- [ ] 1.1 [SKILL: commercetools-storefront] Implement category and search listing against Product Search with the buyer's store scope
- [ ] 1.2 [SKILL: commercetools-storefront] Overlay per-buyer price and availability onto cached catalog results

## 2. B2C-2 — Cart management

- [ ] 2.1 [SKILL: commercetools-storefront] Create the cart with store and currency context before the first add-to-cart
- [ ] 2.2 [SKILL: commercetools-storefront] Re-render totals from the returned cart after every mutation

## 3. B2C-3 — Authentication & identity

- [ ] 3.1 [SKILL: commercetools-platform] Implement global and store-scoped sign-in, choosing the anonymous-cart sign-in mode explicitly
- [ ] 3.2 [SKILL: commercetools-platform] Issue and validate the session token in the BFF; commercetools does not do this
- [ ] 3.3 [SKILL: commercetools-platform] Implement the two-step password reset and the email verification token flows
- [ ] 3.4 [SKILL: commercetools-platform] Make every authentication failure message non-committal about account existence

## 4. B2C-4 — Checkout

- [ ] 4.1 [SKILL: commercetools-checkout] Fetch delivery options with matching-cart rather than filtering the full shipping-method list
- [ ] 4.2 [SKILL: commercetools-checkout] Re-read and re-render the cart after every address and delivery-method change
- [ ] 4.3 [SKILL: commercetools-checkout] Implement idempotent order creation with a recoverable failure path
- [ ] 4.4 [SKILL: commercetools-checkout] Implement cancel-and-re-authorize when the total moves after authorization

## 5. B2C-5 — Order management (post-purchase)

- [ ] 5.1 [SKILL: commercetools-storefront] Render deliveries and parcels per item rather than one order-level status
- [ ] 5.2 [SKILL: commercetools-storefront] Implement return initiation via addReturnInfo with per-item selection
- [ ] 5.3 [SKILL: commercetools-storefront] Surface return shipment state and return payment state as separate facts

## 6. B2C-6 — Account & self-service

- [ ] 6.1 [SKILL: commercetools-storefront] Implement address add / edit / remove with explicit default handling
- [ ] 6.2 [SKILL: commercetools-storefront] Render payment instruments from the PSP vault, never from commercetools
- [ ] 6.3 [SKILL: commercetools-storefront] Gate shared company data edits on the associate's permissions

## 7. B2C-7 — Switching region or language

- [ ] 7.1 [SKILL: commercetools-commerce-patterns] Resolve country and currency once per request and pass them into every price-bearing call
- [ ] 7.2 [SKILL: commercetools-commerce-patterns] Implement the region-switch cart policy explicitly, reporting lines that cannot carry over

## 8. B2C-8 — Subscriptions & recurring orders

- [ ] 8.1 [SKILL: commercetools-commerce-patterns] Create recurring orders with an explicit RecurrencePolicy and price-selection mode
- [ ] 8.2 [SKILL: commercetools-commerce-patterns] Implement in-place schedule, quantity and payment edits on an active recurring order
- [ ] 8.3 [SKILL: commercetools-commerce-patterns] State the price-locking behaviour to the buyer at setup
