---
description: "Elysia route definitions, method chaining, guards, and path parameters"
paths:
  - "**/src/index.ts"
  - "**/src/modules/**/index.ts"
  - "**/src/routes/**/*.ts"
  - "**/src/app.ts"
---

# Elysia Routes

## Route Organization

| Pattern | Use Case | Syntax |
|---------|----------|--------|
| Module plugin | Resource CRUD | `new Elysia({ prefix: '/users' }).get('/').post('/')` |
| `.group()` | Shared prefix + middleware | `.group('/api/v1', app => app.get(...))` |
| `.guard()` | Shared schema across routes | `.guard({ body: schema }, app => app.post(...))` |

## Path Parameters

- Destructure from context: `({ params: { id } }) => ...`
- Multiple params: `/users/:userId/posts/:postId`
- Wildcard: `/files/*` accessed via `params['*']`
- Validate params with schemas: `{ params: t.Object({ id: t.Numeric() }) }`

## Response Schemas

See validation rules for response schema requirements.

## Controller Pattern

- Export root app type as `export type App = typeof app`

## Anti-Patterns

- Do NOT use separate statements (`app.get(); app.post()`) — breaks type chain for Eden
- Do NOT extract handlers to standalone functions — context types are lost outside the chain
- Do NOT pass full Context to services — breaks encapsulation, couples to Elysia internals
- Do NOT define routes after lifecycle hooks meant for earlier routes — see lifecycle rules
