---
description: "Angular Resource API for async data"
paths:
  - "**/*.component.ts"
  - "**/*.store.ts"
  - "**/services/**/*.ts"
  - "**/data-access/**/*.ts"
---

# Angular Resource API

## When to Use

| API | Use case |
|---|---|
| `resource()` | Async data fetching with Promise-based loaders (experimental) |
| `rxResource()` | Same but loader returns Observable (experimental) |
| `httpResource()` | Simple GET requests — replaces manual `HttpClient` + `toSignal()` (experimental) |

> **Note:** `resource()`, `rxResource()`, and `httpResource()` are experimental (as of Angular 21). API may change before stable release.

## resource() Essentials

- DO provide `request` (reactive dependencies) and `loader` (fetch function)
- Resource auto-refetches when any signal in `request` changes
- Return `undefined` from `request` to skip loading (conditional fetch)
- DO use `abortSignal` from loader params for cancellable requests
- Exposed signals: `.value()`, `.isLoading()`, `.error()`, `.status()`, `.hasValue()`
- DO call `.reload()` to force refetch after a mutation

## httpResource() — Preferred for Simple GETs

```typescript
protected readonly usersResource = httpResource<User[]>({
  url: () => `/api/users?q=${this.query()}`,
});
```

- DO prefer `httpResource()` over manual `HttpClient.get()` + `toSignal()`

## Template: Handle All States

- DO handle `isLoading()`, `error()`, and `hasValue()` in templates
- DO NOT render only the happy path — always show loading and error states

## Anti-patterns

- DO NOT use `resource()` for mutations — use service methods + `.reload()` after
- DO NOT subscribe manually in components — use `resource()` or `toSignal()`
- DO NOT ignore `abortSignal` in long-running loaders — pass it to `fetch()` or `HttpClient`
