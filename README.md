# sdlc-kit

A repo-local SDLC contract for AI-assisted engineering.

`sdlc-kit` keeps issues, plans, specs, worktrees, previews, docs, evals, reviews, production verification, and closeout in sync.

It is built as a Bun/TypeScript CLI with typed provider adapters and installable repo templates.

## Status

Early implementation scaffold. The design and milestone plan live in [`docs/plans/`](docs/plans/).

## Intended Shape

```txt
sdlc-kit
  packages/cli       # `sdlc` command
  packages/core      # manifest schema and shared contracts
  adapters/          # built-in typed adapters
  templates/         # installable repo artifacts
  skills/            # portable SDLC agent skills
  examples/          # install/adoption examples
  docs/              # concepts, plans, adapter docs
```

## Commands

Planned CLI surface:

```sh
sdlc init --preset full
sdlc adopt --preset full
sdlc adopt --preset full --apply
sdlc doctor
sdlc blueprint 123
sdlc blueprint 123 --sync
sdlc worktree start 123
sdlc qa preview 123
sdlc drift
sdlc closeout 123
sdlc route list
sdlc route cleanup
```

Current scaffold:

```sh
bun install
bun run sdlc --help
bun run sdlc blueprint 123
bun run ci
```

Development checks are intentionally small for now: TypeScript validation, Bun tests, and a CLI smoke test.

## Core Decisions

- Bun/TypeScript CLI, published through npm.
- Built-in typed adapters first. No plugin loader until the adapter contracts are proven.
- Commit durable historical plans in `docs/plans/`.
- Keep issue blueprints local by default and sync them to GitHub issue comments.
- `sdlc adopt` is report-first. Writes require `--apply`.
- Drift checks start warn-only for adopted repos.

## Project Manifest

Repo behavior is configured through [`.sdlc/project.yml`](.sdlc/project.yml). The manifest schema and example fields are documented in [docs/reference/project-manifest.md](docs/reference/project-manifest.md).

## License

MIT
