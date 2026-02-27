---
description: "FastAPI router organization"
paths:
  - "**/routers/**/*.py"
  - "**/routes/**/*.py"
  - "**/api/**/*.py"
  - "**/endpoints/**/*.py"
---

# FastAPI Router Organization

## Router Declaration

Every router MUST have `prefix` and `tags`:

```python
router = APIRouter(prefix="/users", tags=["Users"])
```

- `prefix` defines the URL namespace -- NEVER repeat prefix in individual route paths
- `tags` groups endpoints in OpenAPI docs -- one tag per router
- Add `dependencies=[Depends(...)]` for router-wide auth/guards
- Add `responses={...}` for common error responses across all routes in the router

## Registration Pattern

Use a versioned API router to aggregate domain routers:

```python
api_v1 = APIRouter(prefix="/api/v1")
api_v1.include_router(users_router)
api_v1.include_router(auth_router)
app.include_router(api_v1)
```

## Route Ordering Convention

Within a router, order endpoints: list > get > create > update > delete (CRUD order).

## Path and Query Parameters

- Path params: use `Path(ge=1, description="...")` for validation and docs
- Query params: use `Query(default, ge=, le=, min_length=, max_length=)` for validation
- List query params: `ids: Annotated[list[int], Query()]`
- Sort/filter: `sort_by: Literal["name", "created_at"]`, `order: Literal["asc", "desc"]`

## Request Body

- Single body: directly as typed parameter (`data: UserCreate`)
- Embedded body: `Annotated[ItemCreate, Body(embed=True)]` wraps in `{"item": {...}}`
- Multiple bodies: each with `Body()` annotation

## File Uploads and Forms

- Files: `Annotated[UploadFile, File(description="...")]`
- Form data: `Annotated[str, Form()]`
- NEVER mix Pydantic `Body` and `Form` in the same endpoint

## Anti-patterns

- NEVER create routers without `prefix` and `tags` -- breaks OpenAPI organization
- NEVER define multiple routers in the same file -- one router per module
