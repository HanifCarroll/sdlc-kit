---
name: sdlc-refactor
description: Issue-first refactor workflow for broad or focused code improvements. Use when the user wants to improve structure, reduce duplication, simplify code, improve testability, change module boundaries, or pay down architecture debt with durable safety evidence.
---

# SDLC Refactor Workflow

Use this skill for refactors where behavior should usually remain unchanged unless explicitly stated.

## Operating Model

- GitHub Issues are the canonical work queue.
- Local docs hold heavier reasoning: ADRs, architecture notes, refactor plans, and implementation logs.
- Behavior preservation is the main contract. Tests, evals, QA, or characterization evidence must prove it.
- Use `sdlc blueprint`, `sdlc worktree`, `sdlc qa record`, `sdlc drift`, and `sdlc closeout` where they fit the issue.
- Ask before broad refactors, behavior changes, or implementation when scope is unclear.

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
- Existing tests/evals
- Acceptance criteria
- Docs or ADRs that describe the current boundary

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

Respect repo label conventions if present. Otherwise suggest `refactor` and `needs-triage`.

## Plan

For focused refactors:

- Identify the exact smell or boundary to improve.
- Add characterization or regression tests before moving code when existing proof is weak.
- Record the planned change and verification commands in the issue or blueprint.

For broad refactors:

- Inspect the affected code paths and rank the refactor candidates.
- Split accepted candidates into issue-sized slices.
- Run `sdlc blueprint <issue> --sync` for each nontrivial slice.
- Write or update ADRs when changing architecture boundaries.

Record plan and ADR links in the issue.

## Implement

- Make small logical changes.
- Keep structural changes separate from behavior changes when possible.
- Do not mix unrelated cleanup into the refactor.
- Update diagrams, comments, docs, or capability notes near changed architecture if they exist.
- If the refactor reveals behavior changes are needed, stop and update the issue before proceeding.

## Verify And Close

Verification must prove either behavior unchanged or explicitly changed by the issue.

Run:

- characterization/regression tests
- relevant full suite
- build/typecheck/lint commands configured in the repo
- QA when user-facing behavior could be affected
- `sdlc drift` when mappings exist

Capture screenshots/videos when a visual or interactive surface could have regressed. Record evidence with `sdlc qa record`.

Closeout should include:

```markdown
## Refactor Complete
Changed structure: ...
Behavior: unchanged / changed as documented

## Verification
- Characterization/regression tests:
- Full relevant suite:
- Review:
- QA:

## Follow-ups
- ...
```

If tests are insufficient to prove safety, do not claim completion. Mark the issue blocked or leave follow-up test work.
