---
description: "Angular 21+ project conventions and architecture"
alwaysApply: true
---

# Angular Project Guidelines

## Stack

- Angular 19+ (standalone implicit, Signals, OnPush)
- Nx monorepo with enforced boundaries
- Vitest (unit) + Playwright (E2E)
- TypeScript strict mode
- Zoneless change detection (default in v21; use `provideZonelessChangeDetection()` only when migrating pre-v21 apps)

## Commands

```bash
nx g @nx/angular:component [name] --project=[lib]
nx g @nx/angular:library [name] --directory=libs/[domain]
nx e2e [app]-e2e                  # E2E (Playwright)
```

## Code Style

- DO use folder-based structure: `user-list/user-list.component.ts`
- DO add explicit return types on public methods
- DO mark injected services as `private readonly`
- DO add `track` on every `@for` loop — Angular enforces it
- DO use `inject()` function — never constructor injection
- DO NOT add `standalone: true` — it is the default since Angular 19
- DO NOT reference NgModules — they are legacy
- Signal-based APIs (`input()`, `output()`, `viewChild()`) — see components rules
- Prefix is configurable per project (default: `app`)
