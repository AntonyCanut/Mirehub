---
description: "NestJS module organization"
paths:
  - "**/src/**/*.module.ts"
  - "**/src/**/*.controller.ts"
  - "**/src/**/*.service.ts"
  - "**/src/main.ts"
---

# NestJS Module Architecture

## Module Design Principles

- Use `@Global()` sparingly — only for truly cross-cutting modules (Config, Prisma, Logger)

## Dynamic Modules

- DO use `forRoot()` / `forRootAsync()` for global configuration modules (DB, cache, queue)
- DO use `forFeature()` for per-module registration (entities, repositories)
- DO use `registerAsync()` with `inject: [ConfigService]` for async configuration

## Controller Rules

- DO NOT inject repositories into controllers — always go through a service
- DO NOT put conditional logic, data transformation, or error handling beyond delegation in controllers

## Service Rules

- DO inject only the services you need — avoid god-services with 10+ dependencies

## Dependency Injection

- DO use `Symbol` injection tokens for non-class dependencies (config objects, constants)
- DO register global providers via `APP_GUARD`, `APP_INTERCEPTOR`, `APP_FILTER`, `APP_PIPE` — not `main.ts` `useGlobal*()` — to enable DI

## Anti-patterns

- DO NOT create "kitchen sink" modules with multiple controllers and unrelated services
- DO NOT import the same module in every feature module — make it `@Global()` or restructure
- DO NOT export providers that should remain internal to the module
