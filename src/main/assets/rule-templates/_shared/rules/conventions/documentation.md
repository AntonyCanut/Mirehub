---
description: "Documentation standards and API doc conventions"
paths:
  - "**/README.md"
  - "**/CHANGELOG.md"
  - "**/docs/**"
  - "**/ADR/**"
---

# Documentation Standards

## When to Comment

- Comment WHY, never WHAT — if the code needs a WHAT comment, refactor instead
- Use `TODO(#ticket)` with a ticket reference — orphan TODOs are not allowed
- Document non-obvious behavior, workarounds, and edge cases
- Use `FIXME`, `HACK`, `WARN`, `DEPRECATED` prefixes when relevant

## When to Write Docs

| Document | Write when... |
|----------|---------------|
| README | Project exists — must have Quick Start, Prerequisites, Config table |
| ADR | Making a significant architectural decision |
| CHANGELOG | Every release — follow Keep a Changelog format |
| API docs | Public API exists — use OpenAPI/Swagger, keep in sync |
| Runbook | Operating a production service |

## README Must-Haves

- Brief description (1-2 sentences)
- Quick Start (clone, install, run)
- Prerequisites with versions
- Configuration table (variable, description, default)
- Available scripts (`dev`, `test`, `lint`, `build`)

## ADR Format

- Title, Status (Accepted/Deprecated/Superseded), Date
- Context (what problem), Decision (what change), Consequences (tradeoffs)
- Name files: `docs/adr/001-short-description.md`

## Inline Documentation

- Use JSDoc/docstrings for public APIs: params, return, throws
- DO NOT document private internals unless behavior is non-obvious
- Keep examples minimal — one usage per function is enough

## Anti-patterns

- DO NOT write docs that duplicate what the code already says
- DO NOT leave READMEs outdated — outdated docs are worse than none
- DO NOT skip documenting environment variables
- DO NOT create ADRs without listing alternatives considered
