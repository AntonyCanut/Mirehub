---
description: "Redux Toolkit with Next.js"
paths:
  - "**/*slice*.ts"
  - "**/*store*.ts"
  - "**/store/**/*.ts"
  - "**/redux/**/*.ts"
---

# Redux Toolkit

## When to Use Redux (vs Zustand or Server State)

| Use Redux | Do NOT Use Redux |
|-----------|-----------------|
| Complex client state with many reducers | Simple UI state (use `useState`) |
| State shared across many distant components | Server data already in Server Components |
| Need middleware, devtools, time-travel | Small project with minimal client state |
| RTK Query for client-side data fetching | Data that can be fetched server-side |

## Key Directives

- DO use `makeStore()` factory — creates a new store per request in SSR
- DO wrap app with `StoreProvider` (client component) using `useRef` to avoid re-creation
- DO create typed hooks: `useAppDispatch`, `useAppSelector`, `useAppStore` via `.withTypes<>()`
- DO co-locate selectors with their slice
- DO handle all 3 async thunk states: `pending`, `fulfilled`, `rejected`
- DO use RTK Query for client-side API calls — handles caching, dedup, polling

## Slice Structure

- One slice per feature domain
- Define `interface` for state, typed `PayloadAction` for reducers
- Export actions and selectors from the same file

## Next.js-Specific

- Store must be created per-request (factory pattern) — no global singleton
- Provider must be a client component wrapping `children` in layout
- DO NOT hydrate Redux with Server Component data — pass as props instead

## Anti-Patterns

- DO NOT duplicate Server Component data in Redux — pass via props
- DO NOT use untyped `useDispatch` / `useSelector` — always use typed hooks
- DO NOT put everything in Redux — local state and server state have better homes
- DO NOT forget `extraReducers` for async thunks — silent failures otherwise
