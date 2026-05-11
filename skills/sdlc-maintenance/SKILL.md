---
name: sdlc-maintenance
description: Issue-first maintenance workflow for dependency updates, security patches, CI fixes, build tooling, config cleanup, test reliability, developer experience, and repo hygiene.
---

# SDLC Maintenance Workflow

Use this skill for non-product work that keeps the system healthy without primarily adding or changing user-facing product behavior.

## Operating Model

- GitHub Issues are the canonical work queue. Create or identify the maintenance issue before implementation.
- Local docs support upgrade notes, rollback plans, migration notes, and durable tooling decisions.
- Use `.sdlc/project.yml` for configured commands, docs paths, and provider expectations.
- Use `sdlc blueprint`, `sdlc qa record`, `sdlc drift`, and `sdlc closeout` where they fit the issue.
- Ask before risky upgrades, broad churn, public behavior changes, or implementation when scope is unclear.

## Intake

Classify the maintenance work:

- Dependency or security update
- Framework or runtime upgrade
- CI, build, lint, typecheck, or formatter fix
- Test reliability or flaky test cleanup
- Dev environment or tooling improvement
- Config cleanup
- Repo hygiene
- Documentation or generated artifact upkeep

Capture:

- Current failure, drift, advisory, or maintenance goal
- Packages, tools, workflows, or config files affected
- Runtime behavior risk
- CI/deploy risk
- Rollback path
- Verification commands

## Issue First

Create or update a GitHub issue.

Minimum issue body:

```markdown
## Maintenance Goal
...

## Type
- Dependency/security update
- CI/build/tooling
- Config cleanup
- Test reliability
- Developer experience
- Repo hygiene

## Risk
- Runtime behavior:
- Build/CI:
- Deploy:
- Rollback:

## Acceptance Criteria
- [ ] Maintenance goal is complete.
- [ ] Relevant checks pass.
- [ ] Rollback/follow-up notes are recorded.

## Verification Plan
- [ ] ...
```

Respect repo label conventions if present. Otherwise suggest `maintenance` and `needs-triage`.

## Plan

Choose the smallest safe change:

- Keep dependency upgrades focused unless batching is safer.
- Separate mechanical formatting from behavior or runtime changes when practical.
- Use `sdlc blueprint <issue> --sync` for runtime, architecture, deployment, migration, or developer workflow risk.
- Record rollback notes for upgrades and CI/deploy changes.
- Add an ADR when the maintenance task changes a durable tooling or runtime policy.

## Implement

- Keep the diff scoped to the issue.
- Update lockfiles intentionally.
- Preserve existing behavior unless the issue explicitly changes it.
- Do not mix unrelated cleanup into the maintenance task.
- Update docs/templates/examples when the maintenance changes setup, command behavior, generated artifacts, or repo conventions.

## Verify And Close

Run the relevant checks:

- install or lockfile verification
- tests
- lint, format, or typecheck
- build
- CI workflow validation
- smoke test, QA, deploy, or canary when runtime behavior could be affected
- `sdlc drift` when mappings exist

Capture screenshots/videos only when the maintenance changes a visual or interactive surface. Record evidence with `sdlc qa record`.

Closeout should include:

```markdown
## Maintenance Complete
Changed: ...

## Verification
- `{command}` -> {result}

## Risk / Rollback
- ...

## Follow-Ups
- ...
```

If verification cannot prove safety, leave the issue open or blocked with the exact reason.
