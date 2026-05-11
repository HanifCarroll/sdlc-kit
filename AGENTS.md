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
