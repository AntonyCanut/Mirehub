---
description: "Flask configuration and environments"
paths:
  - "**/*.py"
---

# Flask Configuration Patterns

Flask uses its native config system (class hierarchy + `from_prefixed_env()`). `pydantic-settings` (see shared Python config rules) is for FastAPI projects.

## Class-Based Config Hierarchy (Required)

| Class | Purpose | Key Overrides |
|---|---|---|
| `Config` | Base — shared defaults | `SECRET_KEY`, `SQLALCHEMY_TRACK_MODIFICATIONS=False` |
| `DevelopmentConfig` | Local dev | `DEBUG=True`, `SQLALCHEMY_ECHO=True` |
| `TestingConfig` | Test suite | `TESTING=True`, `SQLALCHEMY_DATABASE_URI=sqlite:///:memory:` |
| `ProductionConfig` | Production | `SESSION_COOKIE_SECURE=True`, env-only secrets |

Expose a `config` dict mapping names to classes. Factory selects via `app.config.from_object(config[name])`.

## Environment-Based Config (Flask 2.2+)

Use `app.config.from_prefixed_env()` to load all `FLASK_*` env vars automatically:
- `FLASK_SECRET_KEY` maps to `app.config["SECRET_KEY"]`
- `FLASK_SQLALCHEMY_DATABASE_URI` maps to `app.config["SQLALCHEMY_DATABASE_URI"]`

This replaces manual `os.environ.get()` calls for most config values. Call it AFTER `from_object()` so env vars override class defaults.

## Config Loading Order

1. `app.config.from_object(config[config_name])` — class defaults
2. `app.config.from_prefixed_env()` — environment overrides
3. `app.config.from_pyfile("config.py", silent=True)` — instance overrides (optional)

Later sources override earlier ones.

## Validation

Validate required config at startup in `create_app()` — fail fast with clear error messages. Required keys: `SECRET_KEY`, `SQLALCHEMY_DATABASE_URI`. In production, assert `SECRET_KEY` length >= 32 characters.

## Runtime Access

- Use `current_app.config["KEY"]` in routes/services -- see context rules
- Use `app.config.get("KEY", default)` for optional values
- `app.config.setdefault("KEY", value)` for extension defaults

## Anti-Patterns

- Hardcoded secrets in config classes — use env vars or `from_prefixed_env()`
- `os.environ["KEY"]` in config class body — crashes at import time if missing, use `.get()` with defaults
- Config access without `current_app` -- see context rules
- Secrets in version control — use `.env` files (gitignored) + `python-dotenv` for dev
