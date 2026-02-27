---
description: "Pydantic v2 model validation patterns"
paths:
  - "**/schemas/**/*.py"
  - "**/models/**/*.py"
  - "**/*_schema.py"
  - "**/*_model.py"
---

# Pydantic v2 Validation

## Canonical Patterns

- Use `ConfigDict(from_attributes=True)` on all response schemas -- NEVER inner `class Config`
- Use `model_validate()` to construct from ORM/dict -- NEVER `.from_orm()` or `.parse_obj()`
- Use `model_dump()` for serialization -- NEVER `.dict()`
- Use `model_dump_json()` for JSON string -- NEVER `.json()`
- Use `model_json_schema()` for JSON schema -- NEVER `.schema()`
- Use `Field(...)` for required fields, `Field(default=None)` for optional

## Banned v1 Methods

| Deprecated (v1) | Replacement (v2) |
|-----------------|-----------------|
| `.dict()` | `.model_dump()` |
| `.json()` | `.model_dump_json()` |
| `.parse_obj()` | `.model_validate()` |
| `.from_orm()` | `model_validate(obj, from_attributes=True)` |
| `.schema()` | `.model_json_schema()` |
| `class Config` | `model_config = ConfigDict(...)` |
| `@validator` | `@field_validator` |
| `@root_validator` | `@model_validator(mode="before"/"after")` |

## Schema Design

- Separate schemas per operation: `Create`, `Update`, `Response` -- NEVER reuse one model for all
- `Update` schemas: all fields `Optional` with `None` default for PATCH semantics
- Response schemas: always set `model_config = ConfigDict(from_attributes=True)`
- Use `Annotated` with `AfterValidator`/`BeforeValidator` for reusable custom types
- Use `computed_field` for derived values included in serialization

## Validation

- Use `EmailStr` for emails -- NEVER manual regex
- Use `Field(min_length=, max_length=, ge=, le=)` for constraints -- NEVER manual checks
- Use `@field_validator` with `@classmethod` for single-field validation
- Use `@model_validator(mode="after")` for cross-field validation
- Use `Literal` or `Enum` for fixed sets of values

## Generic Pagination

Use `PaginatedResponse[T](BaseModel, Generic[T])` with `items`, `total`, `page`, `size`, `pages` fields.

## Anti-patterns

- NEVER accept `dict` as route input -- always use a Pydantic model
- NEVER use `Optional[X]` -- use `X | None` (Python 3.10+ union syntax)
- NEVER do manual validation that Pydantic handles (email regex, length checks)
- NEVER use `List[X]` / `Dict[K, V]` -- use `list[X]` / `dict[K, V]` (lowercase builtins)
