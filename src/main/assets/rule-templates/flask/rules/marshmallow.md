---
description: "Marshmallow schema validation"
paths:
  - "**/*.py"
---

# Marshmallow Validation Rules

## Input/Output Separation (Mandatory)

Every endpoint that reads AND writes must have separate schemas:
- **Input schema** (`*CreateSchema`, `*UpdateSchema`): fields with `load_only=True` for write-only data (e.g., password)
- **Output schema** (`*ResponseSchema`): fields with `dump_only=True` for read-only data (e.g., id, created_at)

Never use a single schema for both `load()` and `dump()` — it leaks internal fields or accepts unintended input.

## Field Directives

| Directive | When to Use |
|---|---|
| `dump_only=True` | Computed/server-set fields: `id`, `created_at`, `updated_at` |
| `load_only=True` | Sensitive input: `password`, `password_confirm` |
| `required=True` | Mandatory on creation — pair with validators |
| `validate=` | Always add: `Length`, `Range`, `OneOf`, `Email`, `Regexp` |

**BANNED:** `fields.Str()` without validation on user input — always constrain length at minimum

## Validation Patterns

- Field-level: `@validates("field")` for single-field rules
- Cross-field: `@validates_schema` for multi-field rules (e.g., password confirmation)
- Pre-processing: `@pre_load` for normalization (e.g., lowercase email, strip whitespace)
- Post-processing: `@post_load` to return domain objects instead of dicts

## Partial Updates

Use `schema.load(data, partial=True)` for PATCH endpoints — skips `required` checks on missing fields. Define an `UpdateSchema` with no required fields for clarity.

## Nested Schemas

- Use `fields.Nested(ChildSchema)` for embedded objects
- Use `fields.List(fields.Nested(...))` for collections
- Self-referential: `fields.Nested("self", exclude=("children",))` to prevent infinite recursion

## Schema Inheritance

Define a `BaseSchema` with `Meta.ordered = True` and a `TimestampMixin` with `created_at`/`updated_at` as `dump_only`. Inherit in all domain schemas.

## Error Handling

See error-handlers rules for global `ValidationError` handler registration. Routes should call `schema.load()` without try/except — errors propagate automatically via the global handler.

## Anti-Patterns

- Single schema for input and output — leaks `password_hash` or accepts `id` in input
- Missing `required=True` on creation schemas — silently accepts empty data
- `schema.dump()` with raw dicts instead of model instances — skips `dump_only` enforcement
