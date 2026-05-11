---
name: sdlc-triage
description: Issue-first triage workflow for ambiguous incoming work. Use when the user reports unclear work, vague feedback, a possible bug, a possible feature, technical debt, maintenance, or a client/user request that needs classification before implementation.
---

# SDLC Triage Workflow

Use this skill as the front door when the work is not clearly a bug, enhancement, feature, refactor, spike, or maintenance task yet.

## Operating Model

- GitHub Issues are the canonical work queue. Create or identify the issue before implementation.
- Triage does not implement by default. It classifies, clarifies, labels, and routes.
- Prefer existing skills:
  - Matt Pocock style: `triage`, `triage-issue`, `to-issues`
  - gstack: `gstack-office-hours`, `gstack-autoplan`, `gstack-plan-eng-review`, `gstack-plan-design-review`
  - Cleanup: `/simplify` only if triage produces a small repo diff, such as issue templates or docs
  - Superpowers: use only when the triaged work is broad or risky enough to need heavy mode
- Ask before implementation or heavy mode.

## Intake

Gather only what is missing:

- What was observed or requested
- Who is affected
- Urgency and impact
- Relevant links, screenshots, logs, branches, environments, or customer/client context
- Whether there is an existing issue, PR, doc, incident, or task

If the user gave enough to classify the work, continue without over-questioning.

## Issue First

Create or update a GitHub issue before routing.

Minimum issue body:

```markdown
## Intake
{raw report or request}

## Context
...

## Impact / Urgency
...

## Classification
Unknown until triaged.

## Readiness
- Status: needs-triage
- Missing info:

## Routing
- Target SOP:
- Reason:
```

Respect `docs/agents/triage-labels.md` if present. Otherwise suggest `needs-triage`.

## Classify

Classify into the most useful next workflow:

- `sdlc-bug`: behavior is broken, regressed, flaky, crashing, or failing.
- `sdlc-enhancement`: an existing feature needs better behavior, polish, or extension.
- `sdlc-feature`: a new capability, workflow, endpoint, integration, or product surface is needed.
- `sdlc-refactor`: behavior should usually remain unchanged while structure improves.
- `sdlc-spike`: the question is feasibility, approach, research, library choice, or "should we do this?"
- `sdlc-maintenance`: dependency, security, CI, build, config, tooling, test reliability, or repo upkeep.
- Incident path: production-impacting outage, data loss, security, privacy, or customer-impacting live regression. Escalate beyond normal bug handling.

If two classifications fit, pick the one that best describes the next action, not the backstory.

## Clarify Readiness

Mark the issue:

- `ready` when acceptance criteria and next workflow are clear.
- `needs-info` when one or two missing facts block routing.
- `blocked` when an external dependency prevents progress.
- `split-needed` when the report contains multiple independent work items.

If the work is too large or mixed, use `to-issues` or create child issues before implementation.

## Route

Update the issue with:

```markdown
## Triage Result
Classification: ...
Next SOP: ...
Reason: ...

## Acceptance Criteria
- [ ] ...

## Verification Plan
- [ ] ...

## Links
- Follow-up issues:
- Supporting docs:
```

Then invoke or recommend the target SOP.

## Close Or Park

Close triage-only issues only when the work was split, routed, duplicated, rejected, or answered.

Do not close an issue that still represents executable work. Move it to the correct workflow state instead.

