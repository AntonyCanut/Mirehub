---
description: "FastAPI testing with pytest and httpx AsyncClient"
paths:
  - "**/tests/**/*.py"
  - "**/test_*.py"
---

# FastAPI Testing

## pytest-asyncio Configuration

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
```

This makes all `async def test_*` automatically async -- no need for `@pytest.mark.asyncio` on every test.

## Mocking External HTTP with respx

Use `respx` for mocking outbound HTTP calls in async tests:

```python
@respx.mock
async def test_external_api(client):
    respx.get("https://api.example.com/data").mock(return_value=httpx.Response(200, json={"key": "value"}))
    response = await client.get("/endpoint-that-calls-external")
    assert response.status_code == 200
```

## FastAPI-Specific Patterns

| Pattern | Implementation |
|---------|---------------|
| File upload | `client.post("/upload", files={"file": ("name.txt", b"content", "text/plain")})` |

For `AsyncClient`/`ASGITransport` setup, `dependency_overrides`, `AsyncMock`, and DB isolation patterns, see shared Python testing rules.

## Anti-patterns

- NEVER use sync `TestClient` -- all FastAPI tests should be async with `AsyncClient`
- NEVER forget `app.dependency_overrides.clear()` in teardown -- leaks between tests
