---
applyTo: "**/*.ts,**/*.tsx"
---

# Code Conventions

## Naming

- Use explicit names: no `c`, `x`, `tmp`, `data` — name reveals intent
- Named constants for magic numbers
- Small functions: < 30 lines, single responsibility
- Max nesting: 3 levels — use early returns to flatten

## File Naming

- Files: `kebab-case.ts`
- IPC handlers: `[namespace].ts` in `src/main/ipc/`
- Components: PascalCase for component name, file can be kebab-case or PascalCase

## Git

- Conventional Commits in French: `type(scope): description`
- No Co-Authored-By trailers
- Types: feat, fix, docs, style, refactor, perf, test, chore

## Code Hygiene

- No disabled lint rules without justification and ticket reference
- No dead code — delete it, do not comment it out
- No silently swallowed errors — log with context, then rethrow or handle
- No `any` without documented justification

## Dependencies

- Pin exact versions (no `^` or `~`)
- Use `npm ci` in CI, never `npm install`

## Styling

- CSS custom properties (no Tailwind, no CSS modules)
- Style files in `src/renderer/styles/`

## Principles

- YAGNI: implement only what is needed now
- KISS: simplest solution that works
- DRY: extract shared code only when contexts are truly identical (Rule of Three)
