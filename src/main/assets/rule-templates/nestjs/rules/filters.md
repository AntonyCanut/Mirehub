---
description: "NestJS exception filters"
paths:
  - "**/*.filter.ts"
  - "**/filters/**/*.ts"
---

# NestJS Exception Filters

## Execution Order

Filters applied in reverse registration order: last registered = first to catch. Layer filters by specificity.

## When to Use Filters

| Scenario | Solution |
|----------|---------|
| Catch all unhandled exceptions | `@Catch()` global filter |
| Standardize HTTP error format | `@Catch(HttpException)` filter |
| Map domain exceptions to HTTP | `@Catch(BusinessException)` filter |
| Map DB errors (Prisma P2002, P2025) | `@Catch(PrismaClientKnownRequestError)` filter |
| WebSocket errors | Extend `BaseWsExceptionFilter` |

## Directives

- DO always log exceptions in global filter (`Logger.error` with stack trace)
- DO return a consistent error shape: `{ statusCode, message, timestamp, path }`
- DO create a `BusinessException` base class with a `code` field for machine-readable error types
- DO create domain exception subclasses (e.g., `UserNotFoundException`) extending `BusinessException`
- DO create a dedicated Prisma/TypeORM exception filter mapping DB error codes to HTTP statuses

## Binding Scope

| Scope | How | DI Support |
|-------|-----|-----------|
| Global (main.ts) | `app.useGlobalFilters(new Filter())` | No |
| Global (module) | `{ provide: APP_FILTER, useClass: Filter }` | Yes |
| Controller | `@UseFilters(Filter)` | Yes |
| Method | `@UseFilters(Filter)` | Yes |

## NestJS 11: IntrinsicException

- `IntrinsicException` (NestJS 11) is a base class for exceptions that bypass automatic error logging. `HttpException` extends it. Custom exceptions extending `IntrinsicException` directly will not be auto-logged by default filters.

## Anti-patterns

- DO NOT swallow exceptions without logging — silent failures are undebuggable
- DO NOT expose stack traces or internal details in production responses
- DO NOT use a single `@Catch()` that treats all exceptions identically — layer by specificity
- DO NOT handle validation errors manually — let `ValidationPipe` + `exceptionFactory` handle them
