# Repository Instructions

This repo contains `sdlc-kit`, a Bun/TypeScript CLI and template system for repo-local AI-assisted engineering workflows.

## Editing Rules

- Keep public docs portable. Do not add private filesystem paths, private repository names, secrets, or user-specific vault conventions.
- Keep GitHub Issues as the default work queue and audit trail.
- Keep repo-local files as the contract: `.sdlc/project.yml`, docs, templates, adapters, and generated evidence.
- Keep adapters typed and built into the monorepo until the core contract is proven.
- Prefer explicit command behavior and fixture tests over clever dynamic behavior.
- Use plain ASCII punctuation in public docs and skill copy.

## Validation

Before shipping changes:

- Run `bun install` if dependencies changed.
- Run `bun run check`.
- Run `bun test`.
- Parse all skill frontmatter as YAML.
- Scan public docs and templates for private paths or secrets.

## Review Guidelines

When reviewing a pull request, prioritize findings that could cause incorrect behavior, broken installs, unsafe automation, missing verification, or drift from the repo-local SDLC contract.

- Focus review comments on actionable P0/P1 issues with concrete file and line references.
- Check that the change matches the linked issue, blueprint, or plan without silently expanding scope.
- Check CLI behavior, exit codes, package metadata, workspace resolution, and CI commands when those surfaces are touched.
- Check that planned commands fail honestly instead of appearing complete.
- Check that changed behavior has focused tests or a clear reason tests are not useful.
- Check that docs, templates, examples, and skills stay portable for OSS users and do not leak private paths, secrets, or Hanif-specific workflow assumptions outside examples.
- Avoid nitpicks, broad rewrites, subjective style comments, or suggestions that belong in a separate follow-up issue.

## Product Boundary

`sdlc-kit` is not another coding agent. It is the repo-local SDLC contract that coding agents and humans operate against.

The core lifecycle is:

1. issue
2. plan
3. blueprint
4. branch/worktree
5. implementation
6. local or preview QA
7. review
8. merge
9. production smoke
10. issue closeout
