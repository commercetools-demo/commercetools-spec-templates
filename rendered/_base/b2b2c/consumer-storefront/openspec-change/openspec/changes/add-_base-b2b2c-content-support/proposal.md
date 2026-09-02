<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Add _base B2B2C: Content & support pages

## Why

The _base vertical requires behaviour a bare B2B2C storefront does not have. This change introduces the content & support pages capabilities for it.

## What Changes

- Contact page that confirms only enquiries support has accepted (P1)
- Policy pages stating the effective date of the text shown (P1)
- About page assembled entirely from published CMS content (P2)
- FAQ answers readable and indexable without being expanded (P2)
- Articles addressable and indexable independently of the listing (P3)

## Capabilities

### New Capabilities

- `contact-us`
- `policy-pages`
- `about-us`
- `faq`
- `blog-resources`

## Impact

Skills required: none.

## Open Questions

- Does an authenticated buyer's enquiry carry an account or company identifier to the CRM, and which identifier is authoritative on that side?
- What is the retention and consent basis for the free-text field, given a buyer may paste order or payment details into it?
- Is the chat vendor in scope for the storefront's consent banner, and does the page remain compliant when chat is declined?
- Which system of record holds superseded policy versions, so the text in force on a given order's date can be produced later?
- Do the policies vary by selling region, and is the variant chosen by the buyer's locale, the shipping destination, or the store the cart was created in?
- Does a material change to the terms require re-consent from buyers with an open standing order, and where is that consent recorded?
- Which certification and compliance claims on this page are legally controlled, and who signs off before an editor publishes a change to them?
- Should the sales call-to-action carry the referring page into the enquiry for attribution, and is that permitted under the storefront's consent policy?
- Is an unhelpful vote routed to an owner of record for that answer, or only to a dashboard nobody is accountable for?
- Do any answers restate a policy, a price or a lead time, and what stops them from drifting from the policy pages and the catalog?
- Does the article address space share a prefix with category or product slugs, and which system arbitrates a collision?
- Are gated resources such as a case study behind a form in scope here, and does the gate live in the CMS or in the storefront's session tier?
- B2B2C normally requires `seller-scope-resolution`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2C normally requires `seller-directory`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2C normally requires `seller-scoped-assortment`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2C normally requires `seller-tailored-product-content`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2C normally requires `single-seller-cart`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2C normally requires `seller-attribution-on-order`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2C normally requires `split-fulfillment`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
- B2B2C normally requires `assisted-ordering`, and no published capability covers it. Decide whether this build needs it and specify it yourself.
