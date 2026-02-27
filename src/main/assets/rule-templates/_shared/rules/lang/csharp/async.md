---
description: "C# async/await and Task patterns"
paths:
  - "**/*.cs"
---

# C# Async Patterns

## Task vs ValueTask

- Use `Task` for most async operations
- Use `ValueTask` only when the method often completes synchronously (hot path, cached results)
- DO NOT await a `ValueTask` more than once — undefined behavior

## Parallel Execution

- Run independent operations in parallel: start all tasks, then `await Task.WhenAll()`
- Access individual results by awaiting each task variable after `WhenAll`
- When checking all exceptions from parallel tasks, inspect each `task.Exception` — `WhenAll` only throws the first

## Cancellation

- Accept `CancellationToken` in every async method — propagate it to all downstream calls
- Call `cancellationToken.ThrowIfCancellationRequested()` in loops
- Use `CancellationTokenSource` with timeout for deadline enforcement
- Use `CreateLinkedTokenSource` to combine multiple cancellation signals

## Async Streams

- Use `IAsyncEnumerable<T>` for streaming large datasets
- Decorate the cancellation parameter with `[EnumeratorCancellation]`
- Consume with `await foreach`

## Thread Safety

- Use `ConcurrentDictionary`, `ConcurrentQueue` for concurrent collections
- Use `SemaphoreSlim` for async locking — DO NOT use `lock` with `await` inside
- Use `Channel<T>` for producer/consumer scenarios

## Anti-patterns

- DO NOT use `async void` — exceptions are lost and cannot be awaited (only exception: event handlers)
- DO NOT block on async with `.Result` or `.Wait()` — deadlock risk
- DO NOT add unnecessary `async/await` — if the method just returns a single task, return it directly
- DO NOT use `lock` with async code inside — use `SemaphoreSlim` instead
