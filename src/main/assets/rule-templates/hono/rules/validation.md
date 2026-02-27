---
description: "Hono validation with Zod and built-in validators"
paths:
  - "**/src/validators/**/*.ts"
  - "**/src/routes/**/*.ts"
  - "**/src/schemas/**/*.ts"
---

# Hono Validation

## Zod Validator (Default)

- Use `@hono/zod-validator` as the default validation approach
- Apply via `zValidator(target, schema)` as route middleware — auto-returns 400 on failure
- Access validated data with `c.req.valid('json')` / `c.req.valid('query')` / `c.req.valid('param')` — fully typed

## Validation Targets

| Target     | Usage                              | Typical schema                     |
|------------|------------------------------------|------------------------------------|
| `'json'`   | `zValidator('json', schema)`       | Request body                       |
| `'query'`  | `zValidator('query', schema)`      | Query parameters (use `z.coerce`)  |
| `'param'`  | `zValidator('param', schema)`      | Path parameters                    |
| `'header'` | `zValidator('header', schema)`     | Request headers                    |
| `'cookie'` | `zValidator('cookie', schema)`     | Cookies                            |

## Multiple Validators

- Chain multiple `zValidator()` calls on the same route for combined validation
- Each target is validated independently and accessed via its own `c.req.valid(target)` call

## Custom Error Response

- Pass a third callback argument to `zValidator` for custom error formatting
- Callback receives `(result, c)` — check `result.success` and return custom response on failure
- Use `result.error.flatten().fieldErrors` for field-level error details

## Schema Organization

- Define schemas in `src/validators/` or `src/schemas/` — one file per resource, matching route file name
- Use `schema.partial()` for update/patch variants
- Share common schemas (pagination, ID params) across resources
- Use `z.coerce.number()` for query params — they arrive as strings

## Built-in Validator

- `validator(target, fn)` from `hono/validator` — for simple cases without Zod
- Only use for trivial validations (1-2 fields) — use Zod for anything more complex

## Anti-patterns

- Do NOT manually parse and validate with `c.req.json()` + `schema.safeParse()` — use `zValidator` for auto 400 + typing
- Do NOT use the built-in validator for complex schemas — Zod gives you type inference, reusability, and cleaner code
- Do NOT forget `z.coerce` for query/param schemas — raw values are always strings from the URL
- Do NOT duplicate schema definitions across route files — centralize in `validators/` or `schemas/`
