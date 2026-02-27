---
description: "Result pattern for operation outcomes"
paths:
  - "**/src/Application/**/*.cs"
  - "**/src/Domain/**/*.cs"
---

# Result Pattern Rules

## Core Types

- `Result` for void operations (success/failure without value)
- `Result<T>` for operations returning a value on success
- `Error` as a `sealed record` with `Code` and `Description` properties

## Error Factory Methods

Define domain-specific error constants per aggregate:

```csharp
public static class UserErrors
{
    public static Error NotFound(Guid id) => Error.NotFound("User", id);
    public static Error EmailAlreadyExists(string email) => Error.Conflict("User", $"Email {email} already registered");
    public static readonly Error InvalidPassword = Error.Validation("Password", "Does not meet requirements");
}
```

## Usage Directives

- Return `Result<T>` from domain factory methods and entity behavior methods
- Return `Result<T>` from Application handlers -- map to `ProblemDetails` in the API layer
- Check `result.IsFailure` before accessing `result.Value`
- Use implicit conversion: `return user.Id;` auto-wraps in `Result<Guid>.Success()`

## API Response Mapping

- Create a `ResultExtensions.ToApiResult()` method that maps `Error.Code` patterns to HTTP status codes
- Map `NotFound` -> 404, `Validation` -> 400, `Conflict` -> 409, `Unauthorized` -> 401, `Forbidden` -> 403

## Match Pattern (Functional)

Use `Match` extension for functional-style handling:

```csharp
return result.Match(
    onSuccess: user => TypedResults.Ok(user),
    onFailure: error => TypedResults.Problem(error.Description)
);
```

## Implementation

Implement a custom Result<T> type in the Domain layer, or use a library like ErrorOr or FluentResults.

## Anti-patterns

- DO NOT throw exceptions for expected business failures (not found, validation) -- use Result instead
- DO NOT access `result.Value` without checking `IsSuccess` first -- it throws `InvalidOperationException`
- DO NOT mix exceptions and Result pattern in the same layer -- pick one approach per boundary
- DO NOT create deeply nested Result chains -- extract to early-return pattern with `if (result.IsFailure) return`
