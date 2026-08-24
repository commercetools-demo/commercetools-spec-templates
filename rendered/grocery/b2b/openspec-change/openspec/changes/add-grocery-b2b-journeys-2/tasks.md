# Tasks

## 1. B2C-3 — Authentication & identity

- [ ] 1.1 [SKILL: commercetools-platform] Implement global and store-scoped sign-in, choosing the anonymous-cart sign-in mode explicitly
- [ ] 1.2 [SKILL: commercetools-platform] Issue and validate the session token in the BFF; commercetools does not do this
- [ ] 1.3 [SKILL: commercetools-platform] Implement the two-step password reset and the email verification token flows
- [ ] 1.4 [SKILL: commercetools-platform] Make every authentication failure message non-committal about account existence

## 2. B2C-4 — Checkout

- [ ] 2.1 [SKILL: commercetools-checkout] Fetch delivery options with matching-cart rather than filtering the full shipping-method list
- [ ] 2.2 [SKILL: commercetools-checkout] Re-read and re-render the cart after every address and delivery-method change
- [ ] 2.3 [SKILL: commercetools-checkout] Implement idempotent order creation with a recoverable failure path
- [ ] 2.4 [SKILL: commercetools-checkout] Implement cancel-and-re-authorize when the total moves after authorization

## 3. B2B-9 — Account-level order history

- [ ] 3.1 [SKILL: commercetools-platform] Create every B2B order through the as-associate / in-business-unit path so businessUnit is set
- [ ] 3.2 [SKILL: commercetools-platform] Scope order queries by the associate's My/Others permissions rather than in the UI
- [ ] 3.3 [SKILL: commercetools-platform] Define the cost-center custom field up front and index the filter on it
- [ ] 3.4 [SKILL: commercetools-platform] Attribute each order in a company view to the member who placed it

## 4. B2C-5 — Order management (post-purchase)

- [ ] 4.1 [SKILL: commercetools-storefront] Render deliveries and parcels per item rather than one order-level status
- [ ] 4.2 [SKILL: commercetools-storefront] Implement return initiation via addReturnInfo with per-item selection
- [ ] 4.3 [SKILL: commercetools-storefront] Surface return shipment state and return payment state as separate facts

## 5. B2C-6 — Account & self-service

- [ ] 5.1 [SKILL: commercetools-storefront] Implement address add / edit / remove with explicit default handling
- [ ] 5.2 [SKILL: commercetools-storefront] Render payment instruments from the PSP vault, never from commercetools
- [ ] 5.3 [SKILL: commercetools-storefront] Gate shared company data edits on the associate's permissions

## 6. B2C-7 — Switching region or language

- [ ] 6.1 [SKILL: commercetools-commerce-patterns] Resolve country and currency once per request and pass them into every price-bearing call
- [ ] 6.2 [SKILL: commercetools-commerce-patterns] Implement the region-switch cart policy explicitly, reporting lines that cannot carry over

## 7. B2C-8 — Subscriptions & recurring orders

- [ ] 7.1 [SKILL: commercetools-commerce-patterns] Create recurring orders with an explicit RecurrencePolicy and price-selection mode
- [ ] 7.2 [SKILL: commercetools-commerce-patterns] Implement in-place schedule, quantity and payment edits on an active recurring order
- [ ] 7.3 [SKILL: commercetools-commerce-patterns] State the price-locking behaviour to the buyer at setup
