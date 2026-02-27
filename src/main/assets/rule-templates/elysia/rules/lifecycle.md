---
description: "Elysia lifecycle hooks: onRequest, beforeHandle, afterHandle, transform, resolve"
paths:
  - "**/src/index.ts"
  - "**/src/app.ts"
  - "**/src/plugins/**/*.ts"
  - "**/src/modules/**/index.ts"
---

# Elysia Lifecycle

## Hook Execution Order

```
Request → onRequest → onParse → transform/derive → [Validation]
→ beforeHandle/resolve → [Handler] → afterHandle → mapResponse
→ [onError] → afterResponse
```

## Hook Reference

| Hook | Phase | Use Case |
|------|-------|----------|
| `onRequest` | Earliest | Logging, CORS headers, rate limiting |
| `onParse` | Body parsing | Custom content-type parsers |
| `transform` | Before validation | Mutate/normalize input (trim, lowercase) |
| `derive` | Before validation | Add request-scoped context (extract token from headers) |
| `beforeHandle` | After validation | Auth guards, permission checks — return early to short-circuit |
| `resolve` | After validation | Compute properties from validated data (resolve user from token) |
| `afterHandle` | After handler | Transform/wrap responses (envelope pattern) |
| `mapResponse` | Before send | Custom serialization, set response headers |
| `afterResponse` | After send | Cleanup, logging, metrics |

See plugins rules for `derive` vs `resolve` vs `decorate` vs `state` decision matrix.

## Key Rules

- **`beforeHandle` for guards** — return `status(401)` or `status(403)` to short-circuit before the handler runs
- **Global vs route-level** — global hooks (`.onBeforeHandle(...)`) apply to all subsequent routes; route-level hooks (`{ beforeHandle: fn }`) apply to one route
- **Order is critical** — hooks only affect routes registered AFTER them; register middleware plugins before route plugins

## Anti-Patterns

- Do NOT put auth checks inside handlers — use `beforeHandle` to short-circuit before the handler runs
- Do NOT register hooks after routes they should protect — hooks only apply forward
- Do NOT use `transform` for adding context — use `derive`; `transform` is for mutating input data
