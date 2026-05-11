---
name: sdlc-bug
description: Issue-first bug workflow for solo developers. Use when the user finds a bug, regression, crash, failing test, broken UI, production issue, flaky behavior, or system error and wants to keep a durable GitHub issue plus verification record while using gstack, Matt Pocock skills, and Superpowers when appropriate.
---

# SDLC Bug Workflow

Use this skill to turn a bug report into a tracked, diagnosed, tested, reviewed, and closed work item.

## Operating Model

- GitHub Issues are the canonical work queue. Create or identify the issue before implementation.
- Local docs are supporting evidence only. Use repo conventions first, then `docs/design/`, `docs/adr/`, or `docs/agents/` when heavier reasoning needs a durable home.
- Prefer existing skills instead of duplicating them:
  - Matt: `triage-issue`, `triage`, `tdd`
  - gstack: `gstack-investigate`, `gstack-plan-eng-review`, `gstack-qa`, `gstack-review`, `gstack-ship`, `gstack-land-and-deploy`, `gstack-canary`
  - Cleanup: `/simplify` for reuse, quality, and efficiency cleanup on the current diff when useful
  - Superpowers: `test-driven-development`, `writing-plans`, `using-git-worktrees`, `verification-before-completion`
- Ask before entering Superpowers heavy mode or starting implementation.

## Intake

Gather only what is missing:

- Repro steps
- Expected behavior
- Actual behavior
- User/business impact
- Environment, branch, version, browser/device, logs, screenshots, failing command, or failing test
- Whether this is a regression and what last worked

If the user gave enough to proceed, do not over-question. Continue.

## Issue First

Create or update a GitHub issue before touching code.

Use `triage-issue` when root cause is unknown or the bug needs investigation. Use `triage` when the issue already exists and only needs labels/state.

Minimum issue body:

```markdown
## Bug
{one-sentence summary}

## Repro
1. ...

## Expected
...

## Actual
...

## Impact
...

## Root Cause
Unknown until investigated.

## Acceptance Criteria
- [ ] Repro is covered by an automated regression test or documented verification.
- [ ] Bug is fixed.
- [ ] Relevant tests pass.
- [ ] QA/review/ship status is recorded.
```

Respect `docs/agents/triage-labels.md` if present. Otherwise suggest `bug` and `needs-triage`.

## Diagnose

If root cause is unclear, use `gstack-investigate` or perform its shape:

1. Reproduce or inspect the real failure.
2. Minimize to the smallest failing case.
3. Form hypotheses from evidence.
4. Instrument or inspect code to confirm.
5. Update the issue with the confirmed root cause.

Do not patch before you can explain why the bug happens.

## Choose Implementation Mode

Use Matt `tdd` by default for a regression test plus fix.

Recommend Superpowers `test-driven-development` and ask before entering it when any are true:

- Auth, payments, permissions, billing, privacy, data loss, production regression, or security-sensitive code
- Weak tests or repeated regressions in the touched area
- Broad fix touching multiple modules
- Need for worktree/subagent isolation

Run `gstack-plan-eng-review` before implementation when architecture, data flow, test coverage, or blast radius is unclear.

Small-work fast path is allowed only when:

- A GitHub issue exists.
- The fix is one focused low-risk patch.
- No product/design ambiguity remains.
- The user approves implementation.

## Implement

Implementation rules:

- Write or update the failing test before the fix when feasible.
- Keep the patch scoped to the issue.
- Do not silently expand scope. If you find adjacent work, add it to the issue or propose a follow-up issue.
- Use `/simplify` before review when the fix introduced duplication, complexity, repeated work, or reusable logic.
- Preserve user changes and unrelated work.

## Verify And Close

Run relevant tests, then:

- Use `gstack-qa` for user-facing/browser bugs.
- Use `/simplify` before review when the diff is nontrivial and likely to benefit from a reuse/quality/efficiency pass.
- Use `gstack-review` before landing.
- Use `gstack-ship` for ship flow when ready.
- Use `gstack-land-and-deploy` and `gstack-canary` for deployed production fixes.

Close or update the issue with:

```markdown
## Resolution
Root cause: ...
Fix: ...

## Verification
- [ ] Test: `{command}` -> {result}
- [ ] QA: {link/status or N/A}
- [ ] Review: {link/status or N/A}
- [ ] Deploy/canary: {status or N/A}

## Follow-ups
- ...
```

If verification cannot be run, state exactly why and leave the issue open or marked blocked.
