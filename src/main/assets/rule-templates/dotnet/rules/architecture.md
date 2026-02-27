---
description: "Clean Architecture layers and dependencies"
paths:
  - "**/src/**/*.cs"
---

# Architecture Rules

## Clean Architecture (Default)

See core.md for the canonical layer table and dependency rules.

## Vertical Slice Architecture (Alternative)

Use Vertical Slices for smaller projects or bounded contexts where Clean Architecture adds unnecessary ceremony:
- One folder per feature containing endpoint, handler, validator, and DTO
- Still enforce domain logic isolation (no DB access in domain entities)
- Choose one approach per bounded context -- do not mix within the same context

## Cross-references

See mediatr.md for CQRS separation, ddd.md for domain patterns, efcore.md for data access.

## Anti-patterns

- DO NOT reference `Infrastructure` from `Application` -- invert with interfaces
- DO NOT create a "Common" or "Shared" project that everything references -- it becomes a dumping ground
