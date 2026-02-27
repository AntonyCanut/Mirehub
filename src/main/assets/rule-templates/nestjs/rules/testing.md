---
description: "NestJS testing with Vitest"
paths:
  - "**/src/**/*.spec.ts"
  - "**/test/**/*.e2e-spec.ts"
---

# NestJS Testing

## Test Runner

- DO use Vitest as the test runner — faster than Jest, native ESM support
- DO use `@golevelup/ts-vitest` for `createMock<T>()` — auto-mocks all methods of a class with `vi.fn()`
- DO use Supertest for E2E HTTP assertions

## What to Test Where

| Layer | Test Type | Mock Boundary |
|-------|-----------|--------------|
| Service | Unit | Mock repositories and external services |
| Controller | Unit (optional) | Mock service — mostly covered by E2E |
| Guard / Pipe | Unit | Mock `ExecutionContext` / input values |
| Full API flow | E2E | Real modules, test DB, mock external APIs |

## Unit Test Directives

- DO use `Test.createTestingModule()` to build the testing module with mocked providers
- DO mock dependencies at the repository/adapter boundary — not deep internals
- DO test business logic branches: happy path, not-found, forbidden, conflict
- DO assert that the correct exception type is thrown (e.g., `rejects.toThrow(NotFoundException)`)
- DO NOT test NestJS framework behavior (DI wiring, decorator metadata) — trust the framework

## Mocking Pattern

```typescript
// With @golevelup/ts-vitest
const mockRepo = createMock<UsersRepository>();
mockRepo.findById.mockResolvedValue(someUser);
```

- For TypeORM: `{ provide: getRepositoryToken(Entity), useValue: createMock<Repository<Entity>>() }`
- For Prisma: mock the model methods on `PrismaService` (`user.findUnique`, `user.create`, etc.)

## E2E Test Directives

- DO apply the same global pipes/filters/interceptors as production in `beforeAll`
- DO use a dedicated test database — never run E2E against dev/prod
- DO clean/reset the database between test suites (not between every test — too slow)
- DO test auth flows: valid token, expired token, missing token, insufficient role
- DO test validation: missing fields, invalid types, extra properties (should be rejected)

## Anti-patterns

- DO NOT skip E2E tests for "unit test coverage" — E2E catches integration bugs that units miss
