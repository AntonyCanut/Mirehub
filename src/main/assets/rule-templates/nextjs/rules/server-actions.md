---
description: "Next.js Server Actions and mutations"
paths:
  - "**/actions.ts"
  - "**/actions.tsx"
  - "**/actions/**/*.ts"
  - "**/actions/**/*.tsx"
  - "**/_actions/**/*.ts"
  - "**/_actions/**/*.tsx"
  - "**/*.action.ts"
  - "**/*.actions.ts"
  - "**/app/**/page.tsx"
  - "**/app/**/route.ts"
---

# Server Actions

## Security — Treat as Public POST Endpoints

Every Server Action is an exposed HTTP POST endpoint. ALWAYS:
- **Authenticate** — verify session/token before any logic
- **Authorize** — check user has permission for the operation
- **Validate** — parse input with Zod (never trust `formData` raw)

## Return Type Pattern

DO use a discriminated union for all action results:

```typescript
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };
```

## Key Directives

- DO add `'use server'` at the top of action files (not inline per function)
- DO validate ALL inputs with Zod `safeParse` before any DB operation
- DO call `revalidateTag()` or `revalidatePath()` after every mutation
- DO use `.bind(null, id)` to pass additional arguments from client components
- DO colocate actions in `actions.ts` next to the page that uses them

## Client Integration

- `useActionState(action, initialState)` — replaces deprecated `useFormState`; returns `[state, formAction, isPending]`
- The action passed to `useActionState` receives `(previousState: State, formData: FormData)` — note the extra first parameter compared to standalone Server Actions
- `useOptimistic(state, updateFn)` — for instant UI feedback before server confirms

## Anti-Patterns

- DO NOT skip validation — Server Actions accept arbitrary POST bodies
- DO NOT forget revalidation after mutations — UI will show stale data
- DO NOT use `router.refresh()` — use `revalidatePath` / `revalidateTag`
- DO NOT return sensitive data (password hashes, tokens) in action results
- DO NOT use Server Actions for data reads — use Server Components instead
