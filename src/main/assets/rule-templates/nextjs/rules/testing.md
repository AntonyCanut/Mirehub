---
description: "Next.js testing with Vitest and Playwright"
paths:
  - "**/*.test.tsx"
  - "**/*.test.ts"
  - "**/*.spec.tsx"
  - "**/*.spec.ts"
  - "**/*.e2e.ts"
---

# Testing

## Server Components

DO test Server Components by calling them as async functions and asserting the result. Native async component testing in RTL is evolving; consider testing data-fetching and Server Actions separately as unit tests.

## Server Actions

DO test Server Actions as plain async functions with `FormData` input.
DO test `useActionState` flows by asserting pending state, returned data, and error states.

## Mocking Next.js

Mock `next/navigation` (`useRouter`, `usePathname`, `useSearchParams`) and `next/headers` (`cookies`, `headers`) in unit tests. Both are commonly needed for Server Component and middleware tests.

## MSW for Next.js

DO use MSW with the `next/server` adapter for mocking external API calls in integration tests.
DO configure MSW handlers in a shared `mocks/` directory next to the app.

## Anti-Patterns

- DO NOT import Server Components into client test files without mocking server-only modules
- DO NOT skip error state testing — verify `error.tsx` boundaries and Server Action validation feedback
