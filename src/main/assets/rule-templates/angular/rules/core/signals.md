---
description: "Angular Signals and reactivity patterns"
paths:
  - "**/*.component.ts"
  - "**/*.component.html"
  - "**/*.store.ts"
  - "**/+state/**/*.ts"
  - "**/data-access/**/*.ts"
---

# Signals & Reactivity

## Decision Matrix: Derived State

| Need | Use | Why |
|---|---|---|
| Read-only derived value | `computed()` | Pure derivation, auto-tracked, memoized |
| Writable value that resets on source change | `linkedSignal()` (stable since v20) | Pagination reset, form defaults from server |
| Side effect (logging, analytics, DOM) | `effect()` | Last resort — prefer computed/linkedSignal first |

## Signal Basics

- DO use `signal()` for local writable state
- DO use `computed()` for any derived value — it is lazy and memoized
- DO NOT set signals inside `computed()` — computed must be pure (no side effects)
- DO NOT use `effect()` where `computed()` or `linkedSignal()` would suffice

## linkedSignal()

- Creates a writable signal that auto-resets when its tracked source changes
- User can still write to it manually between resets

```typescript
protected readonly currentPage = linkedSignal(() => {
  this.searchQuery(); // track dependency
  return 1;           // reset to page 1 on query change
});
```

## effect() — Use Sparingly

- Runs when any read signal inside changes
- DO provide `onCleanup` callback for subscriptions or timers

## RxJS Interop

- `toSignal(observable$, { initialValue })` — Observable to signal
- `toObservable(signal)` — signal to Observable (use when you need RxJS operators like `debounceTime`)
- `takeUntilDestroyed(destroyRef)` — auto-unsubscribe on destroy

## Anti-patterns

- DO NOT subscribe in `ngOnInit` — use `toSignal()` or `resource()`
- DO NOT use `computed()` for state you need to write — use `linkedSignal()`
- DO NOT chain multiple `effect()` calls — prefer declarative computed/linkedSignal graphs
