---
description: "React 19+ project conventions and architecture"
alwaysApply: true
---

# React Project Guidelines

## Stack

- React 19+ with React Compiler 1.0 (auto-memoization enabled)
- TypeScript strict mode
- Vite (bundler) + Vitest + React Testing Library

## Architecture

Organize by feature, colocate related code:

```
src/
  components/ui/       # Design system primitives
  features/[feature]/  # components/, hooks/, api/, types.ts
  hooks/               # Shared custom hooks
  lib/                 # Utilities and helpers
  api/                 # API client and endpoints
  types/               # Shared TypeScript types
```

## React 19 Baseline

- **React Compiler**: Handles memoization automatically
- **`ref` as prop**: Pass `ref` directly — `forwardRef` is unnecessary
- **`use()` hook**: Unwrap promises and context in render, supports conditional calls
- **`useActionState`**: Replaces deprecated `useFormState` for form submissions
- **`useOptimistic`**: Optimistic UI updates during async transitions
- **Actions**: Async functions for `<form action={fn}>` pattern

## Component Model

In a Vite SPA, all components are client components by default — no `"use client"` directive needed.

When using an RSC-capable framework (Next.js, React Router v7 framework mode):

| Server Components | Client Components |
|-------------------|-------------------|
| Default — no `"use client"` needed  | Add `"use client"` only when using state/effects/browser APIs |
| Fetch data directly, async allowed  | `useState`, `useEffect`, event handlers |

## Code Style

- Ban `React.FC` — use plain function declarations with typed props
- One component per file, named exports only (no default exports)
- Files: `kebab-case.tsx` / Components: `PascalCase` / Hooks: `useCamelCase`
- Props interface declared above component, destructured in signature

### Component Internal Order

1. Imports → 2. Types → 3. Component function → 4. Hooks → 5. Derived state → 6. Handlers → 7. Effects → 8. JSX

## Anti-Patterns

- Do NOT add `useMemo`/`useCallback`/`React.memo` — React Compiler handles it
- Do NOT use `React.FC` — provides no benefit over plain function declarations and adds unnecessary indirection
- Do NOT use class components or HOCs — use hooks and composition

## Commands

```bash
npm run dev             # Dev server
npm run build           # Production build
npm run test            # Run tests
npm run lint            # ESLint
npm run typecheck       # TypeScript check
```

## Performance

- Lazy load routes and heavy components with `React.lazy` + Suspense
- Use Suspense boundaries as the default loading pattern
- Extract complex object/array prop literals to named variables for readability (React Compiler handles memoization)
- Profile with React DevTools before optimizing — trust the compiler first
