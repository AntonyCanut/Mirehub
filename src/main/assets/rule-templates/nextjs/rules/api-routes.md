---
description: "Next.js API route handlers"
paths:
  - "**/app/api/**/*.ts"
  - "**/src/app/api/**/*.ts"
---

# API Route Handlers (App Router)

## When to Use API Routes vs Server Actions

| Use API Routes | Use Server Actions |
|----------------|-------------------|
| External API consumed by third parties | Form mutations from your own UI |
| Webhooks, SSE, streaming | Revalidation after data changes |
| Non-Next.js clients (mobile, CLI) | Tightly coupled to a page |

## Key Directives

- DO validate all input with Zod `safeParse` before processing
- DO return structured error responses — never expose internal error messages
- DO use `NextResponse.json()` with explicit status codes
- DO `await params` and `searchParams` — they are Promises (see routing rules)
- DO `await headers()` and `await cookies()` — both are async in Next.js 15

## Route Segment Config

```typescript
export const dynamic = 'force-dynamic';    // Always dynamic
export const runtime = 'edge';             // Edge runtime
export const maxDuration = 30;             // Max execution (Vercel)
```

## Error Handling

DO create a typed `ApiError` class with `status`, `message`, and `code`.
DO catch `ApiError` and return structured JSON; catch unknown errors and return generic 500.
DO NOT return `error.message` for unknown errors — leaks stack info.

## Streaming (SSE)

DO use `ReadableStream` with `text/event-stream` content type for server-sent events.
DO set `Cache-Control: no-cache` on SSE responses.

## Anti-Patterns

- DO NOT skip input validation — direct injection risk
- DO NOT expose internal error details to clients
- DO NOT use API routes for data that Server Components can fetch directly
- DO NOT forget pagination for list endpoints — always support `page` + `limit`
