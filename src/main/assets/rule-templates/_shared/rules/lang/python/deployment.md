---
description: "Python deployment and packaging"
paths:
  - "Dockerfile"
  - "**/docker-compose*.yml"
  - "**/gunicorn.conf.py"
  - "**/uvicorn_config.py"
  - "**/deploy/**"
  - ".github/workflows/*.yml"
---

# Python Deployment

## Dockerfile

- Base image: `python:<version>-slim` (e.g., `python:3.12-slim`) — not full image, not alpine (C extension issues)
- Set: `PYTHONDONTWRITEBYTECODE=1`, `PYTHONUNBUFFERED=1`, `PIP_NO_CACHE_DIR=1`

## Gunicorn Configuration

- Worker class: `uvicorn.workers.UvicornWorker` for ASGI apps
- Workers: `cpu_count * 2 + 1` as starting point
- Set `max_requests` + `max_requests_jitter` to recycle workers and prevent memory leaks
- Set `timeout` and `graceful_timeout` for request deadlines
- Enable `preload_app = True` for memory efficiency

## CI/CD Pipeline

1. Lint (`ruff check .`, `ruff format --check .`)
2. Type check (`mypy app`)
3. Test (`pytest --cov=app`)
4. Build and push Docker image
5. Deploy with approval gate

## Anti-patterns

- DO NOT install dev dependencies in production images
