---
description: "TypeORM integration with NestJS"
paths:
  - "**/src/**/*.entity.ts"
  - "**/src/**/*.repository.ts"
  - "**/src/**/typeorm*.ts"
---

# NestJS with TypeORM

## Setup

- DO use `TypeOrmModule.forRootAsync()` with `ConfigService` injection — never hardcode DB credentials
- DO set `synchronize: false` in production — always use migrations
- DO auto-discover entities via `autoLoadEntities: true` (preferred) or glob fallback `entities: [__dirname + '/**/*.entity{.ts,.js}']`

## Naming Conventions

| Layer | Convention | Example |
|-------|-----------|---------|
| Entity class | PascalCase | `User`, `BlogPost` |
| Property | camelCase | `createdAt`, `authorId` |
| Table (DB) | snake_case via `@Entity('users')` | `users` |
| Column (DB) | snake_case via `{ name: 'created_at' }` | `created_at` |

## Entity Directives

- DO use `@PrimaryGeneratedColumn('uuid')` — prefer UUIDs over auto-increment
- DO use `@CreateDateColumn` / `@UpdateDateColumn` for timestamps
- DO add `@Index()` on columns used in WHERE / JOIN clauses
- DO specify `onDelete: 'CASCADE'` or `'SET NULL'` explicitly on relations
- DO use `@DeleteDateColumn` for soft delete — enables `softDelete()` / `restore()` / `withDeleted`

## Repository Pattern

- DO create custom repository classes wrapping `@InjectRepository(Entity)` — never call `Repository<T>` directly from services
- DO register entities per module: `TypeOrmModule.forFeature([User])`
- DO use `repository.create(data)` then `repository.save(entity)` — not `save(plainObject)` — to trigger lifecycle hooks

## Query Directives

- DO use `findAndCount()` for paginated queries
- DO use QueryBuilder for dynamic filters (`andWhere` + parameterized queries)
- DO always use parameterized queries (`:param`) — never interpolate user input into SQL
- DO use `DataSource.transaction(async (manager) => {...})` for multi-entity transactions

## Migrations

- `typeorm migration:generate -d src/data-source.ts` — auto-generates from entity diff
- `typeorm migration:run -d src/data-source.ts` — applies pending migrations
- DO NOT use `synchronize: true` in production — schema diffs can cause data loss

## Testing

- DO mock repository with `{ provide: getRepositoryToken(Entity), useValue: mockRepo }`
- DO mock QueryBuilder chains when testing dynamic filter methods

## Anti-patterns

- DO NOT use `repository.save(plainObject)` without `create()` — bypasses entity hooks and defaults
- DO NOT use eager loading (`eager: true` on relations) globally — prefer explicit `relations` per query
