---
description: "Next.js App Router patterns"
paths:
  - "**/apps/**/app/**/*.tsx"
  - "**/app/**/*.tsx"
---

# App Router Routing

## File Conventions

| File | Purpose |
|------|---------|
| `page.tsx` | Route UI (required for a route to be accessible) |
| `layout.tsx` | Shared layout (persists across child navigations) |
| `loading.tsx` | Suspense fallback for the route segment |
| `error.tsx` | Error boundary (`'use client'` required) |
| `not-found.tsx` | 404 UI (triggered by `notFound()`) |

## Folder Conventions

| Pattern | Meaning |
|---------|---------|
| `(group)/` | Route group — organizational only, not in URL |
| `_folder/` | Private folder — co-located code, not a route |
| `[param]/` | Dynamic segment |
| `[...param]/` | Catch-all segment |
| `[[...param]]/` | Optional catch-all segment |

## Dynamic Routes (Next.js 15)

`params` is a `Promise` — always `await` before destructuring.
`generateStaticParams()` for SSG of known dynamic routes.

## Parallel Routes & Intercepting Routes

| Feature | Use Case | Convention |
|---------|----------|------------|
| Parallel routes | Simultaneous independent UI (dashboard panels, modals) | `@slot/` folders in layout |
| Intercepting routes | Show route as modal on soft nav, full page on hard nav | `(.)`, `(..)`, `(...)` prefix |

DO use parallel routes for dashboards with independently loading sections.
DO use intercepting routes for photo/detail modals that also work as standalone pages.

## Navigation

- DO use `next/link` for declarative navigation (enables prefetching)
- DO use `useRouter()` only in client components for programmatic navigation
- DO use `router.replace()` instead of `router.push()` when replacing history (login redirects)
- DO NOT use `<a>` tags for internal navigation — loses client-side routing benefits

## Route Groups

DO use route groups `(marketing)`, `(app)` to apply different layouts without affecting URLs.
DO NOT nest route groups unnecessarily — keep the structure flat and readable.

## Anti-Patterns

- DO NOT destructure `params` synchronously — it is a Promise in Next.js 15
- DO NOT create deeply nested route groups — adds complexity without value
- DO NOT forget `loading.tsx` for routes with slow data fetching — users see a blank screen without it
