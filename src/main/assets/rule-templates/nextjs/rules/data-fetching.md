---
description: "Next.js data fetching patterns in Server Components"
paths:
  - "**/app/**/*.tsx"
  - "**/app/**/*.ts"
---

# Data Fetching

## Server Components Are the Default Data Layer

DO fetch data directly in Server Components — no API route round-trip needed.
DO use `async` Server Components with direct `await` for DB or API calls.
DO query only the fields the UI needs (`select` in ORM, explicit fields in API).

## Parallel Fetching

DO use `Promise.all()` for independent data needs — avoid sequential waterfalls.
DO NOT `await` one fetch before starting another unless there is a real dependency.

## Streaming with Suspense

DO wrap slow async components in `<Suspense>` with granular fallbacks.
DO NOT wrap the entire page in a single `<Suspense>` — defeats streaming.
Each `<Suspense>` boundary streams independently — split by data speed.

## Client Components

DO use the `use()` hook to unwrap promises passed from Server Components.
For client-side interactivity with server data: fetch in Server Component, pass as props.

## Dynamic Params (Next.js 15)

Dynamic params (`params`, `searchParams`) are Promises — see routing rules.

## Error Handling

- Throw errors in fetch functions — they bubble to the nearest `error.tsx`
- Call `notFound()` for 404 — triggers `not-found.tsx`
- DO NOT silently catch and return `null` — hides errors from the user

## Anti-Patterns

- DO NOT default to `cache: 'force-cache'` — Next.js 15+ is no-cache by default; opt in explicitly with `"use cache"` directive instead
- DO NOT destructure `params` synchronously — see routing rules
