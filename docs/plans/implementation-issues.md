---
status: active
created: "2026-05-10"
---

# Implementation Issues

These are issue-ready slices for the initial `sdlc-kit` implementation.

## 1. Repo Foundation And Bun CLI Skeleton

Create the Bun workspace, CLI package, core package, test setup, lint/check scripts, and npm package metadata.

Acceptance criteria:

- `bun install` succeeds.
- `bun run sdlc --help` prints the command surface.
- `bun run check` passes.
- `bun test` passes.
- README explains the current scaffold status.

## 2. Manifest Schema And Project Discovery

Define `.sdlc/project.yml` schema and load/validate it from the current repo.

Acceptance criteria:

- Valid manifest parses into typed config.
- Missing manifest produces an actionable error.
- Invalid provider names fail validation.
- Path normalization is covered by fixture tests.

## 3. Template And Preset Engine

Add installable templates and presets for the repo-local SDLC contract.

Acceptance criteria:

- `full`, `hanif`, `github-vercel`, `github-cloudflare`, `local-only`, and `library` presets are represented.
- Template rendering refuses to overwrite existing files unless explicitly approved.
- Snapshot tests cover generated files.

## 4. `init`, `adopt`, And `doctor`

Implement the first full command set for installing and validating the repo contract.

Acceptance criteria:

- `init` writes new-project artifacts.
- `adopt` generates a report by default.
- `adopt --apply` writes approved patches.
- `doctor` validates manifest, commands, and provider configuration.
- Adopted repos start with drift checks warn-only.

## 5. GitHub Adapter

Implement GitHub issue and PR operations through a typed adapter.

Acceptance criteria:

- Adapter resolves issue metadata.
- Adapter posts or updates blueprint comments using a stable marker.
- Adapter writes closeout comments with verification evidence.
- Missing `gh` auth produces an actionable error.

## 6. Blueprint And Plan Handling

Implement issue-level blueprint generation and historical plan conventions.

Acceptance criteria:

- Blueprints are written under `.sdlc/blueprints/` locally.
- Blueprint sync updates GitHub issue comments.
- `docs/plans/` status/frontmatter conventions are validated.
- Blueprint files are gitignored by default.

## 7. Vercel Preview Adapter

Resolve and validate Vercel preview deployments.

Acceptance criteria:

- Adapter finds preview URLs from GitHub/Vercel evidence.
- Adapter rejects production URLs as preview evidence.
- Protected preview URLs are recorded with auth requirements.
- Preview environment separation is checked by `doctor`.

## 8. Cloudflare Preview Adapter

Resolve and validate Cloudflare preview deployments.

Acceptance criteria:

- Adapter supports Cloudflare-hosted projects.
- Preview URL evidence is captured consistently with the Vercel adapter.
- Preview/prod binding separation is checked by `doctor`.

## 9. Portless Local Adapter

Manage local QA routes for inner-loop debugging.

Acceptance criteria:

- Route names are deterministic from manifest patterns.
- `.sdlc/routes.local.json` tracks owned local routes.
- Cleanup removes only owned routes.
- Port conflicts produce actionable errors.

## 10. Drift Checks

Implement docs/capability drift checks.

Acceptance criteria:

- Mapped code path changes require docs/capability acknowledgement.
- No-doc-impact markers are supported with required reason text.
- Adopted repos default to warn-only mode.
- Missing path mappings report setup gaps.

## 11. First Real Project Adoption

Dogfood the system in one real hosted app.

Acceptance criteria:

- `sdlc adopt --preset hanif` produces a useful adoption report.
- Approved patch applies cleanly.
- One real issue exercises blueprint, preview URL capture, QA evidence, production smoke, and closeout.
