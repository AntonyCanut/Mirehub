---
description: "AdonisJS service layer patterns"
paths:
  - "**/app/services/**/*.ts"
---

# AdonisJS Services

## Principles

- Services contain ALL business logic -- controllers only delegate
- One service per domain entity or bounded context
- Services are stateless -- no instance properties storing request data

## Dependency Injection

- For complex setup or interfaces, register singletons in `providers/app_provider.ts` via `this.app.container.singleton()`

## Service Structure

- Place in `app/services/` with snake_case filenames
- Export as default class
- Public methods = business operations, private methods = internal helpers

## Error Handling

- NEVER return error objects -- always throw

## Service-to-Service Communication

- Inject other services via constructor DI
- Keep dependency chains shallow (max 2-3 levels)
- Extract shared logic into dedicated services rather than creating circular dependencies

## Anti-patterns

- Do NOT access `HttpContext` (request/response) in services -- pass only the data needed
- Do NOT return HTTP responses from services -- return data or throw exceptions
- Do NOT create god services -- split by domain boundary
- Do NOT duplicate model query logic -- use model scopes or query methods on the model itself
