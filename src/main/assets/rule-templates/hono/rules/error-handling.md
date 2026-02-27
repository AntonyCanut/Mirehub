---
description: "Hono error handling with HTTPException and global handlers"
paths:
  - "**/src/index.ts"
  - "**/src/app.ts"
  - "**/src/routes/**/*.ts"
  - "**/src/middleware/**/*.ts"
---

# Hono Error Handling

## Global Error Handler

- Register `app.onError()` once on the root app — catches all thrown errors
- Check `err instanceof HTTPException` to return structured HTTP errors
- Log unexpected errors and return generic 500 for non-HTTPException errors

## HTTPException

- Import from `hono/http-exception`
- Throw `HTTPException` with status code and message for all expected errors (404, 401, 403, 422)
- Supports optional `res` property for fully custom Response objects
- Throw from handlers AND middleware — both flow to `app.onError()`

## Custom 404 Handler

- Register `app.notFound()` on the root app for unmatched routes
- Return consistent error shape matching your `app.onError()` format

## Error Response Shape

- Use a single consistent error shape across the entire API
- Include at minimum: `status` (number) and `message` (string)
- Add `details` field for validation errors (field-level)

## Decision: Error Type to Use

| Situation                | Approach                                          |
|--------------------------|---------------------------------------------------|
| Known HTTP error         | `throw new HTTPException(status, { message })`    |
| Validation failure       | Let `zValidator` handle (auto 400) or custom hook |
| Unexpected/unknown error | Let it propagate to `app.onError()` as 500        |
| Route not found          | `app.notFound()` handler                          |

## Anti-patterns

- Do NOT return `c.json({ error }, 404)` for errors — skips the global error handler, prevents centralized logging
- Do NOT throw plain `Error` — loses HTTP status, results in generic 500
- Do NOT catch errors in individual handlers just to re-format — centralize in `app.onError()`
- Do NOT forget `await next()` in middleware try/catch — downstream handlers won't execute
