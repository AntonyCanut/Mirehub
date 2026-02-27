---
description: "AdonisJS middleware patterns"
paths:
  - "**/app/middleware/**/*.ts"
  - "**/start/kernel.ts"
---

# AdonisJS Middleware

## Middleware Types

| Type | Registration | Runs on |
|------|-------------|---------|
| Server middleware | `server.use([])` in `start/kernel.ts` | Every HTTP request |
| Router middleware | `router.use([])` in `start/kernel.ts` | Matched routes only |
| Named middleware | `router.named({})` in `start/kernel.ts` | Routes that explicitly `.use()` it |

## Structure

- Place middleware in `app/middleware/` with snake_case filenames
- Class with `async handle(ctx: HttpContext, next: NextFn)` method
- Always `await next()` to continue the chain (unless short-circuiting with a response)
- Optional `async terminate(ctx: HttpContext)` -- runs after response is sent (analytics, logging)

## Registration

- Named middleware: register in `router.named({})` with lazy imports
- Apply to routes: `.use(middleware.auth())` or `.use([middleware.auth(), middleware.admin()])`
- Apply to groups: `router.group(() => {...}).use(middleware.auth())`

## Middleware with Parameters

- Third argument in `handle()`: `options: { roles: string[] }`
- Usage: `.use(middleware.role({ roles: ['admin', 'manager'] }))`

## Execution Order

- Server middleware runs first (container bindings, CORS)
- Router middleware runs second (body parser)
- Named middleware runs last in declaration order

## Anti-patterns

- Do NOT put business logic in middleware -- keep it to cross-cutting concerns (auth, logging, rate limiting)
- Do NOT forget `await next()` -- silently drops the request
- Do NOT modify the response body in middleware unless it is a response-shaping concern (compression, serialization)
- Do NOT register heavy middleware as server middleware -- use named middleware for route-specific concerns
