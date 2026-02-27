---
description: "Python repository pattern for data access"
paths:
  - "**/repositories/**/*.py"
  - "**/repository/**/*.py"
  - "**/*_repository.py"
  - "**/dal/**/*.py"
---

# Python Repository Pattern

## Base Repository

- Generic `BaseRepository[T]` accepting `AsyncSession` and model type
- Standard CRUD methods: `get`, `get_or_raise`, `get_all`, `count`, `create`, `update`, `delete`, `exists`
- Use `session.flush()` + `session.refresh()` after create/update — let the caller control commit

## Domain Repositories

- Extend `BaseRepository[T]` with domain-specific queries
- Example: `UserRepository` adds `get_by_email()`, `get_active_users()`, `search()`
- Accept schema objects (DTOs), map to model fields internally

## Unit of Work Pattern

- `UnitOfWork` holds the session and lazily creates repositories as properties
- Implement as async context manager: commit on clean exit, rollback on exception
- Use in routes for transactional operations spanning multiple repositories

## FastAPI Integration

- Create `get_session` dependency yielding `AsyncSession`
- Create `get_uow` dependency wrapping session in `UnitOfWork`
- Use `Annotated[UnitOfWork, Depends(get_uow)]` for clean route signatures

## Abstract Interface (Optional)

- Define `IRepository[T]` ABC for dependency inversion
- Implement `SqlAlchemyUserRepository` for production, `InMemoryUserRepository` for tests
- Swap implementations via dependency injection

## Anti-patterns

- DO NOT put business logic in repositories — uniqueness checks, permission checks belong in services
- DO NOT use `session` directly in routes — use repository or UoW abstraction
- DO NOT skip the `flush/refresh` pattern — without it, returned objects lack DB-generated fields
- DO NOT create repositories without accepting session — they must be request-scoped
