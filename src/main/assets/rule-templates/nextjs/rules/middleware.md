---
description: "Next.js middleware and edge functions"
paths:
  - "**/middleware.ts"
  - "**/src/middleware.ts"
---

# Next.js Middleware

Runs on **Edge runtime** before every matched request. Keep it lightweight.

## What Middleware SHOULD Do

- Authentication / authorization checks (JWT verification, session validation)
- Redirects and rewrites (locale detection, legacy URLs)
- Request/response header manipulation (security headers, request IDs)
- Feature flags / A/B routing via cookies

## What Middleware SHOULD NOT Do

- Heavy computation — blocks every matched request
- Database queries — use Server Components or API routes instead
- Node.js APIs (`fs`, `path`) — Edge runtime does not support them
- Response body modification — loses Next.js features; use rewrite/redirect

## Matcher Config

DO always define a matcher to avoid running on static assets.

```typescript
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

Pattern reference: `/dashboard/:path*` (specific), `/(api|admin)/:path*` (multi), `/((?!api/public).*)` (exclusion).

## Auth Pattern

See authentication rules for `auth.config.ts` (Edge) vs `auth.ts` (Node.js) separation.
DO redirect unauthenticated users with `callbackUrl` for return-after-login.

## Security Headers

DO set security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, CSP) in middleware for app-wide coverage.

## `proxy.ts` (Next.js 16)

`proxy.ts` replaces `middleware.ts` — runs on Node.js runtime (not Edge).
Rename export: `middleware()` becomes `proxy()`.
Node.js APIs (`fs`, `path`, etc.) are now available.
Codemod: `npx @next/codemod@latest middleware-to-proxy .`

## Anti-Patterns

- DO NOT use `new Response('body')` — returns raw response, loses Next.js routing
- DO NOT import Node.js modules — middleware is Edge-only (until proxy.ts)
- DO NOT put rate limiting logic inline — use an Edge-compatible service (Upstash, Vercel WAF)
- DO NOT run middleware without a matcher — it will execute on every request including static files
