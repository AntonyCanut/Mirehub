---
description: "Zustand state management with Next.js"
paths:
  - "**/*store*.ts"
  - "**/*store*.tsx"
  - "**/stores/**/*.ts"
---

# Zustand

## When to Use Zustand (vs Redux or Server State)

| Use Zustand | Do NOT Use Zustand |
|-------------|-------------------|
| Small-medium client state | Data fetchable in Server Components |
| Minimal boilerplate needed | Complex state requiring middleware/devtools |
| Quick prototyping | State that needs time-travel debugging |
| Simple cross-component sharing | Already using Redux in the project |

## Key Directives

- DO keep stores small and focused — one store per domain concern
- DO use selectors for performance: `useStore((s) => s.field)` re-renders only when `field` changes
- DO use `useShallow` when selecting multiple fields as an object — prevents unnecessary re-renders
- DO use `immer` middleware for complex nested state updates
- DO use `persist` middleware for state that survives page refresh (theme, preferences)
- DO define actions inside the store — co-locate state and behavior

## Store Pattern

Define `interface` with state + actions in a single type.
Use `create<StoreType>()` with all state and actions together.

## Slices (Large Stores)

Use `StateCreator` for slice pattern when a store grows beyond one concern.
Combine slices with spread: `create<Combined>((...a) => ({ ...sliceA(...a), ...sliceB(...a) }))`.

## Testing

Reset store state in `beforeEach` via `useStore.setState({ ... })`.
Use `renderHook` + `act` from Testing Library for hook testing.

## Anti-Patterns

- DO NOT put Server Component data in Zustand — pass as props from server
- DO NOT destructure the entire store (`const { a, b, c } = useStore()`) — re-renders on any change
- DO NOT create stores inside components — define at module level
- DO NOT mix Zustand and Redux in the same project — pick one
