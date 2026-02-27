---
description: "Domain-Driven Design patterns for .NET"
paths:
  - "**/src/Domain/**/*.cs"
  - "**/src/**/Entities/**/*.cs"
  - "**/src/**/ValueObjects/**/*.cs"
  - "**/src/**/Aggregates/**/*.cs"
---

# DDD Rules

## Entities

- Inherit from a base `Entity` class with `Guid Id` and domain event collection
- Use private setters -- mutate state only through named behavior methods
- Include a private parameterless constructor for EF Core materialization
- Implement equality by `Id` (not by reference)

## Aggregate Roots

- Inherit from `AggregateRoot : Entity`
- Only aggregate roots have repositories -- never query child entities directly
- All mutations on child entities go through the aggregate root
- Keep aggregates small -- prefer references by ID over deep object graphs

## Value Objects

- Use `record` for simple Value Objects (automatic equality by value)
- For complex ones, inherit from a base `ValueObject` with `GetAtomicValues()` equality
- Validate invariants in a static `Create()` factory method returning `Result<T>`
- Value Objects are immutable -- no public setters

## Domain Events

- Define as `sealed record` inheriting from a `DomainEvent` base with `Id` and `OccurredAt`
- Raise events inside entity behavior methods via `AddDomainEvent()`
- Dispatch events after `SaveChangesAsync` (not before) to ensure persistence succeeded
- Use MediatR `INotification` for event handlers in the Application layer

## Domain Services

- Use when business logic requires multiple aggregates or external data
- Domain services are stateless -- inject only other domain interfaces
- DO NOT put domain logic in Application handlers -- push it into entities or domain services

## Repository Contracts

- Define in Domain layer: `IRepository<T> where T : AggregateRoot`
- Add specific query methods per aggregate (e.g., `GetWithLinesAsync`)
- See efcore.md for repository implementation rules (IQueryable exposure, Specification pattern)
- DO NOT define generic CRUD-only repositories if every aggregate needs custom queries

## Anti-patterns

- DO NOT create anemic domain models (public setters + logic in services) -- encapsulate behavior in entities
- DO NOT expose mutable collections -- return `IReadOnlyList<T>` backed by private `List<T>`
- See result-pattern rules for error handling via Result objects
- DO NOT reference other aggregates by navigation property -- reference by ID and load separately
