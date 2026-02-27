---
description: "Hono testing with Vitest, app.request(), and testClient()"
paths:
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - "**/test/**/*.ts"
  - "**/vitest.config.ts"
---

# Hono Testing

## Two Testing Approaches

| Approach          | When to use                                    | Type safety |
|-------------------|------------------------------------------------|-------------|
| `app.request()`   | Simple tests, non-chained routes, raw requests | None        |
| `testClient(app)` | Chained routes, RPC-style type-safe testing    | Full        |

## testClient() (Preferred)

- Import from `hono/testing` — provides type-safe testing mirroring the RPC client:
  `const client = testClient(app)`
- Mirrors `hc` client API: `client.posts.$get()`, `client.posts.$post({ json: data })`
- Requires chained route definitions — see RPC rules
- No HTTP server needed — tests run in-process against the app instance

## app.request()

- Direct request testing: `await app.request('/path', { method, body, headers })`
- Third argument provides mock env bindings: `app.request('/', {}, { DB: mockDb, API_KEY: 'test' })`
- Use for routes that aren't chained or when testing raw HTTP behavior

## Testing Middleware

- Create a minimal Hono app in the test with the middleware applied and a dummy route
- Test both the happy path (middleware passes) and rejection (middleware blocks)
- Use `app.request()` with appropriate headers/bindings

## Test Organization

- Test file per route module — matches `src/routes/posts.ts` with `test/posts.test.ts`
- Group by resource and HTTP method using `describe` blocks
- Test validation rejections (400), auth failures (401/403), not found (404), and success cases

## Anti-patterns

- Do NOT spin up an HTTP server for tests — use `app.request()` or `testClient()` directly
- Do NOT manually type `testClient()` responses — types are inferred from the route chain
- Do NOT use `testClient()` with non-chained routes — it won't infer types, use `app.request()` instead
- Do NOT skip testing error paths — always test validation failures and auth rejections
