---
description: "Lucid ORM models and queries"
paths:
  - "**/app/models/**/*.ts"
  - "**/database/migrations/**/*.ts"
  - "**/database/seeders/**/*.ts"
  - "**/database/factories/**/*.ts"
---

# Lucid ORM

## Model Conventions

- Extend `BaseModel`, use `declare` for all column properties
- Use `@column({ isPrimary: true })` for primary keys
- Use `@column({ serializeAs: null })` to hide sensitive fields (passwords, tokens)
- Use `@column.dateTime({ autoCreate: true })` for `createdAt`, add `autoUpdate: true` for `updatedAt`

## Relationships

| Decorator | Type | Typed as |
|-----------|------|----------|
| `@hasOne(() => Profile)` | One-to-one | `HasOne<typeof Profile>` |
| `@hasMany(() => Post)` | One-to-many | `HasMany<typeof Post>` |
| `@belongsTo(() => User)` | Inverse | `BelongsTo<typeof User>` |
| `@manyToMany(() => Tag)` | Many-to-many | `ManyToMany<typeof Tag>` |

## Eager Loading (Critical)

- ALWAYS use `.preload('relation')` to eager load relationships
- NEVER access relationships without preloading -- Lucid does not auto-load (no lazy loading by default)
- Use nested preloads: `.preload('posts', (q) => q.preload('comments'))`
- For conditional loading: `.preload('posts', (q) => q.where('isPublished', true))`

## Queries

- Use `Model.findOrFail(id)` instead of `find()` + null check -- throws 404 automatically
- Use `Model.findBy(key, value)` for lookups by non-primary key
- Chain `.where()`, `.orderBy()`, `.limit()` on `Model.query()`

## Model Hooks

- `@beforeSave` for automatic transformations (e.g., password hashing via `$dirty` check)
- `@beforeDelete` / `@afterDelete` for cleanup side effects
- Keep hooks simple -- complex logic belongs in services

## Transactions

- Wrap multi-model writes in `db.transaction(async (trx) => {...})`
- Pass `{ client: trx }` as options to all `create`/`save` calls inside transaction

## Migrations

- One structural change per migration file
- Always implement both `up()` and `down()` methods
- Use `.references('other_table.id')` for foreign keys with `.onDelete('CASCADE')`

## Anti-patterns

- Do NOT access relationships without `.preload()` -- causes runtime errors or empty data
- Do NOT use raw SQL unless Lucid query builder cannot express the query
- Do NOT skip `down()` in migrations -- makes rollbacks impossible
- Do NOT put query logic in controllers -- use model scopes or service methods
