# Project Manifest

`.sdlc/project.yml` is the repo-local contract that tells `sdlc-kit` how to find the project, docs, worktrees, QA surfaces, and verification commands.

## Example

```yaml
version: 1
project: example-app
base_branch: main

tracker:
  provider: github

docs:
  constitution: docs/constitution.md
  current_state: docs/current-state.md
  capabilities_dir: docs/capabilities
  plans_dir: docs/plans
  decisions_dir: docs/adr

worktrees:
  root: ../example-app-worktrees
  branch_prefix: codex

local:
  provider: portless
  route_pattern: issue-{issue}.example-app.localhost
  required_before_push: false

preview:
  provider: vercel
  required_before_merge: true
  environment: preview
  require_preview_secrets: true

production:
  required_before_issue_close: true
  smoke_paths:
    - /
    - /health

drift:
  mode: warn
  mappings:
    - source_paths:
        - src/**
      docs:
        - docs/capabilities/app.md

commands:
  install: bun install
  check: bun run check
  test: bun test
```

## Fields

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `version` | Yes | `1` | Manifest schema version. |
| `project` | Yes | string | Stable project slug/name used in generated artifacts. |
| `base_branch` | No | string | Default branch for worktree and PR comparisons. |
| `tracker.provider` | No | provider | Issue tracker provider. Use `github` for the default flow. |
| `docs.*` | No | path strings | Relative paths are resolved from the project root. |
| `worktrees.root` | No | path string | Relative paths are resolved from the project root. |
| `worktrees.branch_prefix` | No | string | Prefix for generated branch names. |
| `local.provider` | No | provider | Local QA provider. Use `portless` or `none`. |
| `local.route_pattern` | No | string | Pattern for local QA URLs. |
| `local.required_before_push` | No | boolean | Whether local QA is required before pushing. |
| `preview.provider` | No | provider | Preview provider. Use `vercel`, `cloudflare`, or `none`. |
| `preview.required_before_merge` | No | boolean | Whether preview QA is required before merge. |
| `preview.environment` | No | string | Provider environment name, usually `preview`. |
| `preview.require_preview_secrets` | No | boolean | Whether preview-only secrets or bindings must be confirmed. |
| `production.required_before_issue_close` | No | boolean | Whether issue closeout requires production smoke evidence. |
| `production.smoke_paths` | No | string list | Paths to smoke-test after deploy. |
| `drift.mode` | No | `warn` or `error` | Whether drift findings should warn or fail by default. Adopted repos should start with `warn`. |
| `drift.mappings[].source_paths` | No | string list | Source path globs that should be kept aligned with docs. |
| `drift.mappings[].docs` | No | string list | Docs or capability paths that acknowledge the mapped source behavior. |
| `commands` | No | map of strings | Named repo commands such as `install`, `check`, and `test`. |

Supported providers are `github`, `vercel`, `cloudflare`, `portless`, and `none`.

Unsupported keys fail validation so misspelled contract fields do not silently drift.

## Worktree Paths

Relative manifest paths are resolved from the checkout that contains `.sdlc/project.yml`. In the canonical checkout, `worktrees.root: ../example-app-worktrees` resolves to a sibling directory beside the repo.

When the same manifest is read from a linked worktree inside that sibling directory, `sdlc doctor` treats the linked worktree's parent directory as the configured worktree root if the parent name matches `worktrees.root`. That keeps doctor from reporting a missing nested worktree root while still warning when the root is genuinely absent.

For Vercel, preview verification must not point at `production`. Use `preview` for standard Vercel preview deployments or a non-production custom environment when the project has one.

For Cloudflare, preview verification must also confirm preview/prod binding separation. Pages preview deployments and Workers preview URLs can mirror production code, but preview secrets, bindings, data stores, and Access rules should be intentionally separated or explicitly accepted before merge.

For Portless, `local.route_pattern` renders the owned local QA hostname. Supported placeholders are `{project}`, `{issue}`, `{branch}`, and `{worktree}`. `sdlc route ensure --issue <n> --port <n>` registers the rendered route through `portless alias` and records owned routes in `.sdlc/routes.local.json`; `sdlc route cleanup` removes only routes recorded in that state file.

For drift checks, mapped source changes require a mapped docs/capability update unless the run supplies a concrete no-doc-impact reason. Empty or missing mappings are reported as setup gaps, which lets new/adopted repos start warn-only and tighten coverage over time.
