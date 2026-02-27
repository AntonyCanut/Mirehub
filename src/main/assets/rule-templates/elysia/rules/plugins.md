---
description: "Elysia plugin system, scoping, derive, resolve, decorate, and state"
paths:
  - "**/src/plugins/**/*.ts"
  - "**/src/modules/**/index.ts"
  - "**/src/index.ts"
  - "**/src/app.ts"
---

# Elysia Plugins

## Plugin Creation Rules

- Use instance plugins (`new Elysia()`) for stateful plugins with lifecycle hooks
- Use functional plugins (`(app: Elysia) => app.derive(...)`) for simple transformations
- Configurable plugins: factory function returning a named Elysia instance

## Scope Propagation

| Scope | Visibility | Use Case |
|-------|-----------|----------|
| `local` (default) | Current instance + children only | Module-internal hooks |
| `scoped` | Propagates to direct parent | Plugins that need one-level-up access |
| `global` | Propagates to all ancestors | Cross-cutting concerns (logging, auth) |

Set scope via `as` option: `.derive({ as: 'scoped' }, ...)` or chain `.as('global')` on the plugin instance.

## derive vs resolve vs decorate vs state

| Primitive | When it runs | Per-request? | Use for |
|-----------|-------------|-------------|---------|
| `decorate` | Once at setup | No | Static utilities (logger, db client) |
| `state` | Once at setup | No (shared) | Mutable stores (counters, caches) |
| `derive` | Every request, before validation | Yes | Parse headers, extract tokens |
| `resolve` | Every request, after validation | Yes | Computed props from validated data (user from token) |

## Anti-Patterns

- Do NOT create plugins without `name` — causes silent duplicate registration on multiple `.use()` calls
- Do NOT use `derive` for static values like DB connections — instantiates per request for no reason
- Do NOT use `decorate` for per-request values — same value shared across all requests
- Do NOT register global hooks inside deeply nested plugins without intent — pollutes the entire app

## Lazy Loading

Use dynamic imports for faster startup: `.use(import('./modules/users'))`

## Official Plugins

Use `@elysiajs/cors`, `@elysiajs/jwt`, `@elysiajs/bearer`, `@elysiajs/swagger`, `@elysiajs/static` as needed. Always mount before route plugins.
