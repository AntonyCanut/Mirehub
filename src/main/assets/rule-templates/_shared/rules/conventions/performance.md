---
description: "Performance optimization patterns"
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.py"
  - "**/*.cs"
---

# Performance Rules

## Database

- Prevent N+1 queries — use eager loading or batch loading, never fetch in a loop
- Add indexes on: foreign keys, WHERE columns, ORDER BY columns, JOIN columns
- Select only needed fields — never use `SELECT *` in production code
- Paginate all list queries — never return unbounded result sets

## Caching

- Cache expensive operations with a TTL — invalidate on writes
- Memoize pure functions when called repeatedly with same inputs
- Use bounded caches (LRU) — unbounded caches are memory leaks

## Async Operations

- Run independent operations in parallel (`Promise.all`, `asyncio.gather`, `Task.WhenAll`)
- DO NOT block the event loop with sync computation in async contexts
- Use streaming for large data transfers instead of loading all into memory

## Memory

- Clean up subscriptions, event listeners, and timers on teardown
- Limit collection sizes — use LRU or ring buffers for caches
- Watch for closures holding references to large objects

## Quick Decision Matrix

| Situation | Action |
|-----------|--------|
| Multiple independent I/O calls | Run in parallel |
| Large dataset returned to client | Paginate or stream |
| Repeated expensive computation | Memoize or cache |
| List > 100 items in UI | Use virtual scrolling |
| Slow query | Profile, add index, check N+1 |
| Heavy sync work in async context | Offload to worker or break into chunks |

## Anti-patterns

- DO NOT optimize without profiling first — measure, then optimize
- DO NOT cache without invalidation strategy — stale data causes bugs
- DO NOT load entire tables into memory — paginate or stream
- DO NOT create subscriptions without cleanup logic
