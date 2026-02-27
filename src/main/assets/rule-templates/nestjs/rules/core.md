---
description: "NestJS 11+ project conventions and architecture"
alwaysApply: true
---

# NestJS Project Guidelines

## Stack

- NestJS 11+ with TypeScript strict mode
- Node.js 20+
- Vitest + Supertest for testing
- Prisma (preferred) or TypeORM for data access

## Architecture — Modular Monolith

- One module = one bounded domain context
- Modules communicate only via exported services — never import internal providers
- Use barrel exports (`index.ts`) per module for clean cross-module imports
- Feature modules live under `src/modules/[feature]/`; shared utilities under `src/common/`

## Request Lifecycle

Request → Middleware → Guard → Interceptor (pre) → Pipe → Controller → Interceptor (post) → Filter (on error) → Response

## Layer Responsibilities

| Layer | Responsibility | Anti-pattern |
|-------|---------------|-------------|
| Controller | HTTP I/O only — parse, delegate, return | Business logic in controllers |
| Service | All business logic, orchestration | Direct DB access from controllers |
| Repository | Data access, query building | Business rules in repositories |
| DTO | Input validation via class-validator | Undecorated DTO properties |

## Exception Handling

- DO use built-in NestJS HTTP exceptions (`NotFoundException`, `ConflictException`, etc.)
- NestJS 11: `HttpException` extends `IntrinsicException` — see filters rules
- DO create domain-specific exception classes extending `HttpException` for business rules
- DO NOT throw generic `Error` — always use typed exceptions

## Validation (Global)

Enable `ValidationPipe` globally in `main.ts`: `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.

## Environment Configuration

- DO validate all env vars at startup with a Zod schema via `ConfigModule.forRoot({ validate })`
- DO NOT access `process.env` directly in services — always use typed `ConfigService`
- DO use `configService.getOrThrow()` for required values

## Authentication

- Auth: Passport.js + JWT, global `JwtAuthGuard` via `APP_GUARD`, `@Public()` for opt-out — see auth rules for details

## Code Style

- Constructor injection with `readonly` for all injected dependencies
- DO NOT use property injection (`@Inject()` on fields) — harder to test
- Async methods return `Promise<T>` with explicit return types
- Use built-in pipes for params: `ParseUUIDPipe`, `ParseIntPipe`, `ParseEnumPipe`
- Mapped types (`PartialType`, `PickType`, `OmitType`) — see validation rules

## Commands

```bash
npm run start:dev       # Dev with watch
npm run build           # Production build
npm run test            # Unit tests (Vitest)
npm run test:e2e        # E2E tests
npm run test:cov        # Coverage
```
