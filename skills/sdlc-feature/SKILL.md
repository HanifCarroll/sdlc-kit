---
name: sdlc-feature
description: Issue-first new feature workflow. Use when the user wants a new feature, workflow, integration, endpoint, capability, product surface, or user-facing experience and wants GitHub issues, local design docs when needed, gstack plan review, disciplined implementation, QA, review, ship, and deployment records.
---

# SDLC Feature Workflow

Use this skill for new capabilities. It keeps product definition, issue decomposition, implementation, and shipping records connected.

## Operating Model

- GitHub Issues are the canonical work queue.
- Local docs hold heavier reasoning: PRDs, design docs, ADRs, implementation plans, and review notes.
- Prefer existing skills:
  - Matt: `to-prd`, `to-issues`, `triage`, `tdd`
  - gstack: `gstack-office-hours`, `gstack-autoplan`, targeted `gstack-plan-*`, `gstack-qa`, `gstack-review`, `gstack-ship`, `gstack-land-and-deploy`, `gstack-canary`, `gstack-retro`
  - Cleanup: `/simplify` for reuse, quality, and efficiency cleanup on each nontrivial slice diff
  - Superpowers: `writing-plans`, `executing-plans`, `subagent-driven-development`, `test-driven-development`, `using-git-worktrees`, `verification-before-completion`
- Ask before entering heavy mode or implementation.

## Intake

Determine:

- What user problem this solves
- Who uses it
- What changes in the product
- UI/API/data/docs/DX scope
- Constraints and non-goals
- Acceptance criteria
- Whether the feature can ship in slices

If the feature is not well-defined, use `to-prd` for formal product definition or `gstack-office-hours` when the problem, wedge, or alternatives are unclear.

## Issue First

Every feature needs a parent GitHub issue or PRD-linked issue before implementation.

Minimum parent issue body:

```markdown
## Feature
{one-sentence summary}

## Problem
...

## Users
...

## Proposed Scope
- In:
- Out:

## Acceptance Criteria
- [ ] ...

## Linked Docs
- PRD/design/ADR:

## Implementation Slices
- [ ] ...

## Verification Plan
- [ ] Tests:
- [ ] QA:
- [ ] Review:
- [ ] Deploy/canary:
```

Respect `docs/agents/triage-labels.md` if present. Otherwise suggest `feature` or `enhancement` plus `needs-triage`.

## Define And Split

- Use `to-prd` if the feature needs product definition.
- Use `to-issues` to split a PRD or plan into independently shippable slices.
- Use `triage` to label, order, and mark slices ready.
- Link child issues from the parent issue and parent issue from each child.

Prefer vertical slices that can be tested and shipped independently.

## Review The Plan

Use `gstack-autoplan` as the default for nontrivial features.

Use targeted reviews when narrower:

- `gstack-plan-ceo-review` for product/scope uncertainty.
- `gstack-plan-design-review` for UI/UX.
- `gstack-plan-eng-review` for architecture, data flow, tests, performance.
- `gstack-plan-devex-review` for APIs, CLIs, docs, SDKs, or developer-facing surfaces.

Record plan/review links in the parent issue.

## Choose Implementation Mode

Per slice:

- Use Matt `tdd` for ordinary behavior implementation.
- Recommend Superpowers and ask when the feature is large, risky, has multiple workstreams, needs worktrees/subagents, or touches sensitive systems.
- Use `writing-plans` before code when implementation spans multiple tasks.
- Use `executing-plans` or `subagent-driven-development` only after the plan is approved.

Small-work fast path applies only to a single low-risk slice with an existing issue and clear acceptance criteria.

## Implement And Verify

For each slice:

- Keep patch scoped to the slice issue.
- Add tests for new behavior.
- Run relevant tests.
- Use `gstack-qa` for user-facing flows.
- Use `/simplify` before review when a slice adds enough code to benefit from a reuse/quality/efficiency pass.
- Use `gstack-review` before landing.

For the overall feature:

- Use `gstack-ship`.
- Use `gstack-land-and-deploy` and `gstack-canary` when deployed.
- Use `gstack-document-release` when docs/public behavior changed.
- Use `gstack-retro` for large or multi-day features.

## Close Records

Each child issue closure should include tests, QA/review, PR/deploy links, and remaining follow-ups.

Parent issue closure should include:

```markdown
## Feature Complete
Shipped slices:
- ...

## Verification
- [ ] Test suite:
- [ ] QA:
- [ ] Review:
- [ ] Deploy/canary:

## Docs
- ...

## Follow-ups
- ...
```
