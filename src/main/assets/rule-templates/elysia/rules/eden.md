---
description: "Eden Treaty for end-to-end type-safe client-server communication"
paths:
  - "**/src/client.ts"
  - "**/src/client/**/*.ts"
  - "**/src/eden/**/*.ts"
  - "**/src/index.ts"
---

# Elysia Eden Treaty

## Setup

- Use Eden Treaty v2 (`treaty` from `@elysiajs/eden`) as the default client
- Export app type: `export type App = typeof app` — Eden requires method chaining, see routes rules
- Client-side: `const api = treaty<App>('http://localhost:3000')`
- Testing: pass app instance directly — `const api = treaty(app)` — no URL, no server needed

## Path Mapping

Server routes map to chained property access on the client:

| Server Route | Eden Client Call |
|-------------|-----------------|
| `GET /posts` | `api.posts.get()` |
| `POST /posts` | `api.posts.post({ ... })` |
| `GET /posts/:id` | `api.posts({ id: '1' }).get()` |
| `PUT /users/:id` | `api.users({ id: '1' }).put({ ... })` |
| `GET /api/v1/health` | `api.api.v1.health.get()` |

## Response Handling

Every Eden call returns `{ data, error, status }`:
- `error` is typed based on response schemas — use `error.status` for narrowing
- When `error` is null, `data` is the typed success response
- Define response schemas on the server to get typed error discrimination on the client

## Anti-Patterns

- Do NOT use Eden Fetch for new code — Treaty v2 has better ergonomics and type inference
- Do NOT pass URLs in tests — pass the app instance directly to `treaty()` for zero-network-overhead testing
- Do NOT forget to export `App` type — Eden client has no type information without it
