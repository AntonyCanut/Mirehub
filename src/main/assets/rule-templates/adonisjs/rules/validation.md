---
description: "VineJS validation rules"
paths:
  - "**/app/validators/**/*.ts"
---

# VineJS Validation

## Core Principles

- VineJS is the ONLY validation layer -- do NOT use class-validator, Zod, or manual checks
- ALWAYS use `vine.compile()` to pre-compile validators -- compiles schema once, validates many times (performance)
- Export validators as named constants: `export const createUserValidator = vine.compile(...)`

## Common Schema Types

| Type | Method | Key rules |
|------|--------|-----------|
| String | `vine.string()` | `.email()`, `.url()`, `.minLength()`, `.maxLength()`, `.regex()` |
| Number | `vine.number()` | `.min()`, `.max()`, `.positive()`, `.decimal()` |
| Boolean | `vine.boolean()` | -- |
| Date | `vine.date()` | `{ formats: ['YYYY-MM-DD'] }` |
| Enum | `vine.enum([])` | Pass literal array |
| Array | `vine.array(vine.string())` | `.minLength()`, `.maxLength()` |
| Object | `vine.object({})` | Nested schemas |

## Optional and Nullable

- `.optional()` -- field can be omitted (value is `undefined`)
- `.nullable()` -- field can be `null`
- Combine: `.optional().nullable()` for fields that can be omitted or null

## Conditional Validation

- Use `.requiredWhen('field', '=', 'value')` for fields conditionally required
- Use `.requiredWhen(ref, operator, value)` for cross-field validation

## Custom Rules

- Create with `vine.createRule(async (value, options, field) => {...})`
- Report errors via `field.report(message, ruleName, field)`
- Apply with `.use(customRule())`
- Common use case: uniqueness checks against the database

## Custom Error Messages

- Use `SimpleMessagesProvider` on the validator: `validator.messagesProvider = new SimpleMessagesProvider({...})`
- Keys follow `field.rule` format: `'email.required'`, `'password.minLength'`

## Anti-patterns

- Do NOT validate manually in controllers with `if` statements -- use VineJS schemas
- Do NOT create validators inline in controllers -- export from `app/validators/` files
- Do NOT skip `.compile()` -- uncompiled validators re-parse the schema on every request
- Do NOT use VineJS for authorization logic -- validation is for data shape, not permissions
