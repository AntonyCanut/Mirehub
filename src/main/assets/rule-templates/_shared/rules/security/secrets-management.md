---
description: "Secrets and environment variable handling"
paths:
  - "**/.env*"
  - "**/secrets/**"
  - "**/config/**"
  - "**/appsettings*.json"
---

# Secrets Management

## Core Principles

- NEVER commit secrets to version control — no exceptions
- Rotate credentials every 90 days max for critical secrets
- Least privilege — grant only necessary access
- Encrypt at rest and in transit
- Validate required secrets at application startup — fail fast if missing

## Environment Files

| File | Commit? | Purpose |
|------|---------|---------|
| `.env` | No | Local environment variables (may contain secrets) |
| `.env.example` | Yes | Template with placeholder values (commit) |
| `.env.local` | No | Local overrides with secrets |
| `.env.development` | Yes | Dev environment (no secrets) |
| `.env.production` | Yes | Prod template (no secrets) |
| `.env.*.local` | No | Environment secrets |

## .gitignore Mandate

- Always ignore: `.env.local`, `.env.*.local`, `*.pem`, `*.key`, `**/secrets/`, `credentials.json`, `service-account.json`

## Secret Storage Decision

| Type | Storage |
|------|---------|
| API keys, DB credentials, OAuth secrets | Vault / Cloud Secrets Manager |
| JWT signing keys | Vault / env vars (never code) |
| Encryption keys | KMS / HSM |
| TLS certificates | Cert Manager / Cloud Provider |
| CI/CD secrets | Platform secret store (GitHub Actions Secrets, GitLab CI Variables) |

## Secret Rotation Process

1. Generate new secret
2. Deploy accepting both old and new (dual-read)
3. Update all consumers to use new
4. Remove old secret from config
5. Revoke old secret in provider

## Anti-patterns

- DO NOT commit `.env` with real secrets — use `.env.example` as template
- DO NOT share secrets via Slack/email — use secret manager sharing
- DO NOT use same secrets across environments — compromised dev shouldn't affect prod
- DO NOT hardcode secrets in Dockerfiles or CI configs — use mounted secrets
- DO NOT log secrets even accidentally — redact sensitive fields in serializers
- DO NOT skip rotation after a compromise — rotate immediately
