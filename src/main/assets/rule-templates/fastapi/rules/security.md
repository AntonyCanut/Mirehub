---
description: "FastAPI authentication and security"
paths:
  - "**/*.py"
---

# FastAPI Security

## Authentication Dependencies

- Define `CurrentUser = Annotated[User, Depends(get_current_user)]` as the standard auth dependency
- `get_current_user` decodes JWT, fetches user from DB, raises 401 on failure
- Use `OAuth2PasswordBearer(tokenUrl="/auth/token")` as the token extractor
- Always include `headers={"WWW-Authenticate": "Bearer"}` in 401 responses

## Role-Based Access Control

Use parameterized dependencies for role/permission checks:

```python
def require_roles(*roles: Role):
    async def dependency(user: CurrentUser) -> User:
        if user.role not in roles:
            raise HTTPException(403, "Insufficient permissions")
        return user
    return dependency

AdminOnly = Annotated[User, Depends(require_roles(Role.ADMIN))]
```

## API Key Authentication

- Support both header (`X-API-Key`) and query param (`api_key`) via `APIKeyHeader` / `APIKeyQuery`
- Combine with `auto_error=False` and a union dependency that checks both sources
- Apply as router-level or app-level dependency

## Password Handling

- Use `pwdlib` (preferred) or `bcrypt` directly -- `passlib` is unmaintained since 2022
- NEVER log or return passwords in responses

## Rate Limiting

- Use `slowapi` with `Limiter(key_func=get_remote_address)` for per-IP limiting
- Apply per-route with `@limiter.limit("10/minute")` decorator
- Return 429 with `Retry-After` header

## Anti-patterns

- NEVER use `HS256` with a weak secret -- minimum 256-bit random key
- NEVER skip token expiry (`exp` claim) -- always set reasonable TTL
- NEVER trust client-provided user ID -- always derive from token

For CORS origin restrictions, see middleware rules. For secret storage, see shared secrets-management rules.
