# Adapters

Adapters connect the core SDLC contract to external systems.

Initial built-in adapters:

- GitHub tracker adapter: `adapters/github`
- Vercel preview adapter: `adapters/vercel`
- Cloudflare preview adapter: `adapters/cloudflare`
- Portless local route adapter
- Codex/gstack workflow adapters

Adapters are typed packages in this monorepo. A public plugin loader is intentionally out of scope until the built-in contracts are proven.
