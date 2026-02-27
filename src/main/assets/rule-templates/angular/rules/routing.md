---
description: "Angular routing and lazy loading"
paths:
  - "**/*.routes.ts"
  - "**/app.routes.ts"
  - "**/app.config.ts"
---

# Routing

## Route Configuration

- DO use `loadComponent` for lazy-loaded standalone components
- DO use `loadChildren` for lazy-loaded feature route files
- DO export feature routes as `export default [...] satisfies Routes`
- DO add `withComponentInputBinding()` to `provideRouter()` for route param binding

## Guards — Prefer Functional

- DO prefer `CanActivateFn`, `CanDeactivateFn` — functional is simpler (class-based also supported)
- DO use `inject()` inside guard functions for DI
- DO return `UrlTree` for redirects (not `Router.navigate()` inside guards)
- For parameterized guards, use factory: `roleGuard(['admin']): CanActivateFn`

## Resolvers

- DO prefer `ResolveFn<T>` — functional is simpler (class-based also supported)
- DO handle errors in resolvers (redirect on failure via `catchError` + `EMPTY`)
- DO consume resolved data via `toSignal(this.route.data.pipe(map(...)))`

## Route Parameters

- DO use `toSignal()` with `route.paramMap` / `route.queryParamMap` — never subscribe manually
- DO use `withComponentInputBinding()` to bind route params directly to component inputs

## Navigation

- DO use relative navigation (`this.router.navigate(['edit'], { relativeTo: this.route })`)
- DO NOT hardcode full URL paths in `navigateByUrl()`

## Preloading

- DO configure preloading strategy in `provideRouter()` for better UX
- Options: `PreloadAllModules`, or custom strategy for selective preloading

## Title & Meta

- DO set `title` on route definitions
- DO use custom `TitleStrategy` for app-wide title formatting

## Anti-patterns

- DO NOT default to class-based guards — functional guards are simpler and sufficient for most cases
- See signals rules for `toSignal()` over manual subscriptions
- DO NOT use named outlets unless absolutely necessary — they add complexity
