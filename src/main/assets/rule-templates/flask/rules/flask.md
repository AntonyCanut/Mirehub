---
description: "Flask-SQLAlchemy 2.0 query patterns"
paths:
  - "**/*.py"
---

# Flask-SQLAlchemy Query Patterns

## SQLAlchemy 2.0 Query Style (Mandatory)

Use `db.session.execute(select(...))` for all queries. The legacy query API is banned.

| Banned (Legacy) | Required (2.0 Style) |
|---|---|
| `Model.query.all()` | `db.session.execute(select(Model)).scalars().all()` |
| `Model.query.filter_by(x=1)` | `db.session.execute(select(Model).where(Model.x == 1)).scalars()` |
| `Model.query.get(id)` | `db.session.get(Model, id)` |
| `Model.query.first()` | `db.session.execute(select(Model)).scalar_one_or_none()` |

**WHY:** Legacy `Model.query` is deprecated in SQLAlchemy 2.0 and will be removed.

