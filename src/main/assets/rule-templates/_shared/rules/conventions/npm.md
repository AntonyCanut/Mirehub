---
description: "NPM/Yarn package management conventions"
paths:
  - "**/package.json"
---

# npm Conventions

## Version Pinning

- Use exact versions — no `^` or `~` prefixes
- Set `save-exact=true` in `.npmrc` to enforce this by default
- WHY: prevents surprise breaking changes, lock file is source of truth but pinning adds defense in depth

## Scripts

Use consistent script names across all projects:

| Script | Purpose |
|--------|---------|
| `dev` | Start dev server |
| `build` | Production build |
| `start` | Start production server |
| `test` | Run tests |
| `test:watch` | Run tests in watch mode |
| `test:cov` | Run tests with coverage |
| `lint` | Run linter |
| `lint:fix` | Auto-fix lint issues |
| `format` | Run formatter |

## Engine Requirements

- Specify `engines.node` in package.json to enforce minimum Node.js version
- Use `.nvmrc` or `.node-version` for team consistency

## Anti-patterns

- DO NOT use `^` or `~` version ranges — pin exact versions
- DO NOT skip the lock file in CI — always use `npm ci`, never `npm install`
- DO NOT add dependencies without verifying they are actively maintained
