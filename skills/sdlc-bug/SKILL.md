---
name: sdlc-bug
description: Issue-first bug workflow. Use when the user reports a bug, regression, crash, failing test, broken UI, production issue, flaky behavior, or system error and needs a durable issue, diagnosis, fix, and verification record.
---

# SDLC Bug Workflow

Use this skill to turn a bug report into a tracked, diagnosed, tested, reviewed, and closed work item.

## Operating Model

- GitHub Issues are the canonical work queue. Create or identify the issue before implementation.
- Use repo-local contracts first: `.sdlc/project.yml`, `docs/current-state.md`, capability docs, tests/evals, and configured commands.
- Use `sdlc blueprint` for nontrivial fixes, `sdlc qa record` for evidence, `sdlc drift` for docs impact, and `sdlc closeout` when the issue is ready to close.
- Do not patch before you can explain why the bug happens.
- Ask before implementation when the user asked only for investigation, the fix is risky, or the issue scope is unclear.

## Intake

Gather only what is missing:

- Repro steps
- Expected behavior
- Actual behavior
- User or business impact
- Environment, branch, version, browser/device, logs, screenshots, failing command, or failing test
- Whether this is a regression and what last worked

If the user gave enough to proceed, continue without over-questioning.

## Issue First

Create or update a GitHub issue before touching code.

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
- [ ] QA, review, and closeout status are recorded.
```

Respect repo label conventions if present. Otherwise suggest `bug` and `needs-triage`.

## Diagnose

If root cause is unclear:

1. Reproduce or inspect the real failure.
2. Minimize to the smallest failing case.
3. Form hypotheses from evidence.
4. Instrument or inspect code to confirm.
5. Update the issue with the confirmed root cause.

If the bug cannot be reproduced, record the attempted evidence and leave the issue open with the missing information.

## Plan The Fix

Use the lightest plan that manages the risk:

- For a focused, obvious fix, note the expected file changes and verification commands in the issue.
- For nontrivial fixes, run `sdlc blueprint <issue> --sync` and include root cause, files to change, tests, docs impact, and rollback notes.
- For production, auth, billing, permissions, privacy, data loss, or weak-test areas, require a regression proof before claiming completion.

## Implement

- Write or update the failing test before the fix when feasible.
- Keep the patch scoped to the issue.
- Preserve user changes and unrelated work.
- Do not silently expand scope. If you find adjacent work, update the issue or create a follow-up issue.
- Update docs or capability notes when the fix changes documented behavior, limitations, or guarantees.

## Verify And Close

Run the relevant commands from `.sdlc/project.yml` and the affected capability docs.

For user-facing bugs, verify the affected workflow from the user's perspective. Capture screenshots or videos when the surface is visual or interactive, then record the evidence with `sdlc qa record`.

Before closure:

- confirm tests/checks passed or document why they could not run
- run `sdlc drift` when code or docs mappings exist
- complete review or explain why review is not required
- verify preview or production behavior when the repo contract requires it
- run `sdlc closeout <issue> --include-qa --close` only after the evidence is complete

Closeout should include:

```markdown
## Resolution
Root cause: ...
Fix: ...

## Verification
- Test: `{command}` -> {result}
- QA: {link/status or N/A}
- Review: {link/status or N/A}
- Preview/production: {status or N/A}

## Follow-ups
- ...
```
