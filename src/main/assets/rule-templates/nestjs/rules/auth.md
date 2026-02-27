---
description: "NestJS authentication and guards"
paths:
  - "**/src/**/auth/**/*.ts"
  - "**/src/**/*.guard.ts"
  - "**/src/**/*.strategy.ts"
---

# NestJS Authentication

## Strategy

- DO use Local strategy for the login endpoint alongside the global JWT strategy
- DO use `configService.getOrThrow('JWT_SECRET')` — never hardcode secrets

## Custom Decorators

- `@Public()` — sets `isPublic` metadata, checked by `JwtAuthGuard.canActivate()`
- `@CurrentUser(field?)` — `createParamDecorator` extracting `request.user` or a sub-field
- `@Roles(...roles)` — sets `roles` metadata, checked by a dedicated `RolesGuard`

## Guard Order

Guards execute in registration order. When combining: `JwtAuthGuard` (global) → `RolesGuard` (controller/method).

## JWT Strategy — Key Points

- Extract token via `ExtractJwt.fromAuthHeaderAsBearerToken()`
- `validate(payload)` return value is attached to `request.user`
- DO type the payload interface (`sub`, `email`, `role` at minimum)
- DO set `ignoreExpiration: false`

## Security Directives

- DO implement refresh token rotation for long-lived sessions
- DO rate-limit `/auth/login` and `/auth/register` endpoints
- DO log failed authentication attempts via NestJS Logger (with IP and timestamp)
- DO set short JWT expiration (e.g., 15m access + 7d refresh)
- DO NOT return password hashes in any response — use response DTOs or `@Exclude()`

## Anti-patterns

- DO NOT use middleware for auth — middleware lacks `ExecutionContext`, use guards instead
- DO NOT check roles inside service methods — use `RolesGuard` at controller/method level
- DO NOT store JWT secret in code or commit `.env` files
