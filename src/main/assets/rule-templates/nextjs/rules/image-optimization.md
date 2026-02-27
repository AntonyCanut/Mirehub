---
description: "Next.js image optimization with next/image"
paths:
  - "**/app/**/*.tsx"
  - "**/components/**/*.tsx"
  - "**/next.config.*"
---

# Image Optimization

## Key Directives

- DO always use `next/image` instead of `<img>` — provides lazy loading, responsive srcSet, format optimization
- DO add `priority` to above-the-fold / LCP images only (hero, banner)
- DO provide `sizes` when using `fill` — without it, the browser cannot pick the correct srcSet
- DO use `placeholder="blur"` for static imports (auto-generated) or provide `blurDataURL` for remote images
- DO use `remotePatterns` in `next.config.ts` for external image domains (not deprecated `domains`)
- DO wrap `fill` images in a container with `position: relative`

## Remote Images

Remote images require explicit `width`/`height` or `fill` mode.
Configure allowed origins in `next.config.ts` via `images.remotePatterns` with `protocol`, `hostname`, and `pathname`.

## Responsive Sizes

| Layout | `sizes` Value |
|--------|--------------|
| Full-width | `100vw` |
| 2-column grid | `(max-width: 768px) 100vw, 50vw` |
| 3-column grid | `(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw` |
| Fixed-width card | `300px` |

## Anti-Patterns

- DO NOT use `<img>` — no optimization, no lazy loading, no responsive behavior
- DO NOT set `priority` on every image — defeats preloading (only LCP images)
- DO NOT use `loading="eager"` — use `priority` instead
- DO NOT use `next/image` for small icons/SVGs — use inline SVG or CSS
- DO NOT skip `alt` text — empty `alt=""` only for purely decorative images
- DO NOT serve user uploads at original resolution — resize on upload or use a CDN with transforms
