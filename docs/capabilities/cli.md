# CLI Contract

## Current Behavior

The `sdlc` CLI is the main user interface for the repo-local SDLC contract.

Implemented commands:

- `sdlc init`
- `sdlc adopt`
- `sdlc doctor`
- `sdlc blueprint`
- `sdlc worktree`
- `sdlc qa`
- `sdlc route`
- `sdlc drift`
- `sdlc closeout`

Planned commands must fail honestly until implemented.

## Source Files

- `packages/cli/src/cli.ts`
- `packages/cli/src/index.ts`
- `packages/core/src/index.ts`
- `packages/core/src/templates.ts`
- `adapters/github/src/index.ts`
- `adapters/portless/src/index.ts`

## Tests

- `packages/cli/src/index.test.ts`
- `packages/core/src/index.test.ts`
- `packages/core/src/templates.test.ts`
- `packages/core/src/drift.test.ts`
- `adapters/github/src/index.test.ts`
- `adapters/portless/src/index.test.ts`

## Commands

```sh
bun run check
bun test
bun run sdlc doctor
```

## Limitations

- GitHub-backed commands require the GitHub CLI and authenticated `gh`.
- Provider preview commands are evidence interpreters before they become full provider API clients.

## Agent Context

Read first:

- `README.md`
- `docs/current-state.md`
- `docs/reference/project-manifest.md`
- `packages/cli/src/cli.ts`
- `packages/cli/src/index.test.ts`

Known pitfalls:

- Keep planned commands from appearing complete before they have tests.
- Preserve report-first behavior for adoption.
- Render QA screenshots and videos into evidence Markdown when they are supplied.
- Do not add private paths or secrets to public docs, templates, examples, or skills.
