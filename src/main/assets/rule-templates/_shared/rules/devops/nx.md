---
description: "Nx monorepo workspace rules"
paths:
  - "**/libs/**/*"
  - "**/apps/**/*"
  - "**/nx.json"
  - "**/project.json"
---

# Nx Monorepo Rules

## Project Structure

Prefer nested structure for new projects. Respect existing convention if the project already uses flat naming.

- Nested (recommended): `libs/[scope]/[type]/` (e.g., `libs/users/feature/`)
- Flat (legacy): `libs/[scope]/[type]-[name]` (e.g., `libs/users/feature-list`)

Both are official Nx conventions.

## Library Types

| Type | Purpose | Can Import |
|------|---------|------------|
| `feature` | Smart components, routing, pages | ui, data-access, util |
| `ui` | Presentational components | util only |
| `data-access` | State management, API calls | util only |
| `util` | Pure functions, types, constants | util only |

## Tags & Boundaries

- Tag every project: `scope:[domain]`, `type:[feature|ui|data-access|util]`
- Enforce boundaries with `@nx/enforce-module-boundaries` in ESLint
- `shared` scope can only depend on `shared`
- Domain scopes can depend on own scope + `shared`

## Import Paths

- Use workspace paths: `import { X } from '@myorg/users/data-access'`
- DO NOT use relative imports across libs: `'../../../users/data-access/src'`

## Apps = Orchestration Only

- Apps contain minimal bootstrap, routing, and wiring
- All application logic goes in libs
- DO NOT put business logic in `apps/`

## Commands

| Command | Usage |
|---------|-------|
| `nx affected -t test` | Test only what changed |
| `nx affected -t build` | Build only what changed |
| `nx affected -t lint` | Lint only what changed |
| `nx graph` | Visualize dependency graph |
| `nx reset` | Clear cache |

Always use `affected` in CI with `--base=main --head=HEAD`.

## Anti-patterns

- DO NOT import from `apps/` into `libs/`
- DO NOT create circular dependencies between libs
- DO NOT import `feature` into `ui` or `data-access`
- DO NOT import domain-specific libs into `shared/` scope
- DO NOT skip the public API (`index.ts`) — always export through barrel
- DO NOT put business logic in `apps/` — move it to a lib
