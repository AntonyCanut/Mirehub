---
description: "OWASP Top 10 security rules and additional hardening directives"
paths:
  - "**/*.ts"
  - "**/*.js"
  - "**/*.py"
  - "**/*.cs"
  - "**/*.java"
---

# Security Rules (OWASP Top 10)

## A01 — Broken Access Control

- Verify resource ownership — never trust client-provided IDs alone
- Check authorization at every endpoint — deny by default
- Use anti-CSRF tokens for state-changing operations
- Set cookies: `httpOnly: true`, `secure: true`, `sameSite: 'strict'`

## A02 — Cryptographic Failures

- Never store plain passwords — use bcrypt (cost 12+) or argon2id (DO NOT use MD5/SHA1)
- Use TLS everywhere — no exceptions in production

## A03 — Injection

- ALL database queries must be parameterized — never concatenate user input
- Prefer ORM/query builder — raw SQL only with parameterized queries
- Prefer safe APIs over `exec()` — sanitize input before shell commands
- Never use `innerHTML`/`dangerouslySetInnerHTML` with user content — use DOMPurify

## A04 — Insecure Design

- Validate all inputs server-side — use allowlists over denylists
- Validate type, length, format, range with schema validation (Zod, Pydantic, FluentValidation)

## Mass Assignment Protection

- DO whitelist allowed fields explicitly on every update/patch endpoint
- DO NOT pass raw request body to ORM update methods — map to a DTO/schema first
- Frameworks: NestJS `whitelist: true`, FastAPI/Flask Pydantic/Marshmallow schemas, Hono/Elysia validation schemas
- WHY: AI tends to generate `Model.update(req.body)` which allows attackers to set admin flags or change ownership

## A05 — Security Misconfiguration

- Set: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `CSP`
- Use `helmet` (Node.js), `django-csp` (Python), or equivalent middleware

### CORS

- DO configure specific origins — never `origin: '*'` with credentials
- DO set `Access-Control-Max-Age` (e.g., 3600) and restrict `Allow-Methods` to used methods only
- DO NOT use `origin: '*'` in production — whitelist exact domains
- DO NOT reflect the `Origin` header back without validation — equivalent to `*`

## A06 — Vulnerable Components / Supply Chain Security

- DO use lock files and install with `npm ci` / `pip install --require-hashes` in CI
- DO run SCA in CI — `npm audit`, `pip-audit`, `dotnet list package --vulnerable`
- DO pin dependencies to exact versions in production — avoid `^` / `~` ranges
- DO NOT add dependencies without reviewing maintainer count, last publish date, and download stats
- Remove unused dependencies — smaller surface area = fewer vulnerabilities

## A07 — Authentication Failures

- Use cryptographically random session tokens (min 128-bit entropy)
- Account lockout after 5 failed attempts with exponential backoff
- Use constant-time comparison for secrets (`timingSafeEqual`, `hmac.compare_digest`)
- DO NOT store JWT in localStorage — use httpOnly cookies

## A08 — Data Integrity Failures

- Verify CI/CD pipeline integrity — sign artifacts, use SRI for third-party scripts
- DO NOT deserialize untrusted data without validation

## A09 — Logging and Monitoring Failures

- Never expose stack traces, internal paths, versions, or query details to users

## A10 — SSRF

- Allowlist URLs in server-side HTTP requests — never let user input control destinations
- Restrict outbound traffic with network-level controls — sanitize responses before returning

## File Upload Security

- DO validate MIME type server-side using magic bytes — never trust `Content-Type` header alone
- DO enforce max file size at the framework level and allowlist extensions (never blocklist)
- DO sanitize filenames (strip path separators, prefer UUID-based names) and store outside web root
- DO NOT rely on client-side validation — it can be bypassed
