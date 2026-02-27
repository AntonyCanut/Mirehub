---
description: "NestJS common patterns and utilities"
paths:
  - "**/src/common/**/*.ts"
  - "**/src/**/*.decorator.ts"
  - "**/src/**/*.filter.ts"
  - "**/src/**/*.interceptor.ts"
  - "**/src/**/*.pipe.ts"
  - "**/src/main.ts"
---

# NestJS Common Patterns

## Pagination — Canonical Pattern

- DO create a shared `PaginationQueryDto` (page, pageSize with defaults) and `PaginatedResponseDto<T>` (data + meta)
- DO NOT invent different pagination shapes per feature — reuse the canonical DTO everywhere
- Meta must include: `page`, `pageSize`, `total`, `totalPages`

## CQRS Pattern

- For complex domains, consider the CQRS pattern via `@nestjs/cqrs` (commands, queries, events)
- Recent `@nestjs/cqrs` versions support request-scoped providers, strongly-typed handlers, and handler conflict detection
- DO separate write (command) and read (query) paths when the domain justifies it
- DO NOT apply CQRS to simple CRUD modules — it adds unnecessary indirection

## Utilities

- DO compose multiple decorators with `applyDecorators()` when stacking 3+ decorators
