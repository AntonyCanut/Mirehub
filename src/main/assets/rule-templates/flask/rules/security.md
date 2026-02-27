---
description: "Flask security patterns"
paths:
  - "**/*.py"
---

# Flask Security Patterns

## Password Handling

- Use `werkzeug.security.generate_password_hash` / `check_password_hash`
- Werkzeug 3.0+ defaults to scrypt. DO use `argon2-cffi` for cross-service consistency, or accept Werkzeug's scrypt default for Flask-only projects.
- For existing databases with pbkdf2 hashes, specify `method='pbkdf2:sha256'` or implement rehashing on login
- Model exposes `set_password()` and `check_password()` methods -- callers never touch the hash directly

## CSRF Protection

- Enable `flask-wtf` CSRFProtect globally via `csrf.init_app(app)`
- Exempt API blueprints that use token auth: `csrf.exempt(api_bp)`
- For AJAX: send `X-CSRFToken` header from template-injected `{{ csrf_token() }}`

## Session Security

| Config Key | Production Value | Why |
|---|---|---|
| `SESSION_COOKIE_SECURE` | `True` | HTTPS only |
| `SESSION_COOKIE_HTTPONLY` | `True` | No JS access |
| `SESSION_COOKIE_SAMESITE` | `"Lax"` | CSRF mitigation |
| `PERMANENT_SESSION_LIFETIME` | `timedelta(hours=24)` | Limit exposure |

Use server-side sessions (Redis via `flask-session`) for sensitive data — client-side cookies are tamper-visible.

## Security Headers

Use `flask-talisman` for HSTS, CSP, and other security headers. Configure CSP per-app, do not use the default (it blocks inline scripts).

Manual fallback: set `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` in `@app.after_request`.

## Rate Limiting

- Use `flask-limiter` with Redis backend in production
- Aggressive limits on auth endpoints: `5 per minute` on login
- Exempt health check endpoints with `@limiter.exempt`

## File Uploads

- Always use `werkzeug.utils.secure_filename()` on uploaded filenames
- Whitelist allowed extensions — never blacklist
- Set `MAX_CONTENT_LENGTH` to reject oversized uploads before reading
- Generate unique filenames (UUID) — never trust client-provided names

## Anti-Patterns

- `SECRET_KEY = "dev"` in production — must be cryptographically random, 32+ chars
- Disabling CSRF globally — exempt only token-auth API routes
