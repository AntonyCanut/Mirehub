---
description: "Flask testing with pytest"
paths:
  - "**/tests/**/*.py"
  - "**/test_*.py"
---

# Flask Testing Patterns

## Stack

- `pytest` + `pytest-flask` as default test framework
- `conftest.py` at project root for shared fixtures
- `TestingConfig` with `TESTING=True`, `SQLALCHEMY_DATABASE_URI=sqlite:///:memory:`

## Core Fixtures

Define these in `conftest.py`:

| Fixture | Scope | Provides |
|---|---|---|
| `app` | session | `create_app("testing")` instance |
| `client` | function | `app.test_client()` — the HTTP test client |
| `runner` | function | `app.test_cli_runner()` — for CLI command tests |
| `db_session` | function | Scoped DB session — `create_all` before, `rollback` + `drop_all` after. Must operate within `app.app_context()` — push context in fixture setup |

`client` fixture is the primary interface for endpoint tests. Use `client.get()`, `client.post(json={...})`, etc.

## Authentication in Tests

Create an `auth_headers` fixture that logs in a test user and returns `{"Authorization": "Bearer <token>"}`. Pass to client calls: `client.get("/endpoint", headers=auth_headers)`.

## CLI Command Tests

Use `runner.invoke(args=["command-name", "arg1"])`. Assert `result.exit_code == 0` and check `result.output` for expected messages.

For general mocking patterns (`patch`, `MagicMock`, assertion conventions), see shared Python testing rules.

## Anti-Patterns

- Testing without `TESTING=True` config -- error handlers behave differently
- Missing `db.session.rollback()` in fixture teardown -- state leaks between tests
