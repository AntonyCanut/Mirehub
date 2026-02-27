---
description: "Advanced TypeScript types, guards, and inference"
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript Advanced Types

## Discriminated Unions

- Use a literal `type` or `status` field as discriminant — enables exhaustive `switch` checking
- Prefer discriminated unions over optional fields for state modeling (loading/success/error)
- Add `default: never` in switch to catch unhandled variants at compile time

## Type Guards

- Use type predicates (`value is User`) for reusable runtime checks on `unknown` data
- Use assertion functions (`asserts value is T`) for preconditions that throw on failure
- Prefer `in` operator narrowing for simple property checks

## Const Assertions

- Use `as const` on literal objects/arrays to preserve literal types — replaces `enum`
- Derive union types from const arrays: `typeof ROLES[number]`
- Derive union types from const objects: `typeof STATUS[keyof typeof STATUS]`

## `satisfies` Operator

- Use `satisfies` to validate a type without widening — preserves literal inference
- Prefer `satisfies` over type annotations when you want both type checking and literal narrowing
- Use for config objects, route maps, and enum-like constants

## Utility Types

Prefer built-in utility types (`Partial`, `Pick`, `Omit`, `Record`, `Extract`, `Exclude`) over manual type manipulation.

## Anti-patterns

- DO NOT use `any` in generics — use `unknown` or constrain with `extends`
- DO NOT over-abstract with conditional types — if the type is unreadable, simplify
- DO NOT use `infer` when a utility type already exists (`ReturnType`, `Parameters`, `Awaited`)
- DO NOT create generic types with more than 3 type parameters — decompose instead
