---
name: sdlc-spike
description: Issue-first spike workflow for research, feasibility, prototypes, library evaluation, architecture exploration, and decision work. Use when the user needs to know whether or how to do something before committing to implementation.
---

# SDLC Spike Workflow

Use this skill when the goal is a decision or recommendation, not production implementation by default.

## Operating Model

- GitHub Issues are the canonical work queue. Create or identify the spike issue before investigation.
- Local docs are supporting evidence for large findings, architecture notes, prototype notes, or decision records.
- Prefer existing skills:
  - Matt Pocock style: `to-prd`, `to-issues`, `grill-with-docs`, `improve-codebase-architecture`
  - gstack: `gstack-office-hours`, `gstack-autoplan`, `gstack-plan-eng-review`, `gstack-plan-devex-review`, `gstack-benchmark`
  - Cleanup: `/simplify` if a prototype or exploratory diff is worth keeping
  - Superpowers: use only for large, risky, or multi-workstream investigation plans
- Ask before converting a spike into implementation.

## Intake

Capture:

- Decision needed
- Questions to answer
- Constraints and non-goals
- Timebox or depth
- Evidence needed to decide
- Whether a prototype, benchmark, code reading, docs research, or architecture sketch is acceptable

If the user asks for research but clearly expects implementation too, split the spike from the implementation work.

## Issue First

Create or update a GitHub issue.

Minimum issue body:

```markdown
## Spike Question
...

## Why This Matters
...

## Questions To Answer
- ...

## Non-Goals
- Production implementation
- ...

## Evidence Plan
- [ ] Codebase inspection:
- [ ] Docs/source research:
- [ ] Prototype/benchmark:

## Decision Options
- Do it:
- Do not do it:
- Do later:
- Split into:
```

Respect `docs/agents/triage-labels.md` if present. Otherwise suggest `spike` and `needs-triage`.

## Investigate

Use the lightest evidence that can answer the question:

- Codebase reading for fit and integration points
- Official docs or source repos for external libraries
- Small prototype only when reading is insufficient
- Benchmark only when performance or cost is central
- Architecture sketch or ADR when the decision changes boundaries

Do not let the prototype become production code unless the issue is updated and the user approves.

## Decide

End the spike with one of:

- Do it
- Do not do it
- Do later
- Split into implementation issues
- Needs more information

Record:

```markdown
## Spike Result
Decision: ...

## Evidence
- ...

## Recommendation
...

## Follow-Up Issues
- ...

## Risks / Unknowns
- ...
```

Use `to-issues` when the accepted work should become executable implementation slices.

## Verify And Close

Verification for a spike is evidence quality, not shipped behavior.

Close the issue only after the decision, links, and follow-up issues are recorded. If the spike produced code that will stay, run `/simplify`, relevant tests, and review before treating that code as production-ready.

