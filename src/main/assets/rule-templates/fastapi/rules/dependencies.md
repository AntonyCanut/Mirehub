---
description: "FastAPI dependency injection system"
paths:
  - "**/*.py"
---

# FastAPI Dependency Injection

## Canonical Pattern

Always use `Annotated` type aliases for dependency injection:

```python
DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]
Paginated = Annotated[Pagination, Depends(get_pagination)]
```

NEVER inline `Depends()` in function signatures -- always create a reusable type alias.

## Dependency Types

| Type | Use case | Pattern |
|------|----------|---------|
| Function | Stateless (DB session, pagination) | `async def get_db() -> AsyncGenerator` |
| Generator (`yield`) | Resource cleanup (transactions, temp files) | `yield session` in `try/finally` |
| Class (`__call__`) | Stateful (rate limiter, cache) | Class with `async def __call__` |
| Parameterized | Configurable (role check, permission) | Factory function returning dependency |

## Caching Behavior

- `Depends(dep)` caches per-request by default (`use_cache=True`) -- same instance reused across the request
- Use `Depends(dep, use_cache=False)` to force a fresh call each time within the same request
- DB sessions and auth SHOULD use default caching; rate limiters MAY need `use_cache=False`

## Dependency Scoping

- Route-level: parameters in the handler function signature
- Router-level: `APIRouter(dependencies=[Depends(require_admin)])` -- applies to all routes in router
- App-level: `FastAPI(dependencies=[Depends(verify_api_key)])` -- applies globally

## Testing

Override dependencies in tests with `app.dependency_overrides[original] = mock_fn`. Always call `app.dependency_overrides.clear()` in teardown.

## Anti-patterns

- NEVER create deep dependency chains (>3 levels) -- flatten or combine
- NEVER do heavy computation in dependencies -- keep them lightweight and fast
- NEVER use global mutable state in dependencies -- use `request.app.state` or DI
- NEVER forget cleanup in `yield` dependencies -- always use `try/finally`
