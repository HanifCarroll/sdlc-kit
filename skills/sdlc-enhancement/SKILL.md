---
name: sdlc-enhancement
description: Issue-first enhancement workflow for existing features. Use when the user wants to improve, adjust, polish, extend, or change behavior in an existing feature while preserving durable issue, docs, QA, review, and closeout records.
---

# SDLC Enhancement Workflow

Use this skill when the work improves an existing feature rather than creating a new product surface.

## Operating Model

- GitHub Issues are the canonical work queue. Create or identify the issue before implementation.
- Local docs support heavier reasoning, but they are not the work queue.
- Start from current behavior in `docs/current-state.md`, capability docs, tests/evals, and source code.
- Use `sdlc blueprint`, `sdlc qa record`, `sdlc drift`, and `sdlc closeout` where they fit the issue.
- Ask before implementation when the desired behavior, risk, or acceptance criteria are unclear.

## Intake

Capture:

- Current behavior
- Desired behavior
- Why it matters
- Users affected
- Constraints and non-goals
- Acceptance criteria
- Whether UI, API, data model, docs, or developer experience changes are involved
- Which capability docs, tests, evals, previews, or production checks may be affected

If the request has multiple valid product directions, stop at a short recommendation or issue-ready brief before implementation.

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

Respect repo label conventions if present. Otherwise suggest `enhancement` and `needs-triage`.

## Plan

Choose the lightest useful plan:

- For a focused low-risk patch, record the planned change and verification commands in the issue.
- For behavior, architecture, data, UI, deployment, or docs uncertainty, run `sdlc blueprint <issue> --sync`.
- If the enhancement changes a durable policy or architecture boundary, add or update an ADR.
- If it changes a current capability, update the capability doc or record a concrete no-doc-impact reason.

## Implement

- Keep changes scoped to the issue.
- Preserve existing behavior unless the issue explicitly changes it.
- Update or add tests/evals for changed behavior.
- Do not silently convert an enhancement into a new feature. If scope grows, update the issue and ask.
- Preserve user changes and unrelated work.

## Verify And Close

Run relevant tests and configured checks.

For user-facing behavior changes:

- verify the affected workflow locally or on a preview
- capture screenshots/videos when the surface is visual or interactive
- record evidence with `sdlc qa record`

Before closure:

- run `sdlc drift` when mappings exist
- record docs updated or no-doc-impact reason
- verify preview or production behavior when the repo contract requires it
- run `sdlc closeout <issue> --include-qa --close` only after evidence is complete

Closeout should include:

```markdown
## Resolution
Before: ...
After: ...

## Verification
- Test: `{command}` -> {result}
- QA: {link/status or N/A}
- Review: {link/status or N/A}
- Preview/production: {status or N/A}

## Docs
- {docs updated or N/A}
```
