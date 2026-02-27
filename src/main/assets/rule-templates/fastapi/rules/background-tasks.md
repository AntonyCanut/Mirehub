---
description: "FastAPI background task patterns"
paths:
  - "**/*.py"
---

# FastAPI Background Tasks

## When to Use What

| Approach | Use case | Durability |
|----------|----------|-----------|
| `BackgroundTasks` | Fire-and-forget, <30s (email, logging, cache) | None (lost on crash) |
| Celery / ARQ | Long-running, must survive crashes | Redis/RabbitMQ backed |
| APScheduler | Periodic/cron jobs | In-memory or persistent |

## BackgroundTasks Rules

- Inject `BackgroundTasks` as handler parameter -- add tasks via `background_tasks.add_task(fn, *args, **kwargs)`
- Tasks run AFTER the response is sent -- do not depend on task completion for the response
- Both sync and async functions are supported as tasks
- Can queue multiple tasks per request -- they execute sequentially
- Can inject `BackgroundTasks` in dependencies to decouple task registration from handlers

## Task Design

- Tasks MUST be idempotent -- they may run more than once on retry
- Tasks MUST handle their own errors -- unhandled exceptions are silently swallowed
- Tasks MUST NOT access the request/response cycle -- only pass serializable data
- Tasks that need DB access should create their own session -- NEVER reuse the request session

## Long-Running Tasks

- Use Celery or ARQ for tasks >30 seconds or tasks requiring retry/persistence
- Return `202 Accepted` with `task_id` -- provide a `GET /tasks/{task_id}` polling endpoint
- Track task status: `pending` > `running` > `completed` | `failed`

## Periodic Tasks

- Use APScheduler `AsyncIOScheduler` initialized in lifespan context manager
- Register jobs with `scheduler.add_job(fn, "interval"/"cron", ...)` during startup
- Shut down scheduler gracefully in lifespan cleanup

## Anti-patterns

- NEVER use `BackgroundTasks` for critical operations that must not be lost -- use a task queue
- NEVER pass ORM model instances to background tasks -- pass IDs and re-fetch in the task
- NEVER use in-memory task tracking in multi-process deployments -- use Redis or DB
- NEVER block the event loop in background tasks -- use `asyncio` or run sync code in executor
