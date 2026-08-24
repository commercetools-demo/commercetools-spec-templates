# Add grocery B2B: Utility & system pages

## Why

The grocery vertical requires behaviour a bare B2B storefront does not have. This change introduces the utility & system pages capabilities for it.

## What Changes

- Error pages that name the failure and route the buyer back (P1)
- Password reset gated on a valid, unexpired reset token (P1)
- Email verification by token with a recoverable resend path (P2)

## Capabilities

### New Capabilities

- `error-pages`
- `password-reset`
- `email-verification`

## Impact

Skills required: `commercetools-storefront`.

## Open Questions

- Does the unauthorized page show the buyer the name of the missing permission, or only a reference their company administrator can quote to support?
- Is the server-error page allowed to be served from the CDN when the middleware tier is itself the component that failed?
- Which conditions must be a soft 404 with recovery content versus a hard redirect - for example a product retired from the assortment but still linked from an email campaign?
- Does commercetools own credentials for this storefront, or does an external identity provider, in which case the token endpoints, TTL and password policy all move there?
- What token validity applies, and does requesting a second reset invalidate the first link - that is, is invalidateOlderTokens set on the request?
- Where is the password policy enforced so the client-side strength indicator and the server agree on a single set of rules?
- Do buyers in Stores need the in-store token endpoints, and if so how does the page resolve the Store before the buyer is authenticated?
- Is a verification token invalidated once used, so a second click on the same link fails, or can the link be replayed until it expires?
- For an email-change flow, is the new address written to the account before or after verification, and which address signs the buyer in during the gap?
- What is a company buyer allowed to do before their address is verified - browse only, or order, given company activation is a separate gate?
- Which system issues the token when an external identity provider owns credentials, and does the commercetools verified flag then need syncing at all?
