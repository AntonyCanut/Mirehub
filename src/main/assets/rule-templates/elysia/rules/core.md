---
description: "Elysia v1.4+ project conventions and architecture"
alwaysApply: true
---

# Elysia Project Guidelines

## Stack

- Elysia v1.4+ on Bun runtime (Node.js via `@elysiajs/node` only when required)
- TypeScript strict mode
- Bun test runner (`bun:test`)
- TypeBox for validation (built-in `Elysia.t`)
- Eden Treaty v2 for end-to-end type-safe client

## Commands

- `bun run dev` — dev server (--hot)
- `bun run build` — production build
- `bun test` — run tests
- `bun run lint` — lint

## Core Principles

- **Method chaining mandatory** — see routes rules
- **Inline handlers** — inline handlers for type inference, see routes rules
- **Controller = Elysia instance** — one instance per resource with `prefix`, mounted via `.use()`; pass destructured values to services, never the full Context
- **Plugin deduplication** — always set `name` in plugins, see plugins rules
- **Hook order matters** — see lifecycle rules
- **Encapsulation** — hooks are scoped to their instance by default; use `as('scoped')` or `as('global')` to propagate
- **Single source of truth** — one TypeBox schema drives runtime validation, TS types, and OpenAPI docs

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Module directory | Plural resource | `users/`, `posts/` |
| Plugin file | Descriptive name | `auth.ts`, `rate-limit.ts` |
| Model file | `model.ts` per module | `modules/users/model.ts` |
| App type export | `App` | `export type App = typeof app` |

## Anti-Patterns

See specialized rule files for detailed anti-patterns (routes, plugins, lifecycle, eden).

## Code Style

- Prefer `Elysia.t` (TypeBox) over external validators
- Use `guard()` to apply shared schemas across multiple routes
- Use `derive` for request-scoped context, `decorate` for static utilities, `state` for mutable stores
- Keep modules small — one Elysia instance per resource
- Lazy-load modules with dynamic imports for faster startup (see plugins rules)
