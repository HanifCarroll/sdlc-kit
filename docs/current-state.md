# Current State

This file summarizes what `sdlc-kit` currently ships and what remains intentionally out of scope.

## Ships Today

- Bun/TypeScript monorepo with `packages/cli`, `packages/core`, and typed provider adapters.
- `sdlc init` for installing the SDLC contract into a new project.
- `sdlc adopt` for report-first adoption in existing projects, with writes gated by `--apply`.
- `sdlc doctor` for validating the local project manifest and warning about missing docs, provider risks, plan frontmatter, and closeout gaps.
- `sdlc blueprint` for generating local issue blueprints and syncing them to GitHub issue comments.
- `sdlc worktree` for listing Git worktrees and creating issue-specific worktrees from the project manifest.
- `sdlc route` for owned Portless local QA routes.
- `sdlc drift` for mapping source changes to required docs/capability updates.
- Typed GitHub adapter for issue metadata, blueprint comments, and closeout comments.
- Typed Vercel and Cloudflare preview adapters for interpreting preview deployment evidence.
- Typed Portless adapter for local route ownership.
- Portable SDLC skills under `skills/`.
- Installable repo templates and GitHub issue/PR/workflow artifacts.

## Current Limits

- `sdlc qa` and `sdlc closeout` are still being implemented.
- The package has not been published to npm.
- Provider adapters interpret supplied evidence; most do not yet fetch provider APIs directly.
- Drift mappings start empty in generated projects and must be configured per repo.
- The CLI assumes GitHub for issue blueprint sync and closeout.

## Guarantees

- Template writes do not overwrite existing files unless explicitly requested.
- Unsupported manifest keys fail validation.
- Blueprint files are local by default and ignored from Git unless promoted intentionally.
- Portless cleanup only removes routes recorded in `.sdlc/routes.local.json`.
- Drift checks can run warn-only during adoption and fail CI later when mappings are trustworthy.

## Verification

The repo verification baseline is:

```sh
bun run check
bun test
bun run ci
```

The project manifest is validated with:

```sh
bun run sdlc doctor
```
