---
description: "MediatR CQRS and pipeline behaviors"
paths:
  - "**/src/Application/**/*.cs"
---

# MediatR / Mediator Pattern Rules

## Licensing Notice

MediatR v12+ is commercial (requires license for production). Evaluate alternatives:

| Option | When to use |
|--------|-------------|
| MediatR (licensed) | Existing projects, full pipeline behaviors support |
| Wolverine | Full-featured mediator + messaging, OSS |
| FastEndpoints | Endpoint-centric alternative, built-in validation |
| Custom mediator | Simple projects -- a 50-line `IMediator` covers most needs |

## CQRS Separation

- Commands: modify state, return `Result<T>` or `Result` (or minimal data like ID)
- Queries: return data, never modify state
- Use `ISender` (not `IMediator`) for dispatching -- it is the narrower interface

## Vertical Slice Architecture

As a pragmatic alternative to full Clean Architecture CQRS:
- Colocate request, handler, validator, and response DTO in one file/folder per feature
- Each slice is self-contained and independently modifiable
- Still separate read (query) from write (command) concerns within the slice

## Pipeline Behaviors

Register behaviors in order (first registered = outermost):
1. `LoggingBehavior` -- log request name, duration, failures
2. `ValidationBehavior` -- run FluentValidation validators, throw on failure
3. `TransactionBehavior` -- wrap commands (not queries) in a DB transaction

## Handler Conventions

- One handler per command/query (Single Responsibility)
- Colocate command + handler + validator in the same folder
- Return `Result<T>` from handlers -- see result-pattern rules
- Accept `CancellationToken` and propagate it to all async calls

## Domain Events

- Use `INotification` for domain event fan-out (multiple handlers per event)
- See ddd.md for domain event dispatch rules (timing relative to SaveChangesAsync)
- Keep event handlers idempotent -- they may be retried

## Anti-patterns

- DO NOT inject `IMediator` when `ISender` suffices -- `IMediator` includes `Publish` which is rarely needed in handlers
- DO NOT use MediatR for in-process method calls that have a single handler -- direct injection is simpler
- DO NOT put domain logic in pipeline behaviors -- keep them cross-cutting only (logging, validation, transactions)
- DO NOT create a pipeline behavior per feature -- use generic open behaviors
