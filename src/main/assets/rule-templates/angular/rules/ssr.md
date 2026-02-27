---
description: "Angular SSR and hydration"
paths:
  - "**/app.config.ts"
  - "**/app.config.server.ts"
  - "**/app.routes.server.ts"
  - "**/server.ts"
  - "**/main.server.ts"
---

# SSR & Hydration

## Render Modes (`app.routes.server.ts`)

| Mode | Use case | SEO | Performance |
|---|---|---|---|
| `RenderMode.Prerender` | Static/marketing pages | Best | Best (cached) |
| `RenderMode.Server` | Dynamic content, user-specific | Good | Good |
| `RenderMode.Client` | Dashboards, auth-gated areas | None | Fastest initial |

- DO configure render mode per route in `ServerRoute[]`
- DO use `getPrerenderParams()` for dynamic prerendered routes

## Hydration

- DO enable `provideClientHydration(withEventReplay())` in `app.config.ts`
- DO use `ngSkipHydration` on components that will always differ server vs client (clocks, presence)

## Incremental Hydration with @defer

Non-obvious syntax — use hydration triggers on `@defer` blocks:

```html
@defer (hydrate on interaction) { <app-comments /> }
@defer (hydrate on viewport) { <app-chart /> }
@defer (hydrate on idle) { <app-recommendations /> }
@defer (hydrate on timer(5s)) { <app-analytics /> }
@defer (hydrate never) { <app-static-footer /> }
```

- `hydrate on interaction` — hydrate when user clicks/focuses
- `hydrate on viewport` — hydrate when element enters viewport
- `hydrate on idle` — hydrate during browser idle time
- `hydrate never` — server-render only, never hydrate on client

## Browser-Only Code

- DO use `afterNextRender(() => { ... })` for one-time DOM init (charts, third-party libs)
- DO use `afterRender(() => { ... })` for post-render side effects every cycle
- DO NOT access `window`, `localStorage`, `document` outside `afterNextRender`

## Transfer State

- DO use `TransferState` + `makeStateKey` to avoid duplicate HTTP requests
- HttpClient with `provideClientHydration()` handles transfer state for HTTP GETs automatically

## Anti-patterns

- DO NOT access browser APIs (`window`, `localStorage`, `document`) without platform check or `afterNextRender` — crashes on server
- DO NOT use `setTimeout` as a substitute for `afterNextRender`
- DO NOT generate time-dependent content on the server — causes hydration mismatch
- DO NOT skip hydration on interactive components — only on truly static divergent content
