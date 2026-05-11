---
name: sdlc-refactor
description: Issue-first refactor workflow for broad or focused code improvements. Use when the user wants to improve structure, reduce duplication, simplify code, improve testability, change module boundaries, pay down architecture debt, or plan a safe refactor with GitHub issues, local docs, tests, gstack review, and Superpowers escalation when needed.
---

# SDLC Refactor Workflow

Use this skill for refactors where behavior should usually remain unchanged unless explicitly stated.

## Operating Model

- GitHub Issues are the canonical work queue.
- Local docs hold heavier reasoning: ADRs, architecture notes, refactor plans, and implementation logs.
- Prefer existing skills:
  - Matt: `request-refactor-plan`, `improve-codebase-architecture`, `to-issues`, `tdd`
  - gstack: `gstack-plan-eng-review`, `gstack-autoplan`, `gstack-review`, `gstack-qa`, `gstack-ship`
  - Cleanup: `/simplify` as the default reuse, quality, and efficiency pass on nontrivial refactor diffs
  - Superpowers: `writing-plans`, `executing-plans`, `test-driven-development`, `using-git-worktrees`, `subagent-driven-development`
- Ask before broad refactors, heavy mode, or implementation.

## Intake

Classify the refactor:

- Focused: one module, one smell, clear target, low behavior risk.
- Broad: boundaries, architecture, repeated patterns, testability, many modules, or unclear target.

Capture:

- Current pain
- Desired structure
- Behavior that must remain unchanged
- Files/modules likely affected
- Risk areas
- Existing tests
- Acceptance criteria

## Issue First

Create or update a GitHub issue before implementation.

Minimum issue body:

```markdown
## Refactor
{one-sentence summary}

## Problem
...

## Desired Outcome
...

## Behavior Contract
- Behavior should remain unchanged except:

## Scope
- In:
- Out:

## Safety Plan
- [ ] Characterization/regression tests:
- [ ] Review:
- [ ] QA if user-facing risk:

## Acceptance Criteria
- [ ] Structure improved.
- [ ] Relevant tests pass.
- [ ] Behavior unchanged evidence recorded.
```

Respect `docs/agents/triage-labels.md` if present. Otherwise suggest `refactor` and `needs-triage`.

## Plan

For focused refactors:

- Use `request-refactor-plan` when the sequence is not obvious.
- Use Matt `tdd` to add characterization or regression tests before moving code.
- Use `/simplify` when the current diff may contain avoidable duplication, unnecessary abstraction, or inefficient work.
- Use `gstack-plan-eng-review` when risk or coupling is nontrivial.

For broad refactors:

- Use `improve-codebase-architecture` to find and rank candidates.
- Convert accepted candidates to issues with `to-issues`.
- Use `gstack-autoplan` or `gstack-plan-eng-review` on the chosen plan.
- Write or update ADRs when changing architecture boundaries.

Record plan/ADR links in the issue.

## Choose Implementation Mode

Use the light path for a focused low-risk refactor with tests.

Recommend Superpowers and ask when:

- Multiple modules or workstreams are involved.
- Behavior preservation is critical.
- The area has weak tests.
- The refactor touches architecture boundaries.
- Worktrees/subagents would reduce risk.

Use Superpowers `writing-plans` before code for broad refactors. Use `test-driven-development` or Matt `tdd` to protect behavior before edits.

## Implement

- Make small commits or logical units.
- Keep structural changes separate from behavior changes when possible.
- Do not mix unrelated cleanup into the refactor.
- Use `/simplify` on the latest diff before final review unless the change is trivial.
- Update diagrams/comments near changed architecture if they exist.
- If the refactor reveals behavior changes are needed, stop and update the issue.

## Verify And Close

Verification must prove either behavior unchanged or explicitly changed by the issue.

Run:

- Characterization/regression tests.
- Relevant full suite.
- `gstack-review`.
- `gstack-qa` if user-facing behavior could be affected.
- `gstack-ship` when ready.

Close or update the issue with:

```markdown
## Refactor Complete
Changed structure: ...
Behavior: unchanged / changed as documented

## Verification
- [ ] Characterization/regression tests:
- [ ] Full relevant suite:
- [ ] Review:
- [ ] QA:

## Follow-ups
- ...
```

If tests are insufficient to prove safety, do not claim completion. Mark the issue blocked or leave follow-up test work.
