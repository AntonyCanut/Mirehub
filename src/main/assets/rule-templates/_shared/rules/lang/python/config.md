---
description: "Python configuration with pydantic-settings"
paths:
  - "**/config.py"
  - "**/settings.py"
  - "**/config/**/*.py"
  - "**/settings/**/*.py"
---

# Python Configuration (pydantic-settings)

## Core Pattern

- Use `pydantic-settings.BaseSettings` for all configuration
- Load from environment variables and `.env` files
- Create a singleton with `@lru_cache` — never use mutable global dicts
- Validate required fields and formats with Pydantic validators

## Settings Structure

- Use `SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")`
- Use `env_nested_delimiter="__"` for nested config: `DATABASE__URL` maps to `database.url`
- Use `SecretStr` for passwords and API keys — hides values in logs and repr

## Environment-Specific Settings

- Create base class with shared defaults
- Subclass per environment: `DevelopmentSettings(debug=True)`, `ProductionSettings(debug=False)`
- Select via `ENVIRONMENT` env var with `@lru_cache` factory function
- DO NOT use `.env` files in production — use real environment variables or secret managers

## Validation

- Use `@field_validator` for field-level constraints (e.g., pool_size between 1-100)
- Use `@model_validator(mode="after")` for cross-field rules (e.g., debug must be False in production)
- Use `Field(pattern="...")` for enum-like string constraints

## FastAPI Integration

- Use `Annotated[Settings, Depends(get_settings)]` for dependency injection
- Override with `app.dependency_overrides[get_settings]` in tests

## Anti-patterns

- DO NOT hardcode secrets — load from environment
- DO NOT use mutable global dicts for config — use frozen BaseSettings
- DO NOT read `os.getenv()` directly without validation — values could be None or malformed
- DO NOT use `.env` files in production — use proper secret management
