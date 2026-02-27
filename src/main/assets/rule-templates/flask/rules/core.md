---
description: "Flask 3.0+ project conventions and architecture"
alwaysApply: true
---

# Flask Project Guidelines

## Stack

- Python 3.12+, Flask 3.0+, SQLAlchemy 2.0+ (Mapped types), Marshmallow
- pytest + pytest-flask for testing
- uv or poetry for dependency management
- ruff for linting and formatting

## Architecture — Application Factory is Non-Negotiable

Every Flask app MUST use the application factory pattern via `create_app()`. Never instantiate a global `app = Flask(__name__)` at module level.

Access app through `current_app` proxy -- see context rules.

## Module Organization

| Module | Responsibility |
|---|---|
| `__init__.py` | App factory (`create_app`), blueprint registration |
| `config.py` | Configuration classes (base + per-environment) |
| `extensions.py` | Extension instances (db, migrate, jwt) — no app binding |
| `[domain]/routes.py` | Route handlers — thin, delegate to services |
| `[domain]/schemas.py` | Marshmallow schemas — input validation + output serialization |
| `[domain]/models.py` | SQLAlchemy 2.0 models (Mapped types) |
| `[domain]/services.py` | Business logic — all DB writes go through services |
| `[domain]/repository.py` | Data access layer (optional, for complex queries) |
| `core/exceptions.py` | Custom exception hierarchy |

## Key Conventions

- Routes are thin controllers: validate input, call service, serialize output
- Services own business logic and transactions — routes never call `db.session.commit()`
- One blueprint per domain, registered with URL prefix in factory
- Extensions: lazy init in `extensions.py`, bind via `init_app()` -- see extensions rules
- Use `from_prefixed_env()` (Flask 2.2+) for environment-based config loading

## Anti-Patterns

- Importing `app` directly in modules — breaks testability and multi-config support
- Business logic in route handlers — makes code untestable without HTTP
- `db.session` usage in routes — services own the unit of work
- Circular imports between blueprints — use lazy imports or dependency injection

## Commands

```bash
flask run                         # Dev server
flask db upgrade                  # Run migrations
flask db migrate -m "message"     # Generate migration
pytest                            # Run tests
pytest --cov=app                  # Coverage
ruff check . && ruff format .     # Lint + format
```
