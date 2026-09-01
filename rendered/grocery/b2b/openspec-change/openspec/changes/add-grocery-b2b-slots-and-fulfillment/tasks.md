<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Tasks

## 1. Delivery slot selection with finite capacity

- [ ] 1.1 [SKILL: commercetools-commerce-patterns] Decide whether slots are ShippingMethods or external capacity plus a cart custom field, and record it
- [ ] 1.2 [SKILL: commercetools-commerce-patterns] Implement slot availability lookup for a cart address using matching-cart shipping methods
- [ ] 1.3 [SKILL: commercetools-commerce-patterns] Carry the booked slot on the cart and revalidate it on any address change
- [ ] 1.4 [SKILL: commercetools-commerce-patterns] Re-check slot capacity at order placement and fail closed with a re-selection path
- [ ] 1.5 [SKILL: commercetools-commerce-patterns] Surface the recalculated shipping charge and totals after every slot or address change
