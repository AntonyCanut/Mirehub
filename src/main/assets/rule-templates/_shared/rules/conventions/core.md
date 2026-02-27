---
description: "Shared coding conventions across all technologies"
alwaysApply: true
---

# Shared Conventions

## Naming

- Use explicit names: no `c`, `x`, `tmp`, `data` — name reveals intent
- Use named constants for magic numbers
- Small functions: < 30 lines, single responsibility
- Max nesting: 3 levels — use early returns to flatten

## Code Hygiene

- DO NOT disable lint rules without a justification and ticket reference
- DO NOT leave dead code — delete it, do not comment it out
- DO NOT swallow errors silently — log with context (user ID, request ID), then rethrow or handle

## Error Handling

- User-facing errors: clear, actionable messages
- Internal errors: detailed logs, generic user message
- Never expose stack traces to end users

## Dependencies

- Pin exact versions in lock files
- Audit regularly
- Prefer well-maintained packages — minimize dependency count

