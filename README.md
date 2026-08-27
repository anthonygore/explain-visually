# Explain Visually

Explain Visually is a local visual explainer app and portable AI integration. The app previews and renders narrated scenes; the plugin bundles the scene-authoring skill and MCP adapter for Codex, Claude, and other MCP-capable harnesses.

## Repository layout

- `app/`: Vite frontend and Node API
- `plugin/`: Codex plugin, skill, and standalone MCP server
- `examples/`: valid scene payload examples
- `INSTALL.md`: installation instructions

## Run

From the `app/` directory, start both services together:

```sh
npm install
npm start
```

Open:

```text
http://127.0.0.1:5173/
```

## Environments

Set `EXPLAIN_VISUALLY_ENV=development` in the root `.env` file for local-only diagnostics and test behavior. Use `EXPLAIN_VISUALLY_ENV=production` for a distribution-like run. Keep environment-specific behavior in the app or MCP adapter; scene payloads must remain environment-neutral.

The Vite server proxies API and SSE requests to the Node server at:

```text
http://127.0.0.1:8787
```

## Docs

- API and renderer contract: `plugin/skills/explainvisually/api-docs.md`
- Codex skill: `plugin/skills/explainvisually/SKILL.md`
- Cross-harness installation: `INSTALL.md`
- MCP adapter: `plugin/mcp/explain-visually.mjs`

## Smoke Test

```sh
curl http://127.0.0.1:8787/api/health
```

## Local Plugin Testing

The repository uses `.githooks/post-commit` to sync the committed `plugin/` directory into the personal marketplace and reinstall the local plugin with a fresh cachebuster. After committing changes, start a new chat or task to test the refreshed skill and MCP tools.

Install the hook once if needed:

```sh
npm run install-git-hooks --prefix app
```

Run the same workflow manually with:

```sh
npm run sync:plugin --prefix app
```
