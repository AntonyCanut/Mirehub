---
description: "NgRx SignalStore state management"
paths:
  - "**/libs/**/data-access/**/*.ts"
  - "**/*.store.ts"
  - "**/+state/**/*.ts"
---

# NgRx SignalStore

## When to Use

| Use SignalStore | Use Classic NgRx (Store + Effects) |
|---|---|
| New features / projects | Existing NgRx codebase |
| Feature-level or component-level state | App-wide state with DevTools |
| Simpler mental model, less boilerplate | Complex async orchestration (marble-testable) |

## Store Structure

- `signalStore(withState, withComputed, withMethods, withHooks)` — compose features declaratively
- DO use `{ providedIn: 'root' }` for singleton stores (auth, global config)
- DO provide component-level stores in `@Component({ providers: [MyStore] })`

## State Updates

- DO use `patchState(store, { key: newValue })` — never mutate state directly
- DO use `withEntities<T>()` from `@ngrx/signals/entities` for collections
- Entity helpers: `setAllEntities`, `addEntity`, `updateEntity`, `removeEntity`

## Computed (withComputed)

- DO derive filtered/sorted/aggregated data in `withComputed`
- Computed must be pure — no side effects, no async

## Async Methods

- DO use `async` methods in `withMethods` for API calls
- DO manage loading/error state via `patchState` at start/success/failure
- DO use `firstValueFrom()` to convert Observable services to Promise

## RxJS Integration (rxMethod)

- DO use `rxMethod<T>(pipe(...))` for streams needing debounce, switchMap, etc.
- `rxMethod` accepts signals, observables, or raw values

## Custom Features (signalStoreFeature)

- DO extract reusable patterns into `signalStoreFeature` (e.g., `withLoading()`, `withPagination()`)

## Hooks

- `withHooks({ onInit, onDestroy })` — `onInit` runs when store is first injected
- DO use `onInit` for auto-loading data

## Anti-patterns

- DO NOT mutate arrays/objects in state — always create new references via `patchState`
- DO NOT put async logic in `withComputed` — use `withMethods`
- DO NOT instantiate stores with `new` — always use `inject()`
- DO NOT provide a `providedIn: 'root'` store in component `providers` — creates duplicate
- DO NOT confuse SignalStore with classic Store — SignalStore exposes signals directly (`store.myProp()`), not selectors
