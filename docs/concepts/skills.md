# First-Party Skill System

`sdlc-kit` skills are the human and agent workflows that operate against the repo-local SDLC contract. They are first-party skills: they should be complete enough to understand and complete the lifecycle from this repo alone.

The goal is a complete system that works for real projects and is packaged so other teams can adopt the same rails.

This document describes the target skill taxonomy, not a guarantee that every skill already exists under `skills/`. Current shipped behavior belongs in `docs/current-state.md`.

## Principles

- Skills model SDLC responsibilities, not vendor names or agent products.
- Each skill should be useful on its own, but fit cleanly into the full issue-to-closeout loop.
- Public skill docs, examples, prompts, and metadata should describe the `sdlc-kit` workflow directly.
- The CLI records structured evidence and state. Skills own judgment, workflow, capture, and review discipline.
- Builder and verifier responsibilities should stay separate when the work is risky enough to justify it.
- QA evidence should include screenshots and videos when the changed surface is visual or interactive.

## Complete Skill Set

The complete target contains 30 skills. The set is intentionally broader than the v1 package so the system has a clear destination without forcing every specialized rail to ship at once.

### Intake and Planning

| Skill | Role | Typical Output |
| --- | --- | --- |
| `sdlc-triage` | Classify incoming work, set issue type, identify ownership, and decide whether the item is ready. | Labeled issue, scope notes, next action |
| `sdlc-intake` | Turn rough requests into actionable issue candidates with acceptance criteria. | Draft issue or issue-ready brief |
| `sdlc-investigate` | Reproduce, inspect, and explain unknown behavior before implementation. | Root cause notes, evidence, recommended fix path |
| `sdlc-plan` | Produce a blueprint before code for nontrivial work. | Files to change, behavior changes, tests, docs, risks |
| `sdlc-spike` | Explore an uncertain technical or product direction without committing to production changes. | Findings, options, recommendation, follow-up issue |

### Build Work

| Skill | Role | Typical Output |
| --- | --- | --- |
| `sdlc-implement` | General implementation rail when a narrower build skill is not appropriate. | Focused code change with verification |
| `sdlc-bug` | Fix a confirmed defect through reproduction, root cause, patch, regression proof, and closeout. | Bug fix, regression test or evidence |
| `sdlc-feature` | Add a new user-facing or developer-facing capability. | Feature implementation, docs, tests, QA evidence |
| `sdlc-enhancement` | Improve an existing capability without changing its core contract. | Narrow improvement with updated proof |
| `sdlc-refactor` | Improve internal structure while preserving behavior. | Behavior-preserving change, regression checks |
| `sdlc-maintenance` | Keep dependencies, metadata, templates, workflows, or infrastructure healthy. | Maintenance change with compatibility checks |

### Verification

| Skill | Role | Typical Output |
| --- | --- | --- |
| `sdlc-qa` | Verify behavior from the user's perspective and collect visual evidence when appropriate. | QA verdict, screenshots, videos, recorded evidence |
| `sdlc-review` | Review a change written by another agent or engineer. | Actionable review findings or clean review |
| `sdlc-design-review` | Review UX, visual quality, responsive behavior, and interaction details. | Design findings with screenshots when useful |
| `sdlc-security-review` | Review auth, authorization, secrets, data exposure, unsafe automation, and dependency risk. | Security findings and required fixes |
| `sdlc-performance-review` | Review latency, bundle size, runtime cost, query behavior, and resource usage. | Performance findings and measurements |

### Shipping and Closeout

| Skill | Role | Typical Output |
| --- | --- | --- |
| `sdlc-pr` | Prepare a pull request with issue link, summary, verification, screenshots, videos, and risk notes. | PR body and ready-for-review checklist |
| `sdlc-ship` | Drive the change through final checks, review response, merge readiness, and release handoff. | Merge-ready PR and ship notes |
| `sdlc-deploy` | Deploy the adopting project through its configured provider or release path. | Deployment evidence and environment notes |
| `sdlc-canary` | Verify a deployed change on a limited surface before broad release or issue closure. | Canary verdict and follow-up actions |
| `sdlc-closeout` | Reconcile issue, PR, docs, QA evidence, production verification, and final status. | Closeout comment and issue closure |

### Documentation and System Integrity

