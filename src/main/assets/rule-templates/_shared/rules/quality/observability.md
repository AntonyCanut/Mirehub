---
description: "Structured logging, metrics, and health checks"
paths:
  - "**/*.ts"
  - "**/*.js"
  - "**/*.py"
  - "**/*.cs"
---

# Observability

## Structured Logging (JSON)

- ALL logs must be structured JSON — never plain text in production
- Include: `timestamp`, `level`, `message`, `service`, `traceId`, context fields
- Use OpenTelemetry as standard for distributed tracing and telemetry collection

### Log Levels

| Level | When |
|-------|------|
| `error` | Failures requiring attention (alerts) |
| `warn` | Recoverable issues, deprecations |
| `info` | Business events, state changes, request lifecycle |
| `debug` | Development details — disabled in production |

### What to Log

- Request received/completed with duration
- Business events (user created, order placed, payment processed)
- External service calls with duration and status
- Errors with stack trace and context
- Authentication events (login, logout, failed attempts)

### NEVER Log

- Passwords, tokens, API keys, secrets
- Credit card numbers, PII, PHI
- Full request/response bodies in production
- Health check traffic (pollutes logs)

## Correlation IDs

- Generate or propagate `x-trace-id` header through entire request chain
- Include `traceId` in every log entry — mandatory for distributed debugging
- Pass trace ID to all downstream service calls

## Health Checks

- `/health/live` — is the process running? (always 200)
- `/health/ready` — can it serve traffic? (checks DB, cache, dependencies)

## Metrics (RED Method)

| Metric | Track |
|--------|-------|
| **Rate** | Requests/sec per endpoint |
| **Errors** | Error rate (5xx / total) |
| **Duration** | Latency p50, p95, p99 |

## Anti-patterns

- DO NOT log sensitive data — even accidentally via object spread
- DO NOT skip correlation IDs — makes cross-service debugging impossible
- DO NOT swallow errors without logging — `catch {}` is a bug
- DO NOT expose stack traces to users — log internally, return generic message
- DO NOT log without context — "Error occurred" is useless; include entity IDs, operation, user
