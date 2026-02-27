---
description: "Hono RPC for type-safe client-server communication"
paths:
  - "**/src/client.ts"
  - "**/src/client/**/*.ts"
  - "**/src/routes/**/*.ts"
  - "**/src/index.ts"
---

# Hono RPC

## Server-Side Setup

- Chain all route methods on the same Hono instance — non-chained routes lose type information
- Export `AppType` from the server entry point for client consumption:
  `export type AppType = typeof app`
- Mount sub-apps with `app.route()` — the mounted type is preserved in `AppType`

## Client-Side Usage

- Create typed client with `hc<AppType>()` from `hono/client` — provides end-to-end type safety
- Client mirrors server route structure: `client.posts.$get()`, `client.posts.$post({ json: data })`
- Path params use bracket syntax: `client.posts[':id'].$get({ param: { id: '123' } })`

## Type Utilities

- `InferRequestType<typeof client.endpoint.$method>` — extract request type for any endpoint
- `InferResponseType<typeof client.endpoint.$method>` — extract response type
- `InferResponseType<..., 200>` — narrow to a specific status code for union discrimination

## URL and Path Helpers

- `client.endpoint.$url({ param })` — get typed URL object with base URL
- `client.endpoint.$path({ param })` — get path string only (no base URL)

## Large App Performance

- RPC type inference can slow IDE on large apps
- Split into smaller route modules and export per-module types: `export type PostsType = typeof postsRoute`
- Keep route modules focused — fewer chained methods per instance

## Requirements for RPC to Work

| Requirement              | Why                                                    |
|--------------------------|--------------------------------------------------------|
| Chained route methods    | TypeScript infers return types only from method chains |
| Inline handlers          | See routes rules                                      |
| `export type AppType`    | Client needs the app type for `hc<AppType>()`         |
| Zod validators in chain  | Validates AND types request body/query/params          |

## Anti-patterns

- Do NOT define routes with separate `app.get()` / `app.post()` statements — `AppType` won't include route details
- Do NOT manually type RPC responses — use `InferResponseType` / `InferRequestType` instead
- Do NOT create one massive route file for RPC — split into modules to keep IDE responsive
- Do NOT forget to export `AppType` — client has no type information without it
