---
description: "Flask extension integration patterns"
paths:
  - "**/*.py"
---

# Flask Extensions Patterns

## Initialization — Always Lazy

All extensions MUST be initialized in two phases:
1. Instantiate without app in `extensions.py` (e.g., `db = SQLAlchemy()`)
2. Bind to app via `ext.init_app(app)` inside `create_app()`

**BANNED:** `db = SQLAlchemy(app)` — couples extension to single config, breaks testing

## Common Extensions

| Extension | Purpose | Key Config |
|---|---|---|
| Flask-SQLAlchemy | ORM | `SQLALCHEMY_DATABASE_URI` |
| Flask-Migrate | Alembic migrations | Bind to `db` in `init_app` |
| Flask-JWT-Extended | JWT auth | `JWT_SECRET_KEY`, `JWT_ACCESS_TOKEN_EXPIRES` |
| Flask-CORS | CORS headers | `resources` dict with origin patterns |
| Flask-Caching | Response/function cache | `CACHE_TYPE`, `CACHE_REDIS_URL` |
| Flask-Limiter | Rate limiting | `key_func`, `default_limits`, `storage_uri` |
| Flask-Mail | Email sending | `MAIL_SERVER`, `MAIL_PORT` |

## Flask-SQLAlchemy

- See `flask.md` for SQLAlchemy 2.0 query patterns and model conventions
- Use lazy `init_app` pattern — never `SQLAlchemy(app)` directly

## Flask-JWT-Extended

- Configure `user_lookup_loader` to resolve identity to User model
- Use `@jwt_required()` decorator — parentheses required
- Refresh tokens: separate endpoint with `@jwt_required(refresh=True)`

## Flask-CORS

- Configure per-resource patterns in `init_app`, not globally with `origins="*"`
- Blueprint-specific CORS: `CORS(blueprint, origins=[...])` for admin vs public APIs

## Flask-Limiter

Rate limiting: see security rules for Flask-Limiter configuration.

## Flask-Caching

- Use `@cache.cached()` for full response caching on GET endpoints
- Use `@cache.memoize()` for function-level caching with argument awareness
- Invalidate explicitly: `cache.delete_memoized(fn, *args)`

## Anti-Patterns

- Importing `app` in `extensions.py` — circular import guaranteed
- Missing `init_app` call — extension silently non-functional
