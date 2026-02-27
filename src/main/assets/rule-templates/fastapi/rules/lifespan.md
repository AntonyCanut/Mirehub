---
description: "FastAPI application lifespan management"
paths:
  - "**/*.py"
---

# FastAPI Lifespan Management

## Mandatory Pattern

Use `@asynccontextmanager` lifespan -- NEVER `@app.on_event("startup")` / `@app.on_event("shutdown")` (deprecated).

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: init resources, store on app.state
    app.state.db_engine = create_async_engine(settings.database_url)
    app.state.async_session = async_sessionmaker(app.state.db_engine, expire_on_commit=False)
    yield
    # Shutdown: dispose in reverse order
    await app.state.db_engine.dispose()

app = FastAPI(lifespan=lifespan)
```

## Resource Initialization Checklist

| Resource | Startup | Shutdown | Access pattern |
|----------|---------|----------|---------------|
| DB engine | `create_async_engine()` | `engine.dispose()` | `app.state.db_engine` |
| Session factory | `async_sessionmaker()` | - (GC) | Dependency via `get_db()` |
| Redis | `redis.from_url()` | `redis.close()` | `app.state.redis` |
| HTTP client | `httpx.AsyncClient()` | `client.aclose()` | `app.state.http_client` |
| Scheduler | `scheduler.start()` | `scheduler.shutdown()` | `app.state.scheduler` |

## Key Rules

- Store ALL shared resources on `app.state` -- NEVER use module-level globals for connections
- Dispose resources in reverse initialization order
- Use `pool_pre_ping=True` on DB engine for connection health checks
- Create `httpx.AsyncClient` once in lifespan -- NEVER create per-request
- Wrap resource init in `try/except` for graceful degradation and health reporting

## Health Check Integration

- Track resource health during startup on `app.state.health`
- `/health/live` returns 200 unconditionally (process is running)
- `/health/ready` checks `app.state.health` and returns 503 if any resource failed

## Testing

Override lifespan for tests by creating a `test_lifespan` that injects mocks. Or use `dependency_overrides` to bypass resource-dependent dependencies.

## Anti-patterns

- NEVER create DB engines or connection pools at module import time
- NEVER forget to `dispose()`/`close()` resources -- causes connection leaks
- NEVER run `Base.metadata.create_all` in production lifespan -- use Alembic migrations
