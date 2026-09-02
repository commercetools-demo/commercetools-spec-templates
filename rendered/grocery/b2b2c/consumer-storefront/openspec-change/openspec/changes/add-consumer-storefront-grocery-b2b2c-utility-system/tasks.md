<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Tasks

## 1. Error pages that name the failure and route the buyer back

- [ ] 1.1 [SKILL: commercetools-storefront] Map platform error responses onto the three error conditions in the middleware tier
- [ ] 1.2 [SKILL: commercetools-storefront] Render the error shell without a session, catalog or pricing call so it survives an upstream outage
- [ ] 1.3 [SKILL: commercetools-storefront] Distinguish an expired session from a refused action so the buyer is routed to sign-in rather than a dead end

## 2. Password reset gated on a valid, unexpired reset token

- [ ] 2.1 [SKILL: commercetools-storefront] Request a reset token server-side and hand it to the email provider without logging its value
- [ ] 2.2 [SKILL: commercetools-storefront] Validate the token on page load so an expired link is reported before the buyer types a password
- [ ] 2.3 [SKILL: commercetools-storefront] Return an identical response for known and unknown email addresses
- [ ] 2.4 [SKILL: commercetools-storefront] Force re-authentication after a successful reset and clear the local session

## 3. Email verification by token with a recoverable resend path

- [ ] 3.1 [SKILL: commercetools-storefront] Validate the token server-side on page load and branch on valid, expired and already-verified
- [ ] 3.2 [SKILL: commercetools-storefront] Implement resend for an identified account and state what happens when the account cannot be identified
- [ ] 3.3 [SKILL: commercetools-storefront] Decide and enforce what an account with an unverified address may do
