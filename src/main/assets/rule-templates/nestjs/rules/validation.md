---
description: "NestJS DTO validation with class-validator"
paths:
  - "**/src/**/*.dto.ts"
  - "**/src/**/dto/*.ts"
---

# NestJS Validation & DTOs

## DTO Rules

- Every DTO property MUST have at least one class-validator decorator — undecorated properties are silently stripped by `whitelist`
- DO use `@IsEmail()`, `@IsString()`, `@MinLength()`, `@IsUUID()`, `@IsEnum()`, `@IsInt()`, `@Min()`, `@Max()` etc.
- DO use `@IsOptional()` for optional fields — convention: place before other validators for readability
- DO use `@Type(() => Number)` from class-transformer for query params that need numeric conversion

## Mapped Types for Variants

| Helper | Purpose |
|--------|---------|
| `PartialType(Dto)` | All fields optional (for PATCH) |
| `PickType(Dto, ['a', 'b'])` | Only selected fields |
| `OmitType(Dto, ['password'])` | Exclude fields |
| `IntersectionType(A, B)` | Merge two DTOs |

- Import from `@nestjs/mapped-types` (plain) or `@nestjs/swagger` (if using Swagger — preserves API metadata)

## Nested Objects

- DO use `@ValidateNested({ each: true })` + `@Type(() => ChildDto)` for nested arrays/objects
- DO NOT forget `@Type()` — without it, class-transformer cannot instantiate the nested class

## Transform Directives

- DO use `@Transform(({ value }) => value?.toLowerCase().trim())` for normalizing string inputs
- DO use `@Transform(({ value }) => value === 'true' || value === true)` for boolean query params

## Validation Groups

- Use `groups: ['create']` / `groups: ['update']` on decorators for conditional validation
- Pass groups via `new ValidationPipe({ groups: ['create'] })` at method level

## Custom Validators

- DO use `@ValidatorConstraint({ async: true })` + `registerDecorator()` for DB-dependent validation (e.g., unique email)
- DO inject services into the constraint class via NestJS DI (register as provider)

## Response DTOs

- DO use separate response DTOs with `@Expose()` / `@Exclude()` from class-transformer
- DO use `ClassSerializerInterceptor` to auto-serialize response objects
- DO NOT return raw entities from controllers — always map to a response DTO

## Swagger Integration

- DO combine `@ApiProperty()` / `@ApiPropertyOptional()` with class-validator decorators on the same DTO
- This documents and validates in a single class — no duplication

## Anti-patterns

- DO NOT create DTOs without validation decorators — they provide no protection
- DO NOT validate in services what the DTO should enforce — keep validation at the boundary
- DO NOT use `any` as a DTO type — defeats the purpose of typed validation
