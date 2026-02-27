---
description: "Flask CLI command patterns"
paths:
  - "**/*.py"
---

# Flask CLI Commands

## Registration

- Simple commands: `@app.cli.command("name")` in factory or dedicated module
- Related commands: `@app.cli.group()` to create subcommand groups (e.g., `flask user create`)
- Blueprint commands: set `cli_group` on blueprint, define with `@bp.cli.command()`

## Conventions

- Use `@with_appcontext` only when registering commands via raw `click.command()` — Flask's `@app.cli.command()` pushes app context automatically
- Use `click.argument()` for required positional args, `click.option()` for optional/flags
- Use `click.echo()` for output, `click.secho(msg, fg="green")` for status indicators
- Return exit code 0 on success — use `click.echo(msg, err=True)` for errors

## Command Groups

Group related commands under a namespace:

```python
@app.cli.group()
def user():
    """User management commands."""
    pass

@user.command("create")
@click.argument("email")
def user_create(email):
    ...
```

Invoked as `flask user create admin@example.com`.

## Common Command Types

| Command | Purpose | Example |
|---|---|---|
| `init-db` | Initialize database schema | `db.create_all()` |
| `seed` | Populate with sample data | Import and run seed functions |
| `create-user` | Create admin/system users | Accept email, name, `--admin` flag |
| `check` | Health check (DB, Redis, APIs) | Verify connectivity, report status |

## Testing CLI Commands

Use `runner = app.test_cli_runner()` fixture. Assert with `result.exit_code` and `result.output`.

## Anti-Patterns

- Missing app context when using raw `click.command()` — add `@with_appcontext` (not needed for `@app.cli.command()`)
- Using `print()` instead of `click.echo()` — breaks testability and piping
- Long-running tasks without progress feedback — use `click.progressbar()` for bulk operations
- `flask run` scripts in `manage.py` — Flask 3.0+ has built-in `flask run`, use CLI commands instead
