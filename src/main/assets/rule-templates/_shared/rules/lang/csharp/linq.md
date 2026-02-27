---
description: "LINQ query best practices"
paths:
  - "**/*.cs"
---

# LINQ Best Practices

## Syntax Choice

| Scenario | Preferred |
|----------|-----------|
| Simple filter/map/sort | Method syntax (`.Where().Select()`) |
| Joins, complex grouping | Query syntax (`from ... join ... select`) |

## Deferred vs Immediate Execution

- `IEnumerable<T>` queries are deferred — not executed until enumerated
- Materialize with `.ToList()` or `.ToArray()` when you need to enumerate multiple times
- DO NOT enumerate an `IEnumerable` twice — it may produce different results or hit the DB twice

## Filtering

- Chain `.Where()` calls for readability
- Use `.Any()` for existence checks — never `.Where().Count() > 0`
- Use `FirstOrDefault` for 0-or-more, `SingleOrDefault` for exactly 0-or-1

## Projection and Grouping

- Use `.Select()` to project only needed fields — reduces memory and improves SQL translation
- Use `.SelectMany()` to flatten nested collections
- Use `.ToLookup()` when you need to access groups multiple times (immediate execution)

## Set Operations

- Use `DistinctBy` (.NET 6+) instead of `.GroupBy().Select(g => g.First())`
- Use `Chunk` (.NET 6+) for batch processing: `items.Chunk(100)`

## Ordering

- Chain with `.ThenBy()` / `.ThenByDescending()` for multiple sort criteria

## EF Core Specifics

- Use `AsNoTracking()` for read-only queries — avoids change tracking overhead
- Project to DTOs in the query: `.Select(u => new UserDto(...))` — avoids over-fetching
- DO NOT call local methods inside EF LINQ queries — they cannot be translated to SQL
- If client evaluation is needed, switch with `.AsEnumerable()` first, then filter

## Anti-patterns

- DO NOT enumerate `IEnumerable` multiple times — materialize first
- DO NOT use `.Count() > 0` — use `.Any()`
- DO NOT call local functions inside EF Core queries — will throw at runtime
- DO NOT forget `AsNoTracking()` on read-only queries
