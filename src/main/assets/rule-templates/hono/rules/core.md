---
description: "Hono v4+ project conventions and architecture"
alwaysApply: true
---

# Hono Project Guidelines

## Stack

- Hono v4+ (multi-runtime: Cloudflare Workers, Bun, Node.js, Deno)
- TypeScript strict mode
- Vitest for testing
- Zod for validation (`@hono/zod-validator`)

## App Factory

Use `createFactory<Env>()` from `hono/factory` for shared typing across all routes and middleware:

`const factory = createFactory<{ Bindings: Env; Variables: Vars }>()`

## Core Principles

- **Typed environment**: Always pass `Env` generics — `Hono<{ Bindings: B; Variables: V }>` for type-safe `c.env` and `c.var`
- **Route modules**: Each resource exports a `new Hono()` instance, mounted via `app.route('/prefix', subApp)`
- **Inline handlers**: Inline handlers required — see routes rules
- **Chained definitions**: Chain route methods on same instance — see RPC rules
- **Middleware order**: Middleware before route definitions — see middleware rules
- **Error handling**: Throw `HTTPException` from `hono/http-exception`; handle globally with `app.onError()`
- **Web Standards only**: Hono uses Web Standard APIs — avoid Node.js-specific modules in shared code
- **Response helpers**: Use `c.json()`, `c.text()` response helpers
- **Validated data**: Access validated data via `c.req.valid()` — see validation rules

## Runtime Entry Points

| Runtime            | Entry pattern                         |
|--------------------|---------------------------------------|
| Cloudflare Workers | `export default app`                  |
| Bun                | `export default app`                  |
| Node.js            | `serve(app)` from `@hono/node-server` |
| Deno               | `Deno.serve(app.fetch)`               |

## Naming Conventions

| Element     | Convention                                            |
|-------------|-------------------------------------------------------|
| Route files | Plural resource (`authors.ts`, `books.ts`)            |
| Middleware  | Descriptive name (`auth.ts`, `rate-limit.ts`)         |
| Validators  | Match route file (`authors.ts` in `validators/`)      |
| Types       | Export `AppType` for RPC, `Env` for shared bindings   |

## Commands

| Command          | Purpose                                     |
|------------------|---------------------------------------------|
| `npm run dev`    | Dev server (wrangler dev / tsx watch / bun)  |
| `npm run build`  | Production build                             |
| `npm run test`   | Vitest                                       |
| `npm run deploy` | Deploy (wrangler deploy / platform-specific) |

## Anti-patterns

- Do NOT import Node.js built-ins (`fs`, `path`, `crypto`) in shared code — breaks multi-runtime compatibility
