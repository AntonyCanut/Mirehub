---
description: "Next.js server and client components"
paths:
  - "**/apps/**/*.tsx"
  - "**/libs/**/*.tsx"
  - "**/app/**/*.tsx"
  - "**/src/**/*.tsx"
  - "**/components/**/*.tsx"
---

# Components (Next.js 15 / React 19)

## Composition

DO use children/slots (composition) over many props — avoids prop drilling.

## File Organization

- Co-locate private components in `_components/` next to the page
- Shared components in `libs/shared/ui/` with barrel exports

## Error & Loading Boundaries

- `error.tsx` — MUST be `'use client'`; receives `{ error, reset }` props
- `loading.tsx` — automatic Suspense fallback for the route segment
- `not-found.tsx` — triggered by `notFound()` calls

## Anti-Patterns

- DO NOT spread props without type safety
- DO NOT use anonymous/unnamed components — hurts debugging
- DO NOT add `'use client'` to a parent when only a child needs interactivity
