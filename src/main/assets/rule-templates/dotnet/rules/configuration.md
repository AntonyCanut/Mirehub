---
description: ".NET configuration and options pattern"
paths:
  - "**/appsettings*.json"
  - "**/Options/**/*.cs"
  - "**/*Options.cs"
  - "**/*Settings.cs"
---

# Configuration Rules

## Options Pattern

- Create a POCO class per config section with a `const string SectionName` field
- Bind with `builder.Services.AddOptions<MyOptions>().Bind(config.GetSection(MyOptions.SectionName))`
- Always call `.ValidateDataAnnotations().ValidateOnStart()` to fail fast on misconfiguration
- DO NOT inject `IConfiguration` directly -- use typed `IOptions<T>` instead (no type safety otherwise)

## Options Interfaces

| Interface | Lifetime | Reloads on change | Use when |
|-----------|----------|--------------------|----------|
| `IOptions<T>` | Singleton | No | Config read once at startup |
| `IOptionsSnapshot<T>` | Scoped | Yes, per request | Config may change, scoped service |
| `IOptionsMonitor<T>` | Singleton | Yes, live | Config may change, singleton service |

## Named Options

- Use named options when the same shape binds to multiple sections (e.g., primary/backup storage)
- Resolve with `IOptionsSnapshot<T>.Get("name")`

## Configuration Precedence (last wins)

1. `appsettings.json`
2. `appsettings.{Environment}.json`
3. User Secrets (Development only)
4. Environment variables (use `__` for nesting: `Database__ConnectionString`)
5. Command-line arguments

## Secrets

- Use `dotnet user-secrets` for local development
- Use Azure Key Vault, AWS Secrets Manager, or HashiCorp Vault in production
- DO NOT commit secrets to `appsettings.json` -- keep connection strings and API keys out of source control

## Validation

- Use Data Annotations (`[Required]`, `[Range]`, `[MinLength]`) for simple constraints
- Use FluentValidation or custom `IValidateOptions<T>` for complex rules

## Anti-patterns

- DO NOT use `configuration["Key"]` string indexing -- it silently returns null on typos
- DO NOT skip `.ValidateOnStart()` -- runtime failures are harder to debug than startup failures
- DO NOT hardcode config values -- always externalize to appsettings or environment variables
