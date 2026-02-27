---
description: "Prisma ORM integration with NestJS"
paths:
  - "**/prisma/**/*.prisma"
  - "**/src/**/*.repository.ts"
  - "**/src/**/prisma*.ts"
---

# NestJS with Prisma

## Setup

- DO create a `@Global()` PrismaModule exporting `PrismaService`
- DO extend `PrismaClient` or wrap it via composition in `PrismaService` implementing `OnModuleInit` + `OnModuleDestroy`
- DO call `$connect()` in `onModuleInit` and `$disconnect()` in `onModuleDestroy`

## Naming Conventions

| Layer | Convention | Example |
|-------|-----------|---------|
| Model | PascalCase | `User`, `BlogPost` |
| Field | camelCase | `createdAt`, `authorId` |
| Table (DB) | snake_case via `@@map()` | `@@map("users")` |
| Column (DB) | snake_case via `@map()` | `@map("created_at")` |

## Repository Pattern

- DO wrap Prisma calls in injectable repository classes — never call `PrismaService` directly from services
- DO accept Prisma-generated types (`Prisma.UserWhereInput`) in repository method signatures for type safety
- DO use `findUnique` for single-record lookups, `findMany` for lists

## Query Directives

- DO use `select` to return only needed fields — especially exclude `password`
- DO use `include` with filters for eager-loaded relations (limit + where + orderBy)
- DO run paginated queries with `Promise.all([findMany, count])` for parallel execution
- DO use interactive transactions (`$transaction(async (tx) => {...})`) for multi-step writes
- DO NOT nest `include` more than 2 levels deep — flatten with separate queries

## Soft Delete

- Add `deletedAt DateTime?` column; intercept `delete` → `update` and inject `deletedAt: null` filter on reads via `$extends` (client extensions, Prisma 4.16+) — Prisma middleware is legacy and should not be used for new code

## Migrations

- `prisma migrate dev --name <name>` for development
- `prisma migrate deploy` for production — never run `migrate dev` in prod
- `prisma generate` after every schema change

## Testing

- DO mock `PrismaService` model methods (`findUnique`, `create`, etc.) with `vi.fn()`
- DO use a separate test database (`DATABASE_URL` in `.env.test`) for E2E tests
- DO NOT run E2E tests against the development database

## Alternatives

- Drizzle ORM is an emerging type-safe alternative — evaluate for new projects if Prisma's query engine overhead is a concern
