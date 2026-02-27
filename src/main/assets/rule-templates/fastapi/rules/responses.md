---
description: "FastAPI response models and streaming patterns"
paths:
  - "**/*.py"
---

# FastAPI Responses

## Response Model Rules

- Use `response_model_exclude_unset=True` as default -- omits fields not explicitly set
- Create dedicated response schemas to control exposed fields -- NEVER use `response_model_exclude` to hide fields

## Response Classes

| Class | Use case |
|-------|----------|
| `JSONResponse` | Custom status/headers with JSON body |
| `StreamingResponse` | SSE, large files, chunked data |
| `FileResponse` | File downloads with `Content-Disposition` |
| `RedirectResponse` | HTTP redirects (301/302) |
| `HTMLResponse` | Server-rendered HTML |

## Error Responses

- Document error responses in `responses={404: {"model": ErrorResponse}}` for OpenAPI
- Use structured `ErrorResponse` schema with `error`, `detail`, `code` fields
- Register `@app.exception_handler(DomainException)` -- NEVER catch-and-return `JSONResponse` inline
- Use `HTTPException` headers param for auth errors: `headers={"WWW-Authenticate": "Bearer"}`

## Headers and Cookies

- Inject `Response` parameter to set custom headers: `response.headers["X-Custom"] = "value"`
- Set `Cache-Control` header for cacheable GET endpoints
- Cookies: always set `httponly=True`, `secure=True`, `samesite="lax"` for session cookies

## Streaming

- Use `AsyncGenerator[bytes, None]` for streaming responses
- Set `media_type="text/event-stream"` for SSE
- Use chunked reads (`8192` bytes) for large file streaming -- NEVER load entire file into memory

## Anti-patterns

- NEVER return raw dicts from routes -- always use `response_model` for serialization control
- NEVER leak internal model fields -- `response_model` acts as a serialization firewall
