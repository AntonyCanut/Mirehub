---
description: "Angular HTTP client and interceptors"
paths:
  - "**/interceptors/**"
  - "**/services/**/*.service.ts"
  - "**/*.interceptor.ts"
---

# HTTP & Interceptors

## Data Fetching Strategy

| Scenario | Use |
|---|---|
| Simple GET (read-only) | `httpResource()` — declarative, signal-based |
| GET with RxJS operators (debounce, retry) | `rxResource()` or `HttpClient` + `toSignal()` |
| Mutations (POST/PUT/PATCH/DELETE) | `HttpClient` in a service method |
| Complex orchestration (parallel, conditional) | `HttpClient` with RxJS operators |

## Interceptors — Functional Only

- DO use `HttpInterceptorFn` (functional) — never class-based `HttpInterceptor`
- DO register via `provideHttpClient(withInterceptors([...]))` in `app.config.ts`
- DO use `inject()` inside interceptors for DI

Common interceptors: auth (add Bearer token), error (global error handling), retry (exponential backoff on GET), loading (show/hide spinner).

## API Service Pattern

- DO create a base `ApiService` with typed CRUD methods wrapping `HttpClient`
- DO inject `API_BASE_URL` token — never hardcode URLs
- DO create domain services (`UserService`, `ProductService`) that delegate to `ApiService`

## Error Handling

- DO handle errors at interceptor level for global concerns (401 redirect, 500 toast)
- DO let 422 (validation) errors propagate to the component for field-level display
- DO always provide user feedback on error — never silently swallow

## Anti-patterns

- DO NOT use class-based interceptors — they are legacy (prefer `HttpInterceptorFn`). Use `withInterceptorsFromDi()` only for migration
- DO NOT hardcode API URLs — use injection tokens
- DO NOT subscribe without error handling — always handle the error path
- DO NOT create wrapper services that just re-export HttpClient methods without adding value
