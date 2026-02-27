---
description: "Python testing with pytest"
paths:
  - "**/tests/**/*.py"
  - "**/test_*.py"
  - "**/*_test.py"
---

# Python Testing Rules

## Structure

- `tests/unit/` — pure logic, mocked dependencies
- `tests/integration/` — real DB, real services
- `tests/e2e/` — full API tests via HTTP client
- `tests/conftest.py` — shared fixtures

## Fixtures

- Use `@pytest.fixture` for setup — prefer fixtures over manual setup in tests
- Session-scoped engine, function-scoped session (rollback after each test)
- Create test client with `httpx.AsyncClient` + `ASGITransport`
- Override dependencies with `app.dependency_overrides` — clean up after tests

## Unit Tests

- Use `AsyncMock` for repository mocks
- One assertion per test when practical

## Integration Tests (API)

- Test full request/response cycle via `AsyncClient`
- Verify status codes, response shape, and side effects (DB state)
- Test auth: unauthenticated returns 401, unauthorized returns 403

## Parametrize

- Use `@pytest.mark.parametrize` for input/output variations (e.g., email validation cases)
- Covers edge cases concisely without duplicating test logic

## Markers

- Define custom markers: `slow`, `integration`, `e2e`
- Run subsets: `pytest -m "not slow"`, `pytest -m integration`

## Configuration

- Configure in `pyproject.toml`: `fail_under = 80`, exclude `tests/`, `__init__.py`, `TYPE_CHECKING`

## Anti-patterns

- DO NOT forget to rollback DB sessions in fixtures
- DO NOT write flaky tests — use deterministic data, mock time
