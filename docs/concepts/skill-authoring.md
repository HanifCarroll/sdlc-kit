# Skill Authoring Standard

`sdlc-kit` skills are first-party workflows. A user should be able to install `sdlc-kit`, read the repo docs, and run the SDLC loop from this repo alone.

## Authoring Rules

- Write every skill as a complete workflow.
- Use only `sdlc-kit` concepts and repo-local tools in public skill docs, examples, prompts, and metadata.
- Use `sdlc-kit` commands, repo docs, Git, GitHub, provider previews, tests, evals, and production checks as the operating surface.
- Keep skill names role-based: `sdlc-plan`, `sdlc-qa`, `sdlc-review`, not vendor- or agent-specific.
- Treat provider adapters as infrastructure, not workflow owners. The skill decides what evidence is needed; the CLI records it.
- Keep Hanif-specific workflow preferences out of public skills unless they are generalized into the repo contract.

## Required Skill Shape

Each `SKILL.md` should include:

1. YAML frontmatter with `name` and a portable `description`.
2. A one-paragraph purpose statement.
3. Intake questions or inputs the skill needs.
4. Issue-first behavior.
5. Planning or blueprint guidance.
6. Implementation or investigation guidance, if the skill owns execution.
7. Verification and QA evidence expectations.
8. Docs, drift, release, or closeout expectations when relevant.
9. Clear blocked-state behavior when the skill cannot safely continue.

## First-Party Workflow Surface

Skills should prefer these repo-local surfaces:

- `.sdlc/project.yml` for configured commands and providers.
- `docs/current-state.md` for what the system currently guarantees.
- `docs/capabilities/` for capability contracts, source files, tests/evals, limitations, and known issues.
- `docs/plans/` for durable historical plans.
- `docs/adr/` for durable decisions.
- `sdlc blueprint` for issue-level execution plans.
- `sdlc worktree` for issue-specific work isolation.
- `sdlc route` for owned local QA routes when configured.
- `sdlc qa record` for local, preview, or production evidence.
- `sdlc drift` for docs/capability drift checks.
- `sdlc closeout` for final issue evidence and closure.

## Evidence Standard

A skill should not claim completion from code changes alone. It should record:

- issue or PR link
- changed behavior
- commands run and results
- screenshots or videos when the surface is visual or interactive
- docs or drift status
- preview or production verification when the repo contract requires it
- follow-up issues when scope is intentionally deferred

## Language Standard

Use direct, portable language. Avoid references that assume a specific agent product, local private path, personal vault, or unrelated workflow library. Public skills should read like the canonical `sdlc-kit` process, not like glue code around another process.
