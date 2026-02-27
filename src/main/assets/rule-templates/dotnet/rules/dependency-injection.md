---
description: ".NET dependency injection and service lifetimes"
paths:
  - "**/src/**/*.cs"
  - "**/src/**/Program.cs"
  - "**/src/**/DependencyInjection.cs"
---

# Dependency Injection Rules

## Registration Organization

- Create a `DependencyInjection.cs` extension method per layer (`AddApplication()`, `AddInfrastructure()`)
- Call them in `Program.cs`: `builder.Services.AddApplication().AddInfrastructure(builder.Configuration)`

## Service Lifetimes

| Lifetime | Use for | Examples |
|----------|---------|----------|
| Singleton | Stateless services, caches, config | `IDateTimeProvider`, `ICacheService` |
| Scoped | Per-request state, DB access | `DbContext`, repositories, `ICurrentUser` |
| Transient | Lightweight, stateless, no shared state | `IEmailBuilder`, `IPdfGenerator` |

## Injection Style

- Prefer primary constructors (C# 12+) for DI
- Use traditional constructor injection when you need `readonly` field assignments or null guards

## Keyed Services (.NET 8+)

- Use `AddKeyedScoped<TInterface, TImpl>("key")` when multiple implementations exist
- Inject with `[FromKeyedServices("key")]` attribute
- Use `IServiceProvider.GetRequiredKeyedService<T>(key)` for dynamic resolution

## Decorator Pattern

- Use Scrutor's `.Decorate<TInterface, TDecorator>()` for cross-cutting concerns (caching, logging)
- Without Scrutor: register manually via factory delegate

## Anti-patterns

- DO NOT use the Service Locator pattern (injecting `IServiceProvider` and resolving manually) -- it hides dependencies
- DO NOT capture scoped services in singletons (captive dependency) -- use `IServiceScopeFactory` instead
- DO NOT `new` up services manually -- it defeats testability and lifecycle management
- DO NOT register services with mismatched lifetimes (scoped inside singleton) -- causes memory leaks and stale data
