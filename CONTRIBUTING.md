# Contributing

Thanks for considering a contribution. Two requirements are non-negotiable,
because they are the ones that get skipped.

## 1. Every source file you add carries the SPDX header

Including files you only edited:

```
/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */
```

Adjust only the comment syntax for the language (`//` for Swift, `#` for shell
and GraphQL). The header matters because this code gets consumed by copy-paste:
a single route handler or hook lands in someone else's repository with no
LICENSE anywhere near it, and the header is the only part of the licensing that
travels with the code.

## 2. Only contribute code you have the right to license under MIT

Not from another project, a customer engagement, or a vendor's repo unless its
licence permits it **and** you preserve the original notice. If a directory
carries its own `LICENSE`, or its `metadata.json` names another organisation,
it is someone else's — do not header it.

## Also

- **No customer or prospect names.** Not in code, comments, fixtures, README, or
  commit messages.
- **No credentials.** No `.env`, no client secrets, no tokens, no private keys.
  Check `.env.example` too.
- **No internal infrastructure.** No internal hostnames, GCP project ids,
  database names, or internal issue references.
- **No personal data.** Use synthetic fixtures — `jen@example.com`.

## House style

Write for the reader. People land in these repos to understand a pattern before
writing their own version. Comment the *why*, not the *what*.

## Review

Best-effort, by the people who maintain the repo. There is no response-time
commitment — see [SUPPORT.md](SUPPORT.md).
