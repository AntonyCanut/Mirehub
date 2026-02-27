---
description: ".NET background services and hosted workers"
paths:
  - "**/*Worker.cs"
  - "**/*Service.cs"
  - "**/BackgroundServices/**/*.cs"
  - "**/Workers/**/*.cs"
  - "**/Jobs/**/*.cs"
---

# Background Services Rules

## Implementation

- Inherit from `BackgroundService` for long-running workers
- Implement `IHostedService` for startup/shutdown tasks (e.g., migrations)
- Register with `builder.Services.AddHostedService<T>()`

## Scoped Dependencies

- Create a new `IServiceScope` per iteration -- never inject scoped services in the constructor
- Use `IServiceProvider.CreateAsyncScope()` and dispose with `await using`

## Error Handling

- Wrap the loop body in `try/catch` -- an unhandled exception kills the worker permanently
- Log the exception and add a backoff delay on failure
- DO NOT swallow exceptions silently -- always log at `Error` level minimum

## Cancellation

- Check `stoppingToken.IsCancellationRequested` in every loop
- Pass `stoppingToken` to all async calls including `Task.Delay`
- DO NOT use `while (true)` -- always use `while (!stoppingToken.IsCancellationRequested)`

## Queue Processing

- Use `Channel<T>` for in-process producer/consumer queues
- Spawn multiple consumer tasks for parallelism with `Task.WhenAll`
- Use `channel.Reader.ReadAllAsync(ct)` for backpressure-aware consumption

## Scheduling

- For simple intervals: `Task.Delay(interval, stoppingToken)` in the loop
- For cron schedules: use NCronTab or Quartz.NET
- For distributed scheduling: use Hangfire or Quartz with persistent storage

## Health Checks

- Implement `IHealthCheck` per worker to report last-run status
- Track `LastRunTime` and `LastError` in a singleton status service

## Anti-patterns

- DO NOT inject scoped services directly into constructor -- use `IServiceProvider.CreateAsyncScope()` per iteration (see DI rules for captive dependency)
- DO NOT poll without delay when idle -- it causes CPU spinning
- DO NOT ignore `StopAsync` graceful shutdown -- finish or cancel current work
