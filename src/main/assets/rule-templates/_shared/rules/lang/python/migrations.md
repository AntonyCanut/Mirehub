---
description: "Alembic database migration patterns"
paths:
  - "**/alembic/**/*.py"
  - "**/migrations/**/*.py"
  - "**/alembic.ini"
---

# Python Database Migrations (Alembic)

## Commands

| Command | Purpose |
|---------|---------|
| `alembic revision --autogenerate -m "description"` | Generate migration |
| `alembic upgrade head` | Apply all migrations |
| `alembic downgrade -1` | Rollback last migration |
| `alembic current` | Show current revision |
| `alembic history --verbose` | Show migration history |
| `alembic upgrade head --sql` | Generate SQL without applying |

## Configuration

- Set `compare_type=True` and `compare_server_default=True` in `env.py` context
- Use post-write hooks to auto-format generated migrations (black/ruff)
- For async: use `create_async_engine` and run migrations via `connection.run_sync()`

## Migration Patterns

### Adding non-nullable columns

1. Add column as nullable
2. Backfill data with `op.execute("UPDATE ... SET ...")`
3. Alter column to non-nullable

### Index operations

- Create indexes for: foreign keys, WHERE clause columns, unique constraints
- Use partial indexes when applicable (PostgreSQL: `postgresql_where=...`)

### Enum operations

- Create enum type first with `.create(op.get_bind())`, then add column
- Drop column first in downgrade, then drop enum type

## Data Migrations

- Use `op.get_bind()` for raw SQL execution
- Use parameterized queries: `sa.text("UPDATE ... WHERE id = :id")` with dict params
- Batch large updates to avoid table locks: process in chunks of 1000

## Anti-patterns

- DO NOT write destructive migrations without data preservation — archive before dropping
- DO NOT run long-running updates in a single transaction — batch with commits
- DO NOT write migrations without a downgrade path — always implement `downgrade()`
- DO NOT hardcode IDs or values — use parameterized queries
- DO NOT forget to test migrations in CI before deploying
