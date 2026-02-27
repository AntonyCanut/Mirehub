---
description: "ASP.NET Core middleware pipeline"
paths:
  - "**/*Middleware.cs"
  - "**/Middleware/**/*.cs"
---

# Middleware Rules

## Registration Order (in Program.cs)

Order matters -- register in this sequence:
1. Exception handling (outermost -- catches everything)
2. Security headers
3. Correlation ID (before logging so logs include it)
4. Request logging
5. Rate limiting
6. HTTPS redirection
7. Authentication
8. Authorization
9. Tenant resolution (after auth)
10. Endpoints

## Implementation Pattern

- Accept `RequestDelegate next` in constructor
- Inject scoped services in `InvokeAsync(HttpContext context, IMyService svc)` parameters, not in constructor
- Provide a `Use*` extension method on `IApplicationBuilder` for clean registration

## Common Middleware

| Middleware | Purpose |
|-----------|---------|
| Exception handling | Map exceptions to ProblemDetails, log at Error level |
| Correlation ID | Read `X-Correlation-ID` header or generate new, add to response and logging scope |
| Request logging | Log method, path, status code, duration |
| Security headers | Add `X-Content-Type-Options`, `X-Frame-Options`, remove `Server` header |
| Request timeout | Use `CancellationTokenSource.CreateLinkedTokenSource` with timeout, return 408 |

## Exception-to-ProblemDetails Mapping

Use pattern matching to map exception types to HTTP status codes:

| Exception | Status |
|-----------|--------|
| `ValidationException` | 400 |
| `UnauthorizedAccessException` | 401 |
| `ForbiddenException` | 403 |
| `NotFoundException` | 404 |
| `ConflictException` | 409 |
| Unhandled | 500 (hide details in production) |

## Anti-patterns

- DO NOT inject scoped services in middleware constructor -- inject in `InvokeAsync` parameters instead (see DI rules for captive dependency)
- DO NOT use `.Result` or `.Wait()` in middleware -- it risks deadlocks
- DO NOT modify response headers after `_next(context)` returns -- use `Response.OnStarting()` callback instead
- DO NOT write a custom rate limiter -- use the built-in `AddRateLimiter()` from .NET 7+
