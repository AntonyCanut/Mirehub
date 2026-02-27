---
description: "Elysia testing with bun:test, .handle(), and Eden Treaty"
paths:
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - "**/test/**/*.ts"
---

# Elysia Testing

## Test Runner

Use `bun:test` as default — `describe`, `expect`, `it`, `beforeAll`, `afterAll` from `bun:test`.

## Two Approaches

| Method | When to Use | Type-Safe? |
|--------|------------|-----------|
| `app.handle(new Request(...))` | Low-level, testing raw HTTP behavior | No |
| `treaty(app)` (Eden) | Preferred — type-safe, mirrors client usage | Yes |

## Eden Treaty Testing (Preferred)

Pass the app instance directly to `treaty()` — no server, no URL, no network overhead:

```typescript
const app = new Elysia().get('/posts', () => [{ id: 1, title: 'Hello' }])
const api = treaty(app)
const { data, error } = await api.posts.get()
```

Responses are fully typed — `data` and `error` match server-defined response schemas.

## .handle() Testing

Use fully qualified URLs — `.handle()` requires `http://localhost/...`, not relative paths:

```typescript
const res = await app.handle(new Request('http://localhost/posts'))
const body = await res.json()
```

## Testing Guidelines

- Create a fresh Elysia instance per `describe` block to avoid state leakage
- Test plugins by mounting them on a minimal app with a test route
- Test validation by sending invalid payloads and asserting 422 status
- Test auth by sending requests with and without credentials
- Test error handling by asserting status codes and error response shapes

## Anti-Patterns

- Do NOT start a real server (`app.listen()`) for unit tests — use `.handle()` or Eden with app instance
- Do NOT use partial URLs with `.handle()` — it requires fully qualified `http://...` URLs
- Do NOT share mutable app state between tests — create fresh instances per describe block
