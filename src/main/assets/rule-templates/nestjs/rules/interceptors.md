---
description: "NestJS interceptors and response mapping"
paths:
  - "**/src/**/*.interceptor.ts"
  - "**/src/**/interceptors/**/*.ts"
---

# NestJS Interceptors

## Execution Order

Interceptors run after guards, before pipes. Multiple interceptors execute first-to-last (pre-handler), then last-to-first (post-handler, via RxJS pipe).

## Common Interceptor Types

| Interceptor | Purpose | Key RxJS Operator |
|-------------|---------|-------------------|
| Transform | Wrap response in `{ data, meta }` | `map` |
| Logging | Log method + URL + duration | `tap` |
| Timeout | Abort slow requests | `timeout` + `catchError` |
| Cache | Cache GET responses | `tap` (set) + early `of()` (hit) |
| Error mapping | Map domain errors to HTTP exceptions | `catchError` |
| Serialization | Control exposed fields via `@Expose`/`@Exclude` | Built-in `ClassSerializerInterceptor` |

## Directives

- DO use `TransformInterceptor` globally to wrap all responses in a consistent shape
- DO use `ClassSerializerInterceptor` with response DTOs using `@Expose()` / `@Exclude()`
- DO use `TimeoutInterceptor` globally (default 30s) — override per-route with a shorter/longer value
- DO use `SetMetadata` + `Reflector` to conditionally skip interceptors (e.g., `@SkipTransform()`)
- DO audit mutating operations (POST/PUT/PATCH/DELETE) via an `AuditLogInterceptor`
- DO sanitize sensitive fields (password, token) before logging or auditing

## Binding Scope

| Scope | How | DI Support |
|-------|-----|-----------|
| Global (main.ts) | `app.useGlobalInterceptors(new I())` | No |
| Global (module) | `{ provide: APP_INTERCEPTOR, useClass: I }` | Yes |
| Controller | `@UseInterceptors(I)` | Yes |
| Method | `@UseInterceptors(I)` | Yes |

## Anti-patterns

- DO NOT mutate the request object in interceptors — use middleware for request mutation
- DO NOT perform heavy I/O in interceptors without timeout protection
- DO NOT apply caching interceptors to non-GET or authenticated endpoints without cache-key differentiation
