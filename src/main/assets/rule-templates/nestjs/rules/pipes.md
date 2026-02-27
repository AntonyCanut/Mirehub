---
description: "NestJS validation pipes"
paths:
  - "**/*.pipe.ts"
  - "**/pipes/**/*.ts"
---

# NestJS Pipes

## Execution Order

Pipes run after guards and interceptors (pre), before the controller method. Execution order: global → controller → method → parameter. Method-level pipes run before parameter-level pipes.

## Built-in Pipes Reference

| Pipe | Use Case |
|------|----------|
| `ValidationPipe` | DTO validation via class-validator (global) |
| `ParseIntPipe` | String → number for route/query params |
| `ParseUUIDPipe` | Validate UUID format (specify `version: '4'`) |
| `ParseBoolPipe` | String → boolean |
| `ParseEnumPipe` | Validate against enum values |
| `ParseArrayPipe` | Parse comma-separated values into typed array |
| `DefaultValuePipe` | Provide fallback — chain before other pipes |

## Global ValidationPipe

- DO customize `exceptionFactory` to return structured validation errors (`{ field, constraints }`)
- DO NOT enable `enableImplicitConversion` without understanding it converts all query strings automatically

## Custom Pipe Directives

- DO keep pipes lightweight — transformation and validation only, no side effects
- DO throw `BadRequestException` with a descriptive message on invalid input
- DO use `ZodValidationPipe` as an alternative to class-validator when Zod is already in the stack
- Async pipes (e.g., `UserExistsPipe` that fetches and returns entity) are valid but use sparingly — prefer service-level lookups for clarity

## Binding Scope

| Scope | How |
|-------|-----|
| Parameter | `@Param('id', ParseUUIDPipe)` |
| Method | `@UsePipes(ValidationPipe)` |
| Controller | `@UsePipes(TrimPipe)` on class |
| Global (with DI) | `{ provide: APP_PIPE, useClass: ValidationPipe }` |

## Anti-patterns

- DO NOT use pipes for logging or analytics — use interceptors
- DO NOT call external APIs in pipes — too slow; use guards or service layer
- DO NOT return raw `new Date(value)` without validating — always check `isNaN(date.getTime())`
- DO NOT create pipes with side effects (DB writes, event emission) — pipes are for input transformation only
