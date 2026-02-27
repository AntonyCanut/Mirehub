---
description: "Git workflow, branching, and commit conventions"
paths:
  - "**/.github/**"
  - "**/COMMIT_EDITMSG"
  - "**/.husky/**"
  - "**/commitlint.config.*"
  - "**/release.config.*"
  - "**/CHANGELOG*"
---

# Git Rules

## Commit Messages (Conventional Commits)

Format: `type(scope): description` — lowercase, imperative mood, no period

**No `Co-Authored-By`** — do not add Co-Authored-By trailers to commits.

| Type | Usage |
|------|-------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code change, no feature/fix |
| `perf` | Performance improvement |
| `test` | Adding/updating tests |
| `chore` | Build, CI, dependencies |

- DO NOT write vague messages: "fix: bug fix", "updated stuff"
- DO NOT capitalize the description

## Branch Naming

Pattern: `type/description` or `type/TICKET-description`

Examples: `feat/user-authentication`, `fix/BUG-456-null-pointer`

## Workflow

- Always rebase local changes on remote: `git pull --rebase origin main`
- DO NOT merge main into feature branches — rebase instead
- Clean up commits with interactive rebase before PR
- Stage interactively: `git add -p`

## Pull Requests

- One feature/fix per PR — aim for < 400 lines changed
- Split large changes into stacked PRs
- PR title follows conventional commit format
- Ensure lint and tests pass before creating PR

## Anti-patterns

- DO NOT force push to shared branches
- DO NOT commit without running lint/tests locally
- DO NOT create merge commits from main into feature branches
