---
name: sdlc-enhancement
description: Issue-first enhancement workflow for existing features. Use when the user wants to improve, adjust, polish, extend, or change behavior in an existing feature while preserving a GitHub issue record, local reasoning docs when useful, and gstack/Matt/Superpowers quality gates.
---

# SDLC Enhancement Workflow

Use this skill when the work improves an existing feature rather than creating a new product surface.

## Operating Model

- GitHub Issues are the canonical work queue. Create or identify the issue before implementation.
- Local docs support heavier reasoning, but they are not the work queue.
- Prefer existing skills:
  - Matt: `triage`, `tdd`
  - gstack: `gstack-office-hours`, `gstack-autoplan`, `gstack-plan-design-review`, `gstack-plan-eng-review`, `gstack-qa`, `gstack-review`, `gstack-ship`, `gstack-document-release`
  - Cleanup: `/simplify` for reuse, quality, and efficiency cleanup on the current diff when useful
  - Superpowers: `test-driven-development`, `writing-plans`, `executing-plans`, `using-git-worktrees`
- Ask before entering Superpowers heavy mode or implementing.

## Intake

Capture:

- Current behavior
- Desired behavior
- Why it matters
- Users affected
- Constraints and non-goals
- Acceptance criteria
- Whether UI, API, data model, docs, or developer experience changes are involved

If the request is fuzzy or has multiple valid product directions, use `gstack-office-hours` before writing the implementation plan.

## Issue First

Create or update a GitHub issue.

Minimum issue body:

```markdown
## Enhancement
{one-sentence summary}

## Current Behavior
...

## Desired Behavior
...

## Why
...

## Scope
- In:
- Out:

## Acceptance Criteria
- [ ] ...

## Verification Plan
- [ ] Tests:
- [ ] QA:
- [ ] Review:
```

Respect `docs/agents/triage-labels.md` if present. Otherwise suggest `enhancement` and `needs-triage`.

## Plan And Review

Choose the lightest useful planning path:

- Use `gstack-plan-design-review` for meaningful UI/UX changes.
- Use `gstack-plan-eng-review` for behavior, architecture, data flow, or test strategy.
- Use `gstack-autoplan` when product, design, engineering, or DX uncertainty spans multiple dimensions.
- Skip gstack planning only when the enhancement is one focused low-risk patch with clear acceptance criteria.

Record any local design doc, ADR, or plan link in the issue.

## Choose Implementation Mode

Use Matt `tdd` by default for behavior changes.

Recommend Superpowers and ask when:

- The enhancement touches multiple independent workstreams.
- The area has weak tests or prior regressions.
- The change affects auth, payments, permissions, billing, privacy, data loss, or production-critical behavior.
- A formal plan, worktree, or subagent split would materially reduce risk.

Small-work fast path is allowed only when the GitHub issue exists, the patch is low risk, and the user approves.

## Implement

- Keep changes scoped to the issue.
- Update or add tests for changed behavior.
- Do not silently convert an enhancement into a new feature. If scope grows, update the issue and ask.
- Use `/simplify` before review when the enhancement adds duplicated logic, new abstractions, repeated work, or avoidable complexity.
- Preserve existing behavior unless the issue explicitly changes it.

## Verify And Close

- Run relevant tests.
- Use `gstack-qa` when user-facing behavior changes.
- Use `/simplify` before review when the diff is nontrivial and likely to benefit from a reuse/quality/efficiency pass.
- Use `gstack-review` before landing.
- Use `gstack-ship`, then deploy/canary when appropriate.
- Use `gstack-document-release` when docs, public behavior, or developer-facing behavior changes.
- For multi-PR runs in the same repo, check whether CI mutates shared remote fixtures such as seeded auth users. If it does, land or rerun PR checks sequentially before treating authenticated E2E failures as product regressions.

Close or update the issue with:

```markdown
## Resolution
Before: ...
After: ...

## Verification
- [ ] Test: `{command}` -> {result}
- [ ] QA: {link/status or N/A}
- [ ] Review: {link/status or N/A}
- [ ] Deploy/canary: {status or N/A}

## Docs
- {docs updated or N/A}
```
