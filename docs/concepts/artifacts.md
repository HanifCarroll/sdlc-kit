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

## Boundaries

Blueprints are local working plans for a single issue. They can change quickly while an agent or engineer is doing the work, so generated blueprint files live under `.sdlc/blueprints/` and are ignored by default. The durable audit trail is the synced issue comment.

Historical plans are committed under `docs/plans/` when the reasoning is bigger than one issue or should remain reviewable later. They require YAML frontmatter with `status` and `created` so `sdlc doctor` can catch stale or malformed plan docs.

ADRs are for decisions that became policy. Current-state and capability docs describe the live system and should be updated when behavior changes. Tests and evals are the executable proof that those docs are still true.
