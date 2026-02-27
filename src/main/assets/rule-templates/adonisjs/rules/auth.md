---
description: "AdonisJS authentication and session management"
paths:
  - "**/app/controllers/auth/**/*.ts"
  - "**/app/middleware/**/*.ts"
  - "**/config/auth.ts"
---

# AdonisJS Authentication

## Guard Selection

| Use case | Guard | Package |
|----------|-------|---------|
| Web app (SSR) | Session | `@adonisjs/session` |
| API (SPA, mobile) | Access Token | `@adonisjs/auth/access_tokens` |
| API (machine-to-machine) | API Key | Custom middleware or `@adonisjs/auth/access_tokens` |

## Access Tokens

- Configure guard in `config/auth.ts` using `tokensGuard` + `tokensUserProvider`
- Add `static accessTokens = DbAccessTokensProvider.forModel(User)` on the User model
- Create tokens via `User.accessTokens.create(user)`, release value with `.value!.release()`
- Delete tokens on logout via `User.accessTokens.delete(user, identifier)`

## Session Guard

- Configure with `sessionGuard` + `sessionUserProvider` in `config/auth.ts`
- Use `auth.use('web').login(user)` / `auth.use('web').logout()` in controllers
- Session storage configured in `config/session.ts`

## Auth Middleware

- Apply `middleware.auth()` on protected routes or route groups
- Access authenticated user via `auth.user!` (typed as User after middleware)
- NEVER trust `auth.user` without auth middleware -- it may be `undefined`

## Password Hashing

- Use `hash.make()` / `hash.verify()` from `@adonisjs/core/services/hash`
- NEVER store plain-text passwords -- use `@beforeSave` model hook for automatic hashing

## Auth Validators

- Use `vine.compile()` for login/register validators (pre-compiled for performance)
- Login: validate `email` + `password` only
- Register: validate all fields, use `.confirmed()` for password confirmation

## Anti-patterns

- Do NOT return raw password hashes in API responses -- use `serializeAs: null` on password column
- Do NOT check credentials manually in controllers -- delegate to auth guard or service
- Do NOT mix guards in the same route group — the first failing guard short-circuits, causing confusing 401s for valid users of other guard types
