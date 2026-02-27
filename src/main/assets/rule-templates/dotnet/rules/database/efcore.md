---
description: "Entity Framework Core patterns and migrations"
paths:
  - "**/src/Infrastructure/**/*.cs"
  - "**/*DbContext*.cs"
  - "**/*Repository*.cs"
  - "**/Configurations/**/*.cs"
---

# Entity Framework Core Rules

## DbContext

- Use `DbContextOptions<T>` via primary constructor
- Apply all configurations from assembly: `modelBuilder.ApplyConfigurationsFromAssembly()`
- Override `SaveChangesAsync` for audit timestamps (`CreatedAt`, `UpdatedAt`)

## Entity Configuration

- Use Fluent API in `IEntityTypeConfiguration<T>` classes -- not data annotations on entities
- For PostgreSQL, use snake_case naming (e.g., via `UseSnakeCaseNamingConvention()` — requires EFCore.NamingConventions package). For SQL Server, PascalCase is conventional. Apply a consistent convention per project.
- Always set `HasMaxLength()` on string properties
- Use `ValueGeneratedNever()` for app-generated GUIDs
- Map enums with `.HasConversion<string>()`
- Map Value Objects with `OwnsOne()`

## Query Performance

- Use `AsSplitQuery()` when including multiple collections to avoid cartesian explosion
- Use `EF.CompileQuery()` for hot-path queries that execute frequently
- Use `ExecuteUpdateAsync()` / `ExecuteDeleteAsync()` for bulk operations -- avoids loading entities into memory

```csharp
// Bulk update without loading entities (.NET 7+)
await context.Users
    .Where(u => u.LastLogin < cutoff)
    .ExecuteUpdateAsync(s => s.SetProperty(u => u.IsActive, false));
```

## Repositories

- Implement `IRepository<T>` from Domain layer (see ddd rules for contract definition)
- DO NOT expose `IQueryable<T>` from repositories -- it leaks persistence details
- Use the Specification pattern for complex, reusable query filters

## Migrations

- Store migrations in `Infrastructure/Data/Migrations`
- Always provide both `Up()` and `Down()` methods
- Generate SQL scripts for production deployments: `dotnet ef migrations script`
- DO NOT use `EnsureCreated()` in production -- use `MigrateAsync()` only

## Soft Delete & Transactions

- Soft delete: global query filter `HasQueryFilter(e => e.DeletedAt == null)`, use `IgnoreQueryFilters()` for deleted records
- Transactions: rely on `SaveChangesAsync()` implicit transaction; explicit `BeginTransactionAsync()` only for multi-aggregate operations

## Anti-patterns

- DO NOT call `SaveChanges()` inside repository methods -- let Unit of Work control commit boundaries
- DO NOT use `Find()` for read queries -- it always tracks entities and may return locally cached entities that would be excluded by global query filters
- DO NOT lazy-load navigation properties -- use explicit `Include()` or projection
- DO NOT use `ToListAsync()` on unfiltered large tables -- always filter or paginate first
