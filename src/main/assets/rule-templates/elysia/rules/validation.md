---
description: "Elysia validation with TypeBox (Elysia.t), schemas, and reference models"
paths:
  - "**/src/modules/**/model.ts"
  - "**/src/modules/**/index.ts"
  - "**/src/schemas/**/*.ts"
  - "**/src/routes/**/*.ts"
---

# Elysia Validation

## TypeBox is Native

Use `t` from `elysia` (re-exported TypeBox) — do NOT use Zod or other validators as they break Elysia's type inference pipeline. Standard Schema support exists but loses Eden type narrowing.

## Validation Targets

| Target | Purpose | Key Types |
|--------|---------|-----------|
| `body` | Request body | `t.Object()`, `t.Array()` |
| `query` | Query string | `t.Object()` with `t.Optional()`, use `t.Numeric()` for number coercion |
| `params` | Path parameters | `t.Object()`, use `t.Numeric()` for numeric IDs |
| `headers` | Request headers | `t.Object()` for required headers like API keys |
| `response` | Response per status | `{ 200: t.Object(...), 404: t.Object(...) }` |

Always define `response` schemas — they drive OpenAPI docs and enable typed error responses with `status()`.

## Reference Models

Register reusable schemas with `.model()` and reference by string name in route config:

```typescript
.model({ 'user.create': t.Object({...}), 'user.response': t.Object({...}) })
.post('/users', handler, { body: 'user.create', response: { 200: 'user.response' } })
```

## Extracting TypeScript Types

Use `typeof schema.static` to derive TS types from TypeBox schemas — single source of truth for runtime and compile-time.

## Custom Error Messages

Pass `error` option to any TypeBox type: `t.String({ format: 'email', error: 'Invalid email' })`.

## File Uploads

Use `t.File()` for single and `t.Files()` for multiple uploads with `type` and `maxSize` constraints.

## Anti-Patterns

- Do NOT validate manually in handlers — use schemas; they integrate with OpenAPI and Eden
- Do NOT skip `response` schemas — loses typed error handling and OpenAPI documentation
- Do NOT duplicate schemas across routes — use `.model()` or `guard()` to share them
