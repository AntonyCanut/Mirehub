---
applyTo: "**/*.ts,**/*.tsx"
---

# TypeScript Rules

## Strict Mode

- `strict: true`, `noImplicitAny`, `strictNullChecks` — non-negotiable
- Explicit return types on all exported functions

## Type System

- `interface` for object shapes, `type` for unions/intersections/mapped types
- Use `satisfies` over type assertions — preserves literal types
- No `enum` — use `as const` + `typeof` for union types
- No `any` without justification + ticket reference — use `unknown` + type guard instead

## Async Patterns

- `Promise.all()` for independent concurrent operations — never sequential `await` for independent calls
- `AbortController` for cancellable operations (pass `signal` to fetch calls)
- In React: abort on cleanup in `useEffect`
- No `forEach` with async — use `for...of` (sequential) or `Promise.all(map(...))` (parallel)

## Error Handling

- Catch at boundaries (handler level), not at every level
- Type-narrow errors: `if (error instanceof SpecificError)`
- Use `finally` for cleanup (clearTimeout, close connections)

## Discriminated Unions

- Use a literal `type` or `status` field as discriminant
- Add `default: never` in switch to catch unhandled variants at compile time

## Anti-patterns

- No `any` without justification
- No non-null assertion `!` — use proper narrowing or throw
- No `@ts-ignore` — use `@ts-expect-error` with comment
- No mutable exported state — export functions that return state
- No `.then()` chains mixed with `async/await` — pick one style
