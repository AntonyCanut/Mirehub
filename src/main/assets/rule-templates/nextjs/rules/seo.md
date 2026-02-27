---
description: "Next.js SEO and metadata"
paths:
  - "**/layout.tsx"
  - "**/page.tsx"
  - "**/app/sitemap.ts"
  - "**/app/robots.ts"
---

# SEO & Metadata

## Metadata API

- DO export `metadata` (static) or `generateMetadata` (dynamic) from `page.tsx` / `layout.tsx`
- DO set `metadataBase` in root layout — all relative URLs resolve against it
- DO use `title.template` in root layout (`'%s | App Name'`) so child pages only set `title: 'Page'`
- DO include `openGraph` and `twitter` card metadata on all public pages
- DO use `generateMetadata` with `await params` for dynamic pages (see routing rules)

## Structured Data

DO render JSON-LD via `<script type="application/ld+json">` in Server Components.
DO use schema.org types (`Article`, `Product`, `Organization`) for rich search results.

## Sitemap & Robots

- `app/sitemap.ts` — export async function returning `MetadataRoute.Sitemap`
- `app/robots.ts` — export function returning `MetadataRoute.Robots`
- DO generate sitemap dynamically from DB for content-heavy sites
- DO disallow `/admin/`, `/api/`, `/private/` in robots

## Canonical URLs

DO set `alternates.canonical` on every page to prevent duplicate content penalties.
DO set `alternates.languages` for multi-language sites.

## Anti-Patterns

- DO NOT forget metadata on any public page — missing title/description hurts ranking
- DO NOT duplicate content without canonical — search engines penalize
- DO NOT accidentally set `robots: { index: false }` — verify intent on every page
- DO NOT hardcode full URLs when `metadataBase` is set — use relative paths
