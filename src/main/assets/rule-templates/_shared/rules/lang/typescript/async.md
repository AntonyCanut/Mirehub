---
description: "Async/await patterns, cancellation, and pitfalls"
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript Async Patterns

## Parallel Execution

- Use `Promise.all()` for independent concurrent operations — never sequential `await` for independent calls
- Use `Promise.allSettled()` when partial failure is acceptable
- Use batched `Promise.all()` with slicing for controlled concurrency on large arrays

## Cancellation

- Use `AbortController` for cancellable operations (fetch, timers, long tasks)
- Always pass `signal` through to underlying fetch calls
- In React: abort on cleanup in `useEffect` — prevents state updates on unmounted components

## Pitfalls

- DO NOT leave floating promises — every promise must be `await`ed or explicitly caught
- DO NOT use `async` in constructors — use static factory method `static async create()`
- DO NOT use `forEach` with async callbacks — it doesn't await; use `for...of` (sequential) or `Promise.all(map(...))` (parallel)
- DO NOT catch errors without rethrowing or logging — silent swallowing hides bugs

## Error Handling

- Catch at boundaries (controller, handler), not at every level
- Type-narrow errors: `if (error instanceof SpecificError)` before accessing properties
- Use `finally` for cleanup (clearTimeout, close connections)

## Anti-patterns

- DO NOT await independent operations sequentially — wastes time proportional to call count
- DO NOT skip `AbortController` cleanup in UI — causes memory leaks and stale state updates
- DO NOT use `catch(() => {})` — silent error swallowing, always log minimum context
- DO NOT mix `.then()` chains with `async/await` — pick one style per function
