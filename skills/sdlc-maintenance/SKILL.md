---
name: sdlc-maintenance
description: Issue-first maintenance workflow for dependency updates, security patches, CI fixes, build tooling, config cleanup, test reliability, developer experience, and repo hygiene.
---

# SDLC Maintenance Workflow

Use this skill for non-product work that keeps the system healthy without primarily adding or changing user-facing product behavior.

## Operating Model

- GitHub Issues are the canonical work queue. Create or identify the maintenance issue before implementation.
- Local docs support upgrade notes, rollback plans, migration notes, and durable tooling decisions.
- Prefer existing skills:
  - Matt Pocock style: `triage`, `tdd`, `request-refactor-plan`
  - gstack: `gstack-plan-devex-review`, `gstack-plan-eng-review`, `gstack-qa`, `gstack-review`, `gstack-ship`, `gstack-canary`
  - Cleanup: `/simplify` for config/tooling reuse, quality, and efficiency cleanup on nontrivial maintenance diffs
  - Superpowers: use for broad upgrades, risky migrations, weak-test areas, or multi-workstream maintenance
- Ask before risky upgrades, broad churn, externally visible changes, or heavy mode.

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

Respect `docs/agents/triage-labels.md` if present. Otherwise suggest `maintenance` and `needs-triage`.

## Plan

Choose the smallest safe change:

- Keep dependency upgrades focused unless batching is safer.
- Separate mechanical formatting from behavior or runtime changes when practical.
- Use `gstack-plan-devex-review` for tooling, CLI, docs, setup, and developer workflow changes.
- Use `gstack-plan-eng-review` for runtime, architecture, deployment, or migration risk.
- Use Superpowers only when the maintenance spans multiple risky workstreams.

## Implement

- Keep the diff scoped to the issue.
- Update lockfiles intentionally.
- Preserve existing behavior unless the issue explicitly changes it.
- Do not mix unrelated cleanup into the maintenance task.
- Use `/simplify` when config, scripts, or helper logic become duplicated or harder to maintain.

## Verify And Close

Run the relevant checks:

- install or lockfile verification
- tests
- lint, format, or typecheck
- build
- CI workflow validation
- smoke test, QA, deploy, or canary when runtime behavior could be affected

Close or update the issue with:

```markdown
## Maintenance Complete
Changed: ...

## Verification
- [ ] `{command}` -> {result}

## Risk / Rollback
- ...

## Follow-Ups
- ...
```

If verification cannot prove safety, leave the issue open or blocked with the exact reason.

