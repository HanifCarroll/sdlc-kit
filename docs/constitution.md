# sdlc-kit Constitution

This document defines the durable rules for evolving `sdlc-kit`.

## Purpose

`sdlc-kit` is a repo-local SDLC contract for AI-assisted engineering. It should help humans and agents keep issues, plans, worktrees, QA evidence, reviews, docs, and closeout aligned.

It is not a coding agent, task runner, deployment platform, or replacement for a project tracker.

## Non-Negotiables

- GitHub Issues are the default canonical work queue and audit trail.
- The repo-local contract lives in committed files, especially `.sdlc/project.yml`, docs, templates, and tests.
- Planned commands must fail honestly until implemented.
- Provider integrations stay typed and built into the monorepo until adapter contracts are stable.
- Public docs, templates, examples, and skills must not include private filesystem paths, secrets, or user-specific operational assumptions.
- Commands that mutate GitHub, routes, worktrees, or files must be explicit about what they changed.
- Production issue closeout requires verification evidence when the project manifest requires it.

## Ready To Merge

A change is ready to merge when:

- the linked issue has clear acceptance criteria,
- behavior changes have focused test coverage or a documented reason tests are not useful,
- relevant docs/templates/examples are updated,
- `bun run check` and `bun test` pass,
- public docs remain portable,
- the PR records verification evidence.

## Human Approval Gates

Human approval is required before:

- merging externally visible behavior changes,
- publishing packages,
- changing the public CLI contract in a breaking way,
- adding network calls, auth flows, or destructive cleanup behavior,
- accepting provider assumptions that could touch production data or secrets.

## Design Bias

Prefer small, explicit commands over broad automation. A command should make the next SDLC step easier to verify, not hide the step.
