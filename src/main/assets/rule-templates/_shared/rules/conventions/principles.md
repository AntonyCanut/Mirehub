---
description: "YAGNI, KISS, SoC, DRY design principles"
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.py"
  - "**/*.cs"
---

# Software Engineering Principles

## YAGNI — Do Not Build for Hypothetical Futures

- Implement only what is needed now, not what might be needed later
- DO NOT create abstract base classes with one implementation
- DO NOT add configuration for things that have only one value
- Refactor when the need arises, not before

## KISS — Simplest Solution That Works

- Prefer a plain function over a singleton class
- Prefer explicit code over clever abstractions
- If it is hard to explain, it is too complex — simplify

## SoC — Separate Validation, Business Logic, Data Access

- Validation belongs at the boundary (controller/handler)
- Business logic belongs in services
- Data access belongs in repositories
- DO NOT mix HTTP concerns into service layer

## DRY — But Duplication Beats Wrong Abstraction

- Extract shared code only when contexts are truly identical
- Two similar functions with different domain contexts are not duplication
- The Rule of Three: tolerate duplication until the third occurrence, then abstract

## Decision Matrix

| Principle | DO | DO NOT |
|-----------|-----|---------|
| YAGNI | Build what you need now | Add "just in case" features |
| KISS | Write simple, readable code | Over-engineer with patterns |
| SoC | Keep layers independent | Mix HTTP, business, and data logic |
| DRY | Extract truly shared logic | Force unrelated code into one abstraction |
