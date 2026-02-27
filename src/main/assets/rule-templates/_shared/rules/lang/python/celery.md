---
description: "Celery task queue patterns"
paths:
  - "**/tasks/**/*.py"
  - "**/celery.py"
  - "**/celeryconfig.py"
  - "**/*_task.py"
  - "**/*_tasks.py"
---

# Python Celery

## Task Definition

- Use `@shared_task(bind=True)` for access to `self` (retries, progress)
- Always set `max_retries`, `soft_time_limit`, and `time_limit`
- Use `autoretry_for=(Exception,)` with `retry_backoff=True` and `retry_jitter=True`
- Pass primitive types (IDs, strings) — never pass ORM objects (not serializable)
- Fetch entities from DB inside the task using the ID

## Configuration Essentials

| Setting | Recommendation |
|---------|---------------|
| `task_serializer` | `"json"` |
| `task_acks_late` | `True` — acknowledge after completion |
| `task_reject_on_worker_lost` | `True` — re-queue on crash |
| `worker_prefetch_multiplier` | `1` for fair scheduling |
| `result_expires` | 3600 (1 hour) |

## Task Routing

- Define named queues: `default`, `high_priority`, `low_priority`
- Route tasks by module path: `"app.tasks.email.*": {"queue": "high_priority"}`

## Workflows

- `chain()` for sequential execution: fetch > process > save
- `group()` for parallel execution
- `chord()` for parallel with aggregation callback

## Scheduled Tasks (Beat)

- Use `crontab()` for time-based schedules
- Define all schedules in `app.conf.beat_schedule`

## Database Access in Tasks

- Always use a context manager for DB sessions — never leave connections open
- Commit or rollback explicitly within the task

## Monitoring

- Use `BaseTask` subclass with `on_failure`, `on_success`, `on_retry` hooks for logging
- Track task duration with `task_prerun` / `task_postrun` signals

## Anti-patterns

- DO NOT pass ORM objects to tasks — pass IDs, fetch inside the task
- DO NOT use `autoretry_for` without `max_retries` — creates infinite retry loops
- DO NOT open DB connections without cleanup — use context managers
- DO NOT use `time.sleep()` in tasks — it blocks the worker
- DO NOT forget `soft_time_limit` — tasks without limits can hang forever
