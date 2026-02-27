---
description: "FastAPI project conventions and architecture"
alwaysApply: true
---

# FastAPI Project Guidelines

## Stack

- Python 3.12+ with async-first architecture
- FastAPI 0.115+ (Pydantic v2 baseline)
- SQLAlchemy 2.0+ async (`AsyncSession`, `expire_on_commit=False`)
- Pydantic v2 for all validation and serialization
- pytest + httpx `AsyncClient` for testing
- uv (preferred) or poetry for dependency management
- Alembic for migrations

## Architecture

Every domain module follows: `router.py` > `service.py` > `repository.py` > `models.py` + `schemas.py`

| Layer | Responsibility | Depends on |
|-------|---------------|------------|
| `router.py` | HTTP concerns, status codes, response models | service |
| `service.py` | Business logic, orchestration | repository |
| `repository.py` | Data access, queries | models |
| `schemas.py` | Pydantic request/response models | - |
| `models.py` | SQLAlchemy ORM models | - |
| `dependencies.py` | Route-scoped DI (auth, pagination) | service |

Shared code goes in `core/` (exceptions, security) and `common/` (base models, shared schemas).

## Async-First Mandate

- All route handlers MUST be `async def` -- never use sync `def` for endpoints
- Use `AsyncSession` for all database operations
- Use `httpx.AsyncClient` for outbound HTTP calls (never `requests`)
- Use `aiofiles` for file I/O inside async contexts

## Key Conventions

- `Annotated` type aliases for DI -- see dependencies rules
- Lifespan context manager for startup/shutdown -- see lifespan rules
- Settings via `pydantic-settings` `BaseSettings` with `.env` support
- Custom domain exceptions with `@app.exception_handler` -- not bare `HTTPException` in services
- `response_model` on every route -- see responses rules

## Anti-patterns

- NEVER put business logic in routers -- routers are thin HTTP adapters
- NEVER use sync ORM calls in async context -- causes thread pool exhaustion
- NEVER import `app` in modules to avoid circular imports -- pass dependencies via DI

## Commands

```bash
uvicorn app.main:app --reload        # Dev server
pytest --cov=app -x                  # Tests with coverage
ruff check . && ruff format .        # Lint + format
alembic upgrade head                 # Run migrations
alembic revision --autogenerate -m   # Generate migration
```
