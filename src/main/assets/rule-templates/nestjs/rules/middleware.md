---
description: "NestJS middleware patterns"
paths:
  - "**/*.middleware.ts"
  - "**/middleware/**/*.ts"
---

# NestJS Middleware

## Execution Order

Middleware runs first in the request lifecycle — before guards, interceptors, and pipes.

## When to Use Middleware vs Others

| Need | Use | Why |
|------|-----|-----|
| Request logging, correlation ID, headers | Middleware | Runs before everything, no `ExecutionContext` needed |
| Authorization / role checks | Guard | Has `ExecutionContext`, can read metadata |
| Response transformation / caching | Interceptor | Has access to response stream via RxJS |
| Input validation / transformation | Pipe | Runs per-parameter with type info |

## Directives

- DO use functional middleware for stateless tasks (logging, headers) — simpler, no DI needed
- DO use class middleware (`@Injectable() implements NestMiddleware`) when DI is required
- DO use `helmet()`, `compression()`, `cookieParser()` as Express-level middleware in `main.ts`
- DO add a `CorrelationIdMiddleware` that reads `x-correlation-id` header or generates a UUID
- DO set body size limits: `express.json({ limit: '10mb' })`

## Applying Middleware

- `consumer.apply(M).forRoutes('*')` — all routes
- `consumer.apply(M).forRoutes(Controller)` — specific controller
- `consumer.apply(M).forRoutes({ path: '*', method: RequestMethod.POST })` — by HTTP method
- `consumer.apply(M).exclude({ path: 'health', method: RequestMethod.GET }).forRoutes('*')` — with exclusions
- Chain multiple: `consumer.apply(A, B, C).forRoutes('api')` — executes A → B → C

## Anti-patterns

- DO NOT perform heavy DB/API calls in middleware — it blocks every matched request
- DO NOT forget to call `next()` — the request will hang indefinitely
- DO NOT set response headers after calling `next()` — headers may already be sent
- DO NOT use `app.use()` for middleware that needs DI — use `MiddlewareConsumer` in module instead
