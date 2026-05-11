# Complete AI-Assisted Engineering Reference System

Status: approved
Date: 2026-05-10

## Goal

Build the complete AI-assisted engineering system first, then package it so other engineers can install, adapt, and benefit from it.

This is not a minimal demo. It is a reference implementation for a full issue-to-production loop.

## Lifecycle

```txt
issue
  -> historical plan when needed
  -> issue blueprint
  -> branch/worktree
  -> implementation
  -> tests/evals/checks
  -> preview QA
  -> independent review
  -> merge
  -> production smoke
  -> issue closeout
```

## Locked Decisions

- Runtime: Bun/TypeScript CLI.
- Public install path: npm package exposing `sdlc`.
- Adapter model: built-in typed adapters in this monorepo.
- Planning storage: commit `docs/plans/`; keep `.sdlc/blueprints/` local by default and sync blueprints to issue comments.
- Adoption: `sdlc adopt` is report-first; writes require `--apply`.
- Drift: warn-only for adopted repos until the repo contract is trustworthy.

## Architecture

```txt
                 +-----------------------------+
                 |        .sdlc/project.yml    |
                 |  repo-local SDLC contract   |
                 +--------------+--------------+
                                |
                                v
        +-----------------------+-----------------------+
        |                  packages/core                |
        | schema | planner | checks | command contracts |
        +-----+-----------+----------+------------+-----+
              |           |          |            |
              v           v          v            v
       +------+--+   +----+----+ +---+-----+ +----+------+
       | GitHub  |   | Preview | | Local   | | Templates |
       | adapter |   | adapter | | adapter | | / Presets |
       +----+----+   +----+----+ +----+----+ +-----+-----+
            |             |           |            |
            v             v           v            v
      Issues/PRs     Preview URL   Local URL   Repo files
      comments       QA evidence   debugging   docs/workflows
```

## Milestone Issues

1. Repo foundation and Bun CLI skeleton.
2. Manifest schema and project discovery.
3. Template and preset engine.
4. `init`, `adopt`, and `doctor`.
5. GitHub adapter.
6. Blueprint and plan handling.
7. Vercel preview adapter.
8. Cloudflare preview adapter.
9. Portless local adapter.
10. Drift checks.
11. First real project adoption.

## Not In Scope Initially

- Third-party plugin loader.
- Rust rewrite or Rust core.
- Linear adapter.
- Hosted SaaS dashboard.
- Full enforcement drift checks on day one.

## Test Strategy

- Unit tests for schema parsing, config normalization, template rendering, redaction, and drift mapping.
- Fixture integration tests for `init`, `adopt`, `adopt --apply`, and `doctor`.
- Adapter contract tests for GitHub, Vercel, Cloudflare, and Portless with mocked command/API output.
- Snapshot tests for generated files and CLI messages.
- End-to-end dogfood test through a real hosted app after the first runnable milestone.
