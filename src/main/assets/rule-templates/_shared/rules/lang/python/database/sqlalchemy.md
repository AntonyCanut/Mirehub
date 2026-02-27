---
description: "SQLAlchemy 2.0 ORM patterns"
paths:
  - "**/models/**/*.py"
  - "**/repositories/**/*.py"
  - "**/db/**/*.py"
  - "**/database/**/*.py"
  - "**/*_model.py"
  - "**/*_repository.py"
---

# SQLAlchemy 2.0 Rules

## Model Definitions

- Use `Mapped[T]` and `mapped_column()` (SQLAlchemy 2.0 style) — not legacy `Column()`
- Use `Mapped[str | None]` for nullable fields
- Create a `TimestampMixin` with `created_at` and `updated_at` for all models
- Define relationships with `Mapped[list["Related"]]` and `relationship(back_populates=...)`
- Set `lazy="selectin"` on relationships to prevent N+1 by default

## Async Setup

- Use `create_async_engine` with `asyncpg` driver
- Use `async_sessionmaker(expire_on_commit=False)` for async sessions
- Subclass `DeclarativeBase` for the base model

## Query Patterns

- Use `select()` statements — not legacy `session.query()`
- Use `and_()`, `or_()` for compound conditions
- Use `selectinload()` or `joinedload()` for eager loading relationships
- Use `session.scalar()` for single results, `session.scalars()` for lists

## Transactions

- Prefer `async with session.begin():` for automatic commit/rollback
- Use `session.begin_nested()` for savepoints
- Always handle `IntegrityError` for unique constraint violations

## Pagination

- Always paginate: `.offset((page - 1) * size).limit(size)`
- Run a count query in parallel for total

## Anti-patterns

- DO NOT use legacy `Column()` / `session.query()` — use 2.0 style
- DO NOT use `relationship(lazy="joined")` globally — it over-fetches; use `selectin` or explicit loading
- DO NOT forget to set `expire_on_commit=False` in async sessions
- DO NOT put business logic in repositories — that belongs in services
