---
description: "CI/CD pipeline best practices"
paths:
  - ".github/workflows/**"
  - ".gitlab-ci.yml"
  - "**/azure-pipelines.yml"
  - "Jenkinsfile"
  - ".circleci/**"
---

# CI/CD Best Practices

## Pipeline Principles

- Run fast checks first (lint, type-check) — fail fast
- Parallelize independent jobs
- Cache dependencies between runs
- Use concurrency groups to cancel outdated runs
- Use `affected` commands in monorepos — never run everything on every commit

## Pipeline Order

1. Lint + type-check (fast, parallel)
2. Unit tests (parallel)
3. Build
4. Integration/E2E tests
5. Deploy (with approval gates for production)

## Quality Gates

| Check | Threshold |
|-------|-----------|
| Lint | 0 errors |
| Type check | 0 errors |
| Unit tests | 100% pass |
| Coverage | >= 80% |
| Security audit | 0 critical |
| Build | Success |

## Branch Protection

- Require PR reviews before merging
- Require status checks to pass
- Enforce linear history (squash or rebase)
- Restrict force pushes to main

## Secrets in CI

- Use CI provider's secret management — never hardcode in workflow files
- Use environment-scoped secrets for different stages
- Reference via CI provider's secret syntax (e.g., `${{ secrets.NAME }}` in GitHub Actions)

## Caching

- Use built-in caching (e.g., `actions/setup-node` with `cache: 'npm'` in GitHub Actions)
- Key caches on lock file hash
- Use Docker layer caching with `cache-from: type=gha`

## Anti-patterns

- DO NOT run all tests on every commit in monorepos — use `affected`
- DO NOT skip caching — slow pipelines kill productivity
- DO NOT hardcode secrets in workflow files
- DO NOT deploy without approval gates for production
- DO NOT skip rollback strategy planning
