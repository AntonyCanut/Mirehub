---
description: "Flask application and request context"
paths:
  - "**/*.py"
---

# Flask Context Management

## Two Contexts

| Context | Proxies Available | Pushed By |
|---|---|---|
| Application context | `current_app`, `g` | Request handling, CLI commands, `with app.app_context()` |
| Request context | `request`, `session` (+ app context) | Incoming HTTP request, `with app.test_request_context()` |

Accessing a proxy outside its context raises `RuntimeError`. Always ensure the right context is active.

## `current_app` Proxy

- Use `current_app` everywhere instead of importing the app instance
- Available during requests, CLI commands, and inside `with app.app_context()`
- For background threads: push context manually with `with app.app_context()`

## `g` Object — Request-Scoped Only

`g` lives for ONE request. It resets between requests. Never use it to store app-wide state.

Correct uses of `g`:
- Store current user after auth check in `@app.before_request`
- Store request ID, start time, or request-scoped service instances
- Lazy-load resources with `if "key" not in g: g.key = expensive_call()`

**BANNED:** Using `g` to share data between requests or as app-level cache — it resets every time

## Request Hooks Execution Order

1. `@app.before_request` — auth, request ID, timing start
2. Route handler executes
3. `@app.after_request` — response headers, logging (runs on success and handled errors; skipped on unhandled exceptions)
4. `@app.teardown_request` — cleanup (DB connections, temp files)

Blueprint hooks (`@bp.before_request`) run only for that blueprint's routes, but app-level hooks run for ALL routes including blueprint routes.

## Contexts for Background Work

Threads and background tasks have NO context. Push manually:

```python
def background_task(app, user_id):
    with app.app_context():
        user = db.session.get(User, user_id)
        send_email(user)
```

Pass `app` (or `current_app._get_current_object()`) to the thread — never rely on proxy in spawned threads.

## Async Routes (Flask 2.0+)

`async def` route handlers preserve context — `current_app`, `g`, `request` all work inside `await` calls. No manual context pushing needed for async routes.

## Anti-Patterns

- Accessing `request` or `g` outside a request context — `RuntimeError`
- Storing persistent state in `g` — resets per request, use Redis or DB instead
- Spawning threads without pushing app context — extension access will fail
- Using `before_first_request` — removed in Flask 2.3+, use app factory initialization instead
