---
description: "FastAPI route and endpoint patterns"
paths:
  - "**/routers/**/*.py"
  - "**/routes/**/*.py"
  - "**/api/**/*.py"
  - "**/endpoints/**/*.py"
  - "**/main.py"
  - "**/app.py"
---

# FastAPI Endpoint Patterns

## Route Handler Rules

- Use `status_code=` for non-200 defaults (201 on POST create, 204 on DELETE)
- Use `summary` and `description` on routes for OpenAPI documentation
- Return type annotation should match the ORM/domain object; `response_model` handles serialization

## Async SQLAlchemy Override

- Set `lazy='raise'` on ALL SQLAlchemy relationships -- in async contexts, this overrides the shared `selectin` default because implicit I/O is unsafe with closed async sessions and causes `MissingGreenlet` errors. Always use explicit `selectinload()` / `joinedload()` at query time instead.

For general SQLAlchemy 2.0 query patterns (`select()`, `session.scalars()`, model definitions), see shared SQLAlchemy rules.

## OpenAPI Configuration

- Set `title`, `version`, `description` on `FastAPI()` init
- Use `openapi_tags` for logical endpoint grouping
- Disable `docs_url` and `redoc_url` in production via settings toggle

## Anti-patterns

- NEVER return raw SQLAlchemy model instances directly from route handlers -- convert to Pydantic schemas
- NEVER use bare `except Exception` in handlers -- let exception handlers do their job
