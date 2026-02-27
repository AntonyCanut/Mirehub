---
description: "NgRx state management rules"
paths:
  - "**/libs/**/data-access/**/*.ts"
  - "**/libs/**/+state/**/*.ts"
---

# NgRx Classic State Management

## File Structure

```
libs/[domain]/data-access/src/lib/+state/
  [domain].actions.ts
  [domain].reducer.ts
  [domain].effects.ts
  [domain].selectors.ts
  [domain].adapter.ts    # @ngrx/entity
  [domain].state.ts      # State interface
```

## Actions

- DO prefer `createActionGroup({ source, events })` over standalone `createAction` for better organization
- DO follow the pattern: `Load X` / `Load X Success` / `Load X Failure`

## Reducers

- DO use `@ngrx/entity` (`EntityAdapter`) for all collection state
- DO use `createReducer` with `on()` handlers
- DO NOT store derived data in state — use selectors

## Selectors

- DO use `createFeatureSelector` + `createSelector` for composition
- DO use adapter selectors (`selectAll`, `selectEntities`, `selectTotal`)
- DO compose selectors for derived data (filtering, sorting, aggregation)

## Effects — Functional Only

- DO use `createEffect(() => ..., { functional: true })`
- DO use `inject()` for services inside effects
- DO NOT dispatch actions that retrigger the same effect — causes infinite loops

## RxJS Operator Selection

| Scenario | Operator |
|---|---|
| Cancel previous, take latest | `switchMap` |
| Ignore while pending | `exhaustMap` |
| Queue sequentially | `concatMap` |
| Run in parallel | `mergeMap` |

## Component Integration

- Only smart components (`feature/`) may inject `Store`
- DO use `store.selectSignal(selector)` — never `store.select().subscribe()`
- DO dispatch actions for all state mutations

## Anti-patterns

- DO NOT store derived state — use selectors
- DO NOT dispatch from effects that trigger the same effect
- DO NOT inject `Store` in UI components — they must be presentational
- DO NOT mutate state directly — reducers must return new references
- DO NOT put business logic in effects — keep it in services
