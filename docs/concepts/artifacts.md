# Artifact Model

`sdlc-kit` separates planning artifacts by job.

| Artifact | Role | Default Storage |
| --- | --- | --- |
| GitHub issue | Executable work item and audit trail | GitHub |
| Blueprint | Issue-level execution plan | `.sdlc/blueprints/`, synced to issue comments |
| Historical plan | Larger architecture, migration, or release reasoning | `docs/plans/` |
| ADR | Durable decision after a choice becomes policy | `docs/adr/` |
| Current state | What the system currently does | `docs/current-state.md` |
| Capability doc | Detailed current behavior and proof for one domain | `docs/capabilities/` |
| Tests/evals | Executable proof | Repo test/eval suite |

Plans may become stale because they are historical. Current-state and capability docs must not become stale.
