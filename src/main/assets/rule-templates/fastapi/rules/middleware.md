---
description: "FastAPI middleware patterns"
paths:
  - "**/*.py"
---

# FastAPI Middleware

## Ordering Rule

Last added = first executed. Request flows outermost-in, response flows innermost-out.

Recommended registration order (bottom = outermost, executed first):

1. **RequestID** -- assigns `X-Request-ID` before anything else
2. **Logging** -- logs request/response with request ID
3. **ErrorHandling** -- catches unhandled exceptions
4. **CORS** -- handles preflight and headers
5. **GZip** -- compresses responses

## Built-in Middleware

| Middleware | Purpose | Key setting |
|-----------|---------|-------------|
| `CORSMiddleware` | Cross-origin requests | `allow_origins`, `allow_methods` |
| `TrustedHostMiddleware` | Host header validation | `allowed_hosts` |
| `GZipMiddleware` | Response compression | `minimum_size=1000` |
| `HTTPSRedirectMiddleware` | HTTP to HTTPS redirect | - |

## Custom Middleware Choice

| Approach | When to use |
|----------|------------|
| `BaseHTTPMiddleware` | Simple request/response transformation; acceptable for most cases |
| Pure ASGI middleware | Performance-critical path; avoids `BaseHTTPMiddleware` overhead |
| `@app.middleware("http")` | Quick one-off; not reusable across apps |

## Key Patterns

- Use `ContextVar` for request-scoped state (request ID, DB session) -- NEVER use `threading.local`
- Propagate request ID: read from `X-Request-ID` header or generate `uuid4()`, set on response
- Structured logging: attach `method`, `path`, `status_code`, `duration`, `request_id` to every log
- Error handling middleware: catch unhandled exceptions and return structured JSON (never leak stack traces)

## CORS Directives

- NEVER use `allow_origins=["*"]` in production -- whitelist exact origins
- Set `allow_credentials=True` only when cookies/auth headers are needed
- Restrict `allow_methods` to actual methods used -- NEVER `["*"]` in production
- Set `expose_headers` for custom headers the frontend needs to read

## Anti-patterns

- NEVER do database queries in middleware -- use dependencies instead
- NEVER swallow exceptions silently -- always log before returning error response
- NEVER modify request body in middleware -- it breaks streaming and is error-prone
- NEVER use middleware for auth -- use dependencies for proper DI and testability
