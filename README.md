# sdlc-kit

A repo-local SDLC contract for AI-assisted engineering.

`sdlc-kit` keeps issues, plans, specs, worktrees, previews, docs, evals, reviews, production verification, and closeout in sync.

It is built as a Bun/TypeScript CLI with typed provider adapters and installable repo templates.

## Status

Working local v0. The package is not published yet; use it from a clone while the CLI contract settles.

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

## Local Usage

From this repo:

```sh
bun install
bun run sdlc --help
bun run ci
```

From another local project before npm publication:

```sh
bun /path/to/sdlc-kit/packages/cli/src/index.ts adopt --preset github-vercel --project example-app
bun /path/to/sdlc-kit/packages/cli/src/index.ts adopt --preset github-vercel --project example-app --apply
bun /path/to/sdlc-kit/packages/cli/src/index.ts doctor
```

Use `init` for a new repo and `adopt` for an existing repo. `adopt` is report-first; it only writes files when `--apply` is present.

## Issue Loop

The normal loop is:

```sh
sdlc doctor
sdlc blueprint 123 --sync
sdlc worktree start 123 --dry-run
sdlc worktree start 123
sdlc route ensure --issue 123 --port 3000
sdlc qa record --issue 123 --surface local --status pass --url https://issue-123.example.localhost --screenshot artifacts/local.png
sdlc drift --base main
sdlc closeout 123 --include-qa --verification "bun run ci -> pass" --production "Production smoke passed" --close
```

In a pre-publish checkout, prefix those commands with:

```sh
bun /path/to/sdlc-kit/packages/cli/src/index.ts
```

## Commands

Implemented CLI surface:

- `sdlc init`
- `sdlc adopt`
- `sdlc doctor`
- `sdlc blueprint`
- `sdlc worktree`
- `sdlc route`
- `sdlc qa`
- `sdlc drift`
- `sdlc closeout`

## Core Decisions

- Bun/TypeScript CLI, with npm as the intended public install channel.
- Built-in typed adapters first. No plugin loader until the adapter contracts are proven.
- Commit durable historical plans in `docs/plans/`.
- Keep issue blueprints local by default and sync them to GitHub issue comments.
- `sdlc adopt` is report-first. Writes require `--apply`.
- Drift checks start warn-only for adopted repos.

## Project Manifest

Repo behavior is configured through [`.sdlc/project.yml`](.sdlc/project.yml). The manifest schema and example fields are documented in [docs/reference/project-manifest.md](docs/reference/project-manifest.md).

Example manifests live in [examples/project-manifests](examples/project-manifests/):

- [Vercel app](examples/project-manifests/vercel.yml)
- [Cloudflare app](examples/project-manifests/cloudflare.yml)
- [Local-only project](examples/project-manifests/local-only.yml)

## License

MIT
