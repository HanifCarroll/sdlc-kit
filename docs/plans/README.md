# Plans

Historical plans preserve larger architecture, migration, or release reasoning. Plans may become stale because they record thinking at a point in time.

Every committed plan except `README.md` and underscore-prefixed templates must start with YAML frontmatter:

```yaml
---
status: draft
created: "2026-05-10"
---
```

Allowed statuses: `draft`, `active`, `approved`, `superseded`, `archived`.

Use issue blueprints in `.sdlc/blueprints/` for tactical per-issue execution. Use ADRs for durable decisions, current-state docs for what the system does now, and capability docs for domain-level behavior and proof.
