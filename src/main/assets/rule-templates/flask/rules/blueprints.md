---
description: "Flask blueprint organization patterns"
paths:
  - "**/*.py"
---

# Flask Blueprint Patterns

## Organization

- One blueprint per domain — defined in `[domain]/__init__.py`
- Import routes AFTER blueprint creation to prevent circular imports
- Register all blueprints in `create_app()` with explicit `url_prefix`

## Naming

- Blueprint variable: `{domain}_bp` (e.g., `users_bp`, `auth_bp`)
- Blueprint name matches domain: `Blueprint("users", __name__)`
- URL prefix follows REST: `/api/v1/{resource}`

## Nested Blueprints for API Versioning

Use parent blueprints to group versioned APIs:

```python
api_v1 = Blueprint("api_v1", __name__, url_prefix="/api/v1")
api_v1.register_blueprint(users_bp, url_prefix="/users")
api_v1.register_blueprint(products_bp, url_prefix="/products")

api_v2 = Blueprint("api_v2", __name__, url_prefix="/api/v2")
api_v2.register_blueprint(users_v2_bp, url_prefix="/users")
```

Register only parent blueprints in `create_app()` — children are attached to parents.

## Blueprint Hooks

- `@bp.before_request` — auth checks, request-scoped service injection into `g`
- `@bp.after_request` — response headers, logging
- `@bp.errorhandler` — domain-specific error handling (falls back to app-level)

## Class-Based Views

Use `MethodView` for resource-oriented endpoints — register with `add_url_rule()`. Prefer function views for simple single-action routes.

## Anti-Patterns

- All routes in one file — defeats purpose of blueprints, use one blueprint per domain
- Blueprint importing another blueprint's internals — couple through services or events instead
- `url_prefix` on individual routes instead of blueprint registration — inconsistent URL structure
- Registering blueprint without `url_prefix` — leads to route collisions
