---
description: "Next.js 15 caching strategies and revalidation"
paths:
  - "**/app/**/*.ts"
  - "**/app/**/*.tsx"
  - "**/next.config.*"
---

# Caching (Next.js 15 — Opt-In Model)

All caching is **opt-in** in Next.js 15. Nothing is cached by default.

## `"use cache"` Directive

Requires `cacheComponents: true` (Next.js 16+) or `experimental: { dynamicIO: true }` (Next.js 15) in `next.config.ts`. This is the primary caching mechanism.

```tsx
import { cacheTag, cacheLife } from 'next/cache';

async function getProducts() {
  'use cache';
  cacheTag('products');
  cacheLife('hours');
  return db.product.findMany();
}
```

Can be applied to: functions, Server Components, entire route modules.

## cacheLife Profiles

| Profile | Stale | Revalidate | Expire |
|---------|-------|------------|--------|
| `'default'` | 5min | 15min | never |
| `'seconds'` | 30s | 1s | 1min |
| `'minutes'` | 5min | 1min | 1h |
| `'hours'` | 5min | 1h | 1day |
| `'days'` | 5min | 1day | 1week |
| `'weeks'` | 5min | 1week | 1month |
| `'max'` | 5min | 30days | 1year |

## Invalidation

```tsx
'use server';
import { revalidateTag } from 'next/cache';

export async function createProduct(formData: FormData) {
  await db.product.create({ data: parsed.data });
  revalidateTag('products'); // Invalidates all caches tagged 'products'
}
```

## Route Segment Config (Fallback)

| Config | Effect |
|--------|--------|
| `export const dynamic = 'force-static'` | SSG — fully static |
| `export const dynamic = 'force-dynamic'` | SSR — never cached |
| `export const revalidate = 60` | ISR — revalidate every 60s |

## Anti-Patterns

- DO NOT assume fetch is cached by default — it is NOT in Next.js 15
- DO NOT use `unstable_cache` in new code — use `"use cache"` + `cacheTag()` instead
- DO NOT cache mutations or side effects
- DO NOT cache user-specific data without including the user ID in the cache key
- DO NOT over-cache dynamic data (live prices) or under-cache static data (config)
