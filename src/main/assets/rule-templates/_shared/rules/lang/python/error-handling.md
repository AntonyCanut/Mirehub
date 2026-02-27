---
description: "Python error handling and custom exceptions"
paths:
  - "**/exceptions/**/*.py"
  - "**/errors/**/*.py"
  - "**/handlers/**/*.py"
  - "**/api/**/*.py"
  - "**/routers/**/*.py"
---

# Python Error Handling

## Exception Hierarchy

- Create a base `AppError(Exception)` with `message`, `code`, and `details`
- Subclass for each domain error: `NotFoundError`, `ValidationError`, `ConflictError`, `UnauthorizedError`, `ForbiddenError`
- Each subclass sets its own `code` string (e.g., `"NOT_FOUND"`, `"VALIDATION_ERROR"`)

## Exception-to-HTTP Mapping

| Exception | HTTP Status | When |
|-----------|-------------|------|
| `ValidationError` | 400 | Input validation failed |
| `UnauthorizedError` | 401 | Authentication required |
| `ForbiddenError` | 403 | Permission denied |
| `NotFoundError` | 404 | Resource not found |
| `ConflictError` | 409 | Duplicate resource |
| `AppError` (base) | 422 | Business rule violation |
| `Exception` (unhandled) | 500 | Log full error, return generic message |

## Error Response Format

Standard JSON: `{ "error": "CODE", "message": "Human readable", "details": {} }`

## Usage in Services

- Raise typed exceptions from service layer: `raise NotFoundError("User", user_id)`
- DO NOT raise `Exception("...")` — always use typed exceptions
- Let the exception handler middleware map to HTTP responses

## Result Pattern (Alternative)

- Use `Ok[T]` / `Err[E]` dataclasses for expected failures where exceptions feel heavy
- Match with `match result: case Ok(value): ... case Err(error): ...`

## FastAPI Integration

- Register exception handlers with `@app.exception_handler(ExceptionType)`
- Always register a catch-all `Exception` handler that logs and returns 500
- Always log with `logger.exception()` for unhandled errors to capture stack trace

## Anti-patterns

- DO NOT catch `Exception` and return `None` — this swallows all errors silently
- DO NOT raise `Exception("User not found")` — use `NotFoundError("User", id)`
- DO NOT expose internal error details to clients — log internally, return generic message
- DO NOT catch and re-raise without logging — always add context before re-raising
