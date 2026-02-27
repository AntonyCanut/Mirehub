---
description: "Next.js authentication patterns"
paths:
  - "**/auth/**"
  - "**/login/**"
  - "**/api/auth/**"
  - "**/middleware.ts"
---

# Authentication (NextAuth.js v5 / Auth.js)

## Architecture

- `auth.config.ts` — Edge-compatible config (callbacks, pages). Used by middleware.
- `auth.ts` — Full config with providers, DB adapter. Used in Server Components.
- `app/api/auth/[...nextauth]/route.ts` — Route handler: `export const { GET, POST } = handlers`

## Key Directives

- DO separate `auth.config.ts` (Edge) from `auth.ts` (Node.js) for middleware compatibility
- DO check auth in middleware or Server Components — never rely on client-side checks
- DO use protected layouts (`app/(protected)/layout.tsx`) to guard route groups
- DO extend session with custom fields (role, id) via `jwt` and `session` callbacks
- DO use `useActionState` for login forms
- DO type-extend `next-auth` module for custom `User`, `Session`, `JWT` fields

## Route Protection Decision

| Method | When to Use |
|--------|-------------|
| Middleware `authorized` callback | App-wide protection, redirect before render |
| Server Component `auth()` + `redirect()` | Per-page checks with custom logic |
| Protected layout | Route group protection |

## Anti-Patterns

- DO NOT check auth client-side for route protection — page already loaded, too late
- DO NOT return full user objects — select only needed fields, never expose password hashes
- DO NOT store sensitive tokens in `localStorage` — use httpOnly cookies via NextAuth
- DO NOT skip `callbackUrl` on redirect — users lose their intended destination
