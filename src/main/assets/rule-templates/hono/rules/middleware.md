---
description: "Hono middleware patterns and built-in middleware"
paths:
  - "**/src/middleware/**/*.ts"
  - "**/src/index.ts"
  - "**/src/app.ts"
---

# Hono Middleware

## Custom Middleware

- Always use `createMiddleware<Env>()` from `hono/factory` for typed context:
  `export const auth = createMiddleware<Env>(async (c, next) => { ... })`
- Always `await next()` — forgetting `await` causes downstream middleware to not complete
- Use the onion model: code before `await next()` runs pre-handler, code after runs post-handler

## Middleware Composition

- Use `every()` from `hono/combine` to run multiple middleware in sequence:
  `app.use('/api/*', every(cors(), auth, rateLimiter))`
- Also available: `some()` (first that succeeds) and `except()` (skip when condition matches)
- For per-route middleware, pass as arguments before the handler: `app.get('/admin', adminOnly, handler)`

## Registration Order

- Register middleware BEFORE route definitions — `app.use()` after `app.get()` won't apply to that route
- Global middleware: `app.use(middleware)` — applies to all routes
- Path-scoped: `app.use('/api/*', middleware)` — applies only to matching paths

## Built-in Middleware

Prefer Hono built-ins over third-party equivalents:

| Category       | Middleware                                                  |
|----------------|-------------------------------------------------------------|
| Security       | `cors()`, `csrf()`, `secureHeaders()`                       |
| Auth           | `basicAuth()`, `bearerAuth()`, `jwt()`                      |
| Performance    | `compress()`, `cache()`, `etag()`, `timeout()`              |
| Utilities      | `logger()`, `requestId()`, `prettyJSON()`, `bodyLimit()`    |
| Timing         | `timing()` — adds `Server-Timing` header                    |

## Anti-patterns

- Do NOT write untyped middleware (`async (c, next) => {}`) — loses `c.env` and `c.var` types
- Do NOT call `next()` without `await` — breaks the onion model, response headers/post-processing won't work
- Do NOT register middleware after route definitions — it won't apply to routes defined above it
- Do NOT manually loop over middleware arrays when `every()`/`some()`/`except()` from `hono/combine` exist
- Do NOT re-implement CORS, logging, or security headers — use built-in middleware
