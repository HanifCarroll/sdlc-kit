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
| `commands` | No | map of strings | Named repo commands such as `install`, `check`, and `test`. |

Supported providers are `github`, `vercel`, `cloudflare`, `portless`, and `none`.

Unsupported keys fail validation so misspelled contract fields do not silently drift.

For Vercel, preview verification must not point at `production`. Use `preview` for standard Vercel preview deployments or a non-production custom environment when the project has one.