| Skill | Role | Typical Output |
| --- | --- | --- |
| `sdlc-docs` | Update current-state docs, capability docs, templates, and user-facing references. | Durable docs aligned to behavior |
| `sdlc-adr` | Capture decisions that should constrain future work. | ADR with context, decision, consequences |
| `sdlc-drift` | Check whether source changes require docs, evals, or capability updates. | Drift report and required updates |
| `sdlc-capability-map` | Maintain the mapping between code, capabilities, docs, tests, evals, and labels. | Updated capability map and drift rules |

### Environment and Release Operations

| Skill | Role | Typical Output |
| --- | --- | --- |
| `sdlc-worktree` | Create and manage isolated issue worktrees with the commands needed to run the project. | Worktree path, branch, setup status |
| `sdlc-preview` | Create or interpret provider preview environments for branch or PR QA. | Preview URL, provider status, QA target |
| `sdlc-release` | Release the project where `sdlc-kit` is installed. `sdlc-kit` uses the same skill to dogfood its own releases. | Release notes, versioning, deploy evidence |
| `sdlc-hotfix` | Handle urgent production fixes with tighter scope, faster verification, and explicit risk notes. | Hotfix branch, patch, verification, production check |
| `sdlc-retro` | Learn from completed work and convert process gaps into follow-up issues or docs. | Retro notes, follow-up issues, system improvements |

## Essential V1 Set

The v1 set should be complete enough to run the full loop without forcing every specialized reviewer or release variant to exist on day one. It is not the smallest OSS sample; it is the first usable complete loop.

| Skill | Why It Belongs In V1 |
| --- | --- |
| `sdlc-triage` | Keeps the issue queue clean and ensures work starts with the right type, labels, and readiness. |
| `sdlc-plan` | Enforces blueprint-before-code for nontrivial work. |
| `sdlc-bug` | Covers defects with reproduction, root cause, regression proof, and closeout. |
| `sdlc-feature` | Covers net-new capabilities and the docs/tests/QA they require. |
| `sdlc-refactor` | Covers behavior-preserving structural work without pretending it is a feature. |
| `sdlc-maintenance` | Covers dependency, template, CI, metadata, and infrastructure upkeep. |
| `sdlc-spike` | Gives uncertain work a bounded path before implementation. |
| `sdlc-qa` | Provides independent verification and captures screenshots/videos when useful. |
| `sdlc-review` | Supports review by an agent or engineer who did not write the change. |
| `sdlc-ship` | Pulls final checks, PR packaging, review response, and merge readiness into one workflow until `sdlc-pr` exists separately. |
| `sdlc-closeout` | Ensures issues do not close until evidence, docs, and production verification are reconciled. |
| `sdlc-docs` | Keeps current-state, capability, and reference docs from drifting behind shipped behavior. |

## Later Additions

The remaining skills are part of the complete system but can arrive after the v1 loop is reliable:

- `sdlc-intake`
- `sdlc-investigate`
- `sdlc-implement`
- `sdlc-enhancement`
- `sdlc-design-review`
- `sdlc-security-review`
- `sdlc-performance-review`
- `sdlc-pr`
- `sdlc-deploy`
- `sdlc-canary`
- `sdlc-adr`
- `sdlc-drift`
- `sdlc-capability-map`
- `sdlc-worktree`
- `sdlc-preview`
- `sdlc-release`
- `sdlc-hotfix`
- `sdlc-retro`

## QA Evidence Boundary

The `sdlc qa record` command records evidence that already exists. It should not be responsible for driving a browser, deciding what to inspect, taking screenshots, or recording videos.

Those responsibilities belong to `sdlc-qa` and adjacent verification skills. A QA skill should:

1. Start from the issue acceptance criteria and changed surfaces.
2. Select the right target: local worktree URL, provider preview URL, or production URL.
3. Exercise the workflow from the user's perspective.
4. Capture screenshots and videos when the surface is visual, interactive, or otherwise hard to prove with logs.
5. Record the media and verdict through `sdlc qa record`.
6. Include the evidence in the PR, review, or closeout artifact.

This keeps the CLI simple and auditable while making the skill responsible for the work that requires judgment.

## Authoring Standard

The detailed authoring contract for public skills is documented in [skill-authoring.md](skill-authoring.md).
