---
description: "Docker containerization best practices"
paths:
  - "**/Dockerfile"
  - "**/docker-compose*.yml"
  - "**/.dockerignore"
---

# Docker Best Practices

## Dockerfile Principles

- Use multi-stage builds — separate build and runtime stages
- Use specific version tags — never use `:latest`
- Run as non-root user — create a dedicated `appuser`
- Order layers from least to most frequently changed: base > system deps > app deps > app code
- Copy dependency files first, install, then copy source — maximizes layer cache hits

## Security

- Pin base image to specific version (e.g., `node:20.10.0-alpine`)
- Run as non-root: `USER appuser` after `RUN adduser`
- Set `read_only: true` and `no-new-privileges: true` in production compose
- Never put secrets in Dockerfile — use runtime env vars or secret managers

## .dockerignore

Always include: `node_modules`, `.git`, `.env`, `.env.*`, `coverage`, `dist`, `.nx`, `*.md`, `.vscode`, `.idea`

## Health Checks

- Always define HEALTHCHECK in Dockerfile or compose
- Implement `/health`, `/ready`, `/live` endpoints in your app
- Configure: interval 30s, timeout 10s, start_period 5-40s, retries 3

## Docker Compose

- Use `depends_on` with `condition: service_healthy` for startup ordering
- Set resource limits (`cpus`, `memory`) in production
- Use named volumes for persistent data
- Use `target` to select build stage (`development` vs `production`)

## Environment Variables

- Use `ARG` for build-time values, `ENV` for runtime values
- Never hardcode secrets — pass via `docker run -e` or `env_file`

## Anti-patterns

- DO NOT use `:latest` tag — pin specific versions
- DO NOT run as root in production
- DO NOT copy entire context before installing deps — deps change less often
- DO NOT skip multi-stage builds — final image should not contain build tools
- DO NOT forget .dockerignore — bloated context slows builds
- DO NOT skip health checks — container orchestrators need them
- DO NOT hardcode secrets in Dockerfile or compose files
