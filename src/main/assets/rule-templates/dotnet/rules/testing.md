---
description: ".NET testing with xUnit and NSubstitute"
paths:
  - "**/tests/**/*.cs"
  - "**/*.Tests/**/*.cs"
  - "**/*Tests.cs"
---

# Testing Rules

## Stack

- xUnit for test framework
- NSubstitute for mocking (preferred over Moq due to simpler API)
- DO use Verify for snapshot testing complex outputs (MediatR handler responses, serialized DTOs)
- FluentAssertions for readable assertions

## Unit Tests

- Use `[Fact]` for single cases, `[Theory]` with `[InlineData]` for parameterized cases
- Substitute interfaces with `Substitute.For<T>()` (NSubstitute)
- Verify calls with `await repo.Received(1).AddAsync(Arg.Any<User>(), Arg.Any<CancellationToken>())`

## Integration Tests

- Use `WebApplicationFactory<Program>` as the default for API integration tests
- Override services in `WithWebHostBuilder` to replace real DB with Testcontainers
- Use Testcontainers (`MsSqlContainer`, `PostgreSqlContainer`) for realistic database tests
- Implement `IAsyncLifetime` for test setup/teardown with containers

## What to Test

| Layer | Test type | What to verify |
|-------|-----------|---------------|
| Domain | Unit | Entity invariants, value object validation, factory methods |
| Application | Unit | Handler logic, validator rules (mock repos) |
| Infrastructure | Integration | Repository queries against real DB (Testcontainers) |
| WebApi | Integration | Full HTTP request/response cycle via `WebApplicationFactory` |

## Authentication in Tests

- Create a `TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>` for faking auth
- Register with `.AddAuthentication("Test").AddScheme<..., TestAuthHandler>("Test", null)`

## Test Data

- Use Builder pattern for complex entities: `new UserBuilder().WithEmail("x").AsAdmin().Build()`

## Coverage

- Run with: `dotnet test --collect:"XPlat Code Coverage"`

## Anti-patterns

- DO NOT test framework/library internals (EF Core mapping, MediatR dispatching)
- DO NOT use InMemoryDatabase for integration tests that need real SQL behavior -- use Testcontainers
- DO NOT mock everything -- unmocked collaborators catch integration bugs that mocks hide
