---
description: "AdonisJS testing with Japa"
paths:
  - "**/tests/**/*.ts"
---

# AdonisJS Testing (Japa)

## Test Runner

- Japa is the native AdonisJS test runner -- do NOT use Jest or Mocha
- Run tests: `node ace test`, filter: `--files="tests/functional/**"`, watch: `--watch`
- Tag tests with `@slow`, `@regression` and filter with `--tags`

## Test Organization

| Directory | Purpose | Client |
|-----------|---------|--------|
| `tests/unit/` | Services, utilities, pure logic | Direct instantiation |
| `tests/functional/` | HTTP endpoints, request/response | `apiClient` |
| `tests/e2e/` | Full browser flows | `browserClient` (Playwright) |

## HTTP Tests (apiClient)

- Use `client.get()`, `client.post()`, etc. for endpoint testing
- Chain `.json({})` for request body, `.header()` for headers
- Authenticate with `.loginAs(user)` -- no manual token management
- Assert with `response.assertStatus()`, `response.assertBodyContains()`

## Database Isolation

- Use global transactions for per-test isolation via `testUtils`:

```typescript
import testUtils from '@adonisjs/core/services/test_utils'

group.each.setup(() => testUtils.db().withGlobalTransaction())
```

## Factories

- Use Lucid model factories for test data: `UserFactory.create()`, `UserFactory.createMany(5)`
- Build relationships: `UserFactory.with('posts', 3).create()`
- Override attributes: `UserFactory.merge({ email: 'specific@test.com' }).create()`

## Mocking

- Use `mail.fake()` / `mail.restore()` for email assertions
- Use `emitter.fake()` for event assertions
- Prefer DI-based test doubles over global mocking

## Assertions

- `response.assertStatus(code)` -- HTTP status
- `response.assertBody(obj)` -- exact body match
- `response.assertBodyContains(partial)` -- partial body match
- `assert.exists()`, `assert.equal()`, `assert.lengthOf()` -- Japa built-ins

## Anti-patterns

- Do NOT use `withGlobalTransaction()` AND `truncate` in the same group -- pick one strategy
- Do NOT test implementation details -- test behavior through public API
- Do NOT skip `group.each.setup` for database tests -- leads to test pollution
- Do NOT mock Lucid models directly -- use factories and real database queries
