# Explain Visually

A local prototype for previewing and rendering generated visual explainer scenes.

## Run

Start the Node API in one terminal:

```sh
npm run api
```

Start the Vite frontend in another terminal:

```sh
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

The Vite server proxies API and SSE requests to the Node server at:

```text
http://127.0.0.1:8787
```

## Docs

- API and renderer contract: `skills/explainvisually/api-docs.md`
- Codex skill: `skills/explainvisually/SKILL.md`
- Cross-harness installation: `INSTALL.md`
- MCP adapter: `mcp/explain-visually.mjs`

## Smoke Test

```sh
curl http://127.0.0.1:8787/api/health
```
