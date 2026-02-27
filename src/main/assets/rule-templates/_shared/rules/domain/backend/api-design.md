---
description: "REST API design conventions and HTTP methods"
paths:
  - "**/controllers/**"
  - "**/routes/**"
  - "**/routers/**"
  - "**/endpoints/**"
  - "**/*.controller.ts"
  - "**/*_router.py"
---

# API Design Rules

## URL Conventions

- Use plural nouns: `/users`, `/orders`
- Use kebab-case: `/user-profiles`, `/order-items`
- Max 2 levels of nesting: `/users/:id/orders` — deeper nesting means a new top-level resource
- Use query params for filtering: `/users?status=active&role=admin`
- Non-CRUD actions as POST: `/orders/:id/cancel`

## Status Codes (non-obvious)

| Code | When |
|------|------|
| 409 | Conflict (duplicate resource, optimistic lock failure) |
| 422 | Business rule violation (valid syntax, invalid semantics) |
| 429 | Rate limited — include `Retry-After` header |
| 502 | Bad gateway (upstream returned invalid response) |
| 503 | Service unavailable (overloaded or in maintenance) |
| 504 | Gateway timeout (upstream did not respond in time) |

## Pagination Decision Matrix

| Dataset size | Strategy |
|-------------|----------|
| Small (< 10k rows) | Offset-based: `?page=2&pageSize=20` |
| Large / real-time | Cursor-based: `?cursor=abc&limit=20` |

Always return: `total`, `page`/`cursor`, `hasNext`

## Error Response Format

Use RFC 9457 Problem Details: `type`, `title`, `status`, `detail`, `instance`, optional `errors[]` array for field-level validation.

## Versioning

- Use URL path versioning: `/api/v1/users`
- Version only on breaking changes (field removal, type change, endpoint removal)
- Adding optional fields or new endpoints is NOT a breaking change

## Anti-patterns

- DO NOT use verbs in URLs — use HTTP methods instead
- DO NOT use singular nouns — `/user/123` should be `/users/123`
- DO NOT nest deeper than 2 levels — flatten to top-level resources
- DO NOT return 200 for errors — use proper status codes
- DO NOT expose internal IDs, stack traces, or implementation details
