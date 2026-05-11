---
name: sdlc-feature
description: Issue-first new feature workflow. Use when the user wants a new capability, workflow, integration, endpoint, product surface, or user-facing experience with durable issues, plans, implementation, QA, review, and closeout records.
---

# SDLC Feature Workflow

Use this skill for new capabilities. It keeps product definition, issue decomposition, implementation, verification, and shipping records connected.

## Operating Model

- GitHub Issues are the canonical work queue.
- Local docs hold heavier reasoning: PRDs, design docs, ADRs, historical plans, and capability updates.
- Use `.sdlc/project.yml` for configured commands and provider expectations.
- Use `sdlc blueprint`, `sdlc worktree`, `sdlc qa record`, `sdlc drift`, and `sdlc closeout` where they fit the issue.
- Ask before implementation when the feature is still ambiguous, risky, or only being discussed.

## Intake

Determine:

- What user problem this solves
- Who uses it
- What changes in the product, API, data model, docs, or developer experience
- Constraints and non-goals
- Acceptance criteria
- Whether the feature can ship in independent slices
- Which capability docs, tests, evals, previews, or production checks may be affected

If the feature is not well-defined, stop at definition work and produce an issue-ready brief before implementation.

## Issue First

Every feature needs a parent GitHub issue or a linked set of slice issues before implementation.

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
- PRD/design/ADR/capability docs:

## Implementation Slices
- [ ] ...

## Verification Plan
- [ ] Tests:
- [ ] QA:
- [ ] Review:
- [ ] Preview/production:
```

Respect repo label conventions if present. Otherwise suggest `feature` or `enhancement` plus `needs-triage`.

## Define And Split

For unclear or large features:

- Write the smallest product brief needed to define the problem, users, scope, non-goals, and acceptance criteria.
- Split the work into vertical slices that can be tested and shipped independently.
- Link child issues from the parent issue and the parent issue from each child.
- Put durable reasoning in `docs/plans/` when it should remain reviewable beyond a single issue.
- Add an ADR when the feature changes a durable architecture or product policy.

## Plan The Work

Use `sdlc blueprint <issue> --sync` for each nontrivial slice.

The blueprint should cover:

- files and capabilities expected to change
- user-visible behavior
- data, migration, deployment, or rollback concerns
- tests/evals to add or update
- docs to update
- QA target: local, preview, production, or not applicable
- screenshots/videos expected for evidence

## Implement And Verify

For each slice:

- Work in a branch or issue worktree when the repo supports it.
- Keep the patch scoped to the slice issue.
- Add or update tests/evals for new behavior.
- Update current-state, capability, user, or developer docs when behavior changes.
- Run the configured checks.
- Verify user-facing flows through local or preview QA.
- Capture screenshots/videos when the changed surface is visual or interactive.
- Record evidence with `sdlc qa record`.
- Run `sdlc drift` before closeout when mappings exist.

## Close Records

Each child issue closure should include tests, QA evidence, review status, PR/deploy links, docs impact, and remaining follow-ups.

Parent issue closure should include:

```markdown
## Feature Complete
Shipped slices:
- ...

## Verification
- Test suite:
- QA:
- Review:
- Preview/production:

## Docs
- ...

## Follow-ups
- ...
```
