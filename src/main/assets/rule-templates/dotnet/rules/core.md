---
description: ".NET 9 project conventions and architecture"
alwaysApply: true
---

# .NET Project Guidelines

## Stack

- .NET 9, ASP.NET Core, Entity Framework Core, C# 12+
- xUnit + NSubstitute + FluentAssertions

## Architecture

Use Clean Architecture with strict layer dependencies:
- `WebApi -> Application -> Domain`
- `Infrastructure -> Application -> Domain`

| Layer | Contains | References |
|-------|----------|------------|
| Domain | Entities, Value Objects, Interfaces | Nothing (zero NuGet deps) |
| Application | Commands, Queries, DTOs, Validators | Domain only |
| Infrastructure | DbContext, Repos, External Services | Application, Domain |
| WebApi | Endpoints, Middleware | Application, Infrastructure |

## API Style

- Minimal APIs by default -- see api rules for TypedResults, versioning, rate limiting
- Use `AddOpenApi()` + `MapOpenApi()` for built-in OpenAPI support (no Swashbuckle needed in .NET 9)
- Reserve Controllers only for complex model binding or content negotiation scenarios

## Commands

```bash
dotnet run --project src/WebApi
dotnet test
dotnet ef migrations add Name -p src/Infrastructure -s src/WebApi
dotnet ef database update -p src/Infrastructure -s src/WebApi
```

