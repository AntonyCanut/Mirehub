---
description: "TypeScript strict mode fundamentals"
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript Code Style

## Strict Mode

- Enable `strict: true`, `noImplicitAny`, `strictNullChecks` in tsconfig — non-negotiable
- Explicit return types on all exported functions

## Type System

- Use `interface` for object shapes, `type` for unions/intersections/mapped types
- Use `satisfies` operator over type assertions — preserves literal types while checking compatibility
- Ban `enum` — use `as const` + `typeof` for union types (enums have runtime quirks and poor tree-shaking)
- Prefer `unknown` over `any` — ban `any` without explicit justification + ticket reference

| Instead of `any` | Use |
|-------------------|-----|
| Unknown data | `unknown` + type guard |
| Unknown keys | `Record<string, unknown>` |
| Function args | Generic `<T>` |
| JSON response | Define interface or `unknown` |
| Third-party | `@types/*` or `declare module` |

## Lint Discipline

- NEVER disable lint rules without justification + ticket reference in comment
- `// eslint-disable-next-line @rule -- Reason, see TICKET-123`

## Anti-patterns

- DO NOT use `any` without justification — defeats entire type system
- DO NOT use non-null assertion `!` — use proper narrowing or throw
- DO NOT use `@ts-ignore` — use `@ts-expect-error` with comment (fails when fix applied)
- DO NOT export mutable state — export functions that return state
