# Templates

Templates are the repo-local files installed by `sdlc init` and proposed by `sdlc adopt`.

The first supported presets are:

- `full`
- `hanif`
- `github-vercel`
- `github-cloudflare`
- `local-only`
- `library`

Generated output covers:

- base `.sdlc/project.yml`
- blueprint directory README
- constitution/current-state/capability docs
- historical plans and ADR directories
- GitHub issue templates
- pull request template
- drift-check workflow placeholder

The core renderer refuses to overwrite existing files unless overwrite is explicitly approved.
