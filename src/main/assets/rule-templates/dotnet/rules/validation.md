---
description: "FluentValidation rules and patterns"
paths:
  - "**/*Validator.cs"
  - "**/Validators/**/*.cs"
  - "**/Validation/**/*.cs"
---

# Validation Rules

## Strategy

| Approach | When to use |
|----------|-------------|
| FluentValidation | Complex rules, async checks, conditional logic |
| Data Annotations | Simple DTOs with basic constraints |
| Domain validation | Invariants inside entity factory/behavior methods (return `Result`) |

## FluentValidation Directives

- One validator per command/request
- Colocate validator with its command in the same folder
- Register all validators: `AddValidatorsFromAssemblyContaining<T>()`
- Run validators in a MediatR `ValidationBehavior` pipeline -- not manually in endpoints

## Async Validation

- Use `MustAsync()` for DB uniqueness checks (e.g., email exists)
- Always accept and propagate `CancellationToken`

## Conditional Validation

- Use `.When(condition)` for field-level conditions
- Use `When(condition, () => { ... })` with `Otherwise(() => { ... })` for grouped conditions

## Collection Validation

- Use `RuleForEach(x => x.Items).SetValidator(new ItemValidator())` for child validation
- Add collection-level rules separately (e.g., max total quantity)

## Custom Reusable Rules

- Create extension methods on `IRuleBuilder<T, TProperty>` for repeated patterns (e.g., `.PhoneNumber()`, `.Slug()`)
- Create `AsyncPropertyValidator<T, TProperty>` for reusable async checks (e.g., unique email)

## Error Messages

- Always provide explicit `.WithMessage()` for user-facing messages
- Keep messages user-friendly -- DO NOT expose internal details or exception messages

## Anti-patterns

- DO NOT put business logic or side effects in validators (e.g., reserving inventory) -- validators only validate
- DO NOT catch exceptions inside `.Must()` lambdas -- validate format before attempting operations
- DO NOT validate in both the endpoint AND the pipeline behavior -- pick one entry point
- DO NOT skip validation for queries -- validate pagination bounds and filter inputs
