---
description: "Python asyncio patterns"
paths:
  - "**/handlers/**/*.py"
  - "**/services/**/*.py"
  - "**/consumers/**/*.py"
  - "**/workers/**/*.py"
  - "**/*_async*.py"
---

# Python Async Patterns

## Fundamentals

- Use `async def` for all I/O-bound operations
- DO NOT use sync I/O libs in async functions — `requests` blocks the event loop, use `httpx`
- Async library choices: `httpx` (HTTP), `asyncpg` (PostgreSQL), `redis.asyncio` (Redis)

## Concurrent Execution

- Use `asyncio.gather()` for parallel independent tasks with optional `return_exceptions=True`
- Use `asyncio.TaskGroup` (Python 3.11+) for structured concurrency — all tasks complete or cancel together
- Handle `ExceptionGroup` with `except*` when using TaskGroup

## Rate Limiting

- Use `asyncio.Semaphore(max_concurrent)` to limit parallel operations
- Wrap each concurrent call in `async with semaphore:` block

## Timeouts

- Use `async with asyncio.timeout(seconds):` (Python 3.11+) for timeout enforcement
- Catch `asyncio.TimeoutError` and handle gracefully

## Async Context Managers

- Use `@asynccontextmanager` from `contextlib` for resource lifecycle (connections, sessions)
- Ensure cleanup in `finally` block: close connections, rollback transactions

## Async Iterators

- Use `async for` to consume paginated APIs or streaming data
- Use `AsyncIterator[T]` return type with `yield` for generators

## Background Tasks

- Keep strong references to tasks (`set.add(task)`) — untracked tasks get garbage collected
- Use `task.add_done_callback(tasks.discard)` for automatic cleanup
- Cancel all background tasks on shutdown

## Anti-patterns

- DO NOT use `requests`, `psycopg2`, or sync `redis` in async code — blocks the event loop
- DO NOT create tasks without tracking them — fire-and-forget tasks silently fail
- DO NOT use `asyncio.wait_for` when `asyncio.timeout` (3.11+) is available
- DO NOT mix `await` and blocking calls in the same function
