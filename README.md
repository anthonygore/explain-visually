# Code Explainer Canvas

This is a minimal local renderer for visual code explanations.

It provides:

- a browser canvas with playback controls
- text-to-speech using the browser Speech Synthesis API
- a small MCP server with `add_scene`, `clear_scenes`, and `get_canvas_url`
- a local HTTP API for quick testing

## Run

For normal Codex use, the MCP server is registered as:

```text
code_explainer_canvas
```

Codex starts `server.mjs` when the MCP connection is loaded. That same process hosts the browser canvas at:

```text
http://127.0.0.1:8765
```

When Codex stops the MCP process, the local canvas server stops too.

If you want to run it manually:

```sh
npm start
```

Then open:

```text
http://127.0.0.1:8765
```

## Local API Test

```sh
curl -X POST http://127.0.0.1:8765/api/scenes \
  -H 'content-type: application/json' \
  -d '{
    "id": "request_response",
    "title": "Request response",
    "html": "<section class=\"scene\"><h2 class=\"scene-title\">Browser -> Server</h2><div class=\"flow\"><div class=\"node\"><div class=\"icon\">Browser</div><div class=\"label\">Browser</div></div><div class=\"arrow\">-></div><div class=\"node\"><div class=\"icon\">Server</div><div class=\"label\">Server</div></div></div></section>",
    "narration": "The browser sends a request to the server."
  }'
```

## MCP Tools

The registered MCP server exposes:

- `add_scene`
- `clear_scenes`
- `get_canvas_url`

The `add_scene` tool accepts:

```json
{
  "id": "scene_1",
  "title": "Optional display title",
  "html": "<section class=\"scene\">...</section>",
  "narration": "Speakable narration text."
}
```
