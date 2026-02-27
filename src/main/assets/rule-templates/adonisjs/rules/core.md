---
description: "AdonisJS 6+ project conventions and architecture"
alwaysApply: true
---

# AdonisJS Project Guidelines

## Stack

- AdonisJS 6+ with TypeScript strict mode
- Node.js 20+, Lucid ORM, VineJS, Japa test runner

## Layer Responsibilities

| Layer | Responsibility | Anti-pattern |
|-------|---------------|-------------|
| Controller | HTTP handling only, delegates to services | Business logic in controllers |
| Service | Business logic, orchestration | Direct HTTP access (`request`, `response`) |
| Model | Data structure, relationships, hooks | Query logic outside model/service |
| Validator | Input validation via VineJS | Manual `if` checks in controllers |
| Middleware | Cross-cutting concerns (auth, logging) | Business logic in middleware |

## Dependency Injection

- Use `@inject()` on classes for constructor-based DI via the IoC container
- Use `@inject()` on individual methods for method-level DI when constructor DI is not appropriate
- NEVER instantiate services manually (`new Service()`) -- breaks testability

## Naming Conventions

| Artifact | Convention | Example |
|----------|-----------|---------|
| Controller | PascalCase, plural | `UsersController` |
| Model | PascalCase, singular | `User` |
| Validator | Action + Model + `Validator` | `CreateUserValidator` |
| Service | Model + `Service` | `UserService` |
| Middleware | Purpose + `Middleware` | `AdminMiddleware` |
| Migration | `TIMESTAMP_verb_table_table` | `1234_create_users_table` |

## Request Lifecycle

Request --> Server Middleware --> Router Middleware --> Route Middleware --> Controller --> Response

## Routing

- Use lazy controller imports: `const UsersController = () => import('#controllers/users_controller')`
- Use `router.resource()` for CRUD, `.apiOnly()` for API-only resources
- Group routes with shared middleware via `router.group().use()`

## Error Handling

- Extend `Exception` from `@adonisjs/core/exceptions` for domain errors
- Set `static status` and `static code` on custom exceptions
- Let AdonisJS exception handler convert exceptions to HTTP responses

## Commands

```bash
node ace serve --watch          # Dev server
node ace build                  # Production build
node ace test                   # Run tests
node ace migration:run          # Run pending migrations
```

Run `node ace list` for all generators and available commands.
