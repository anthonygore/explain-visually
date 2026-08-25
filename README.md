# Code Explainer

A local prototype for playing generated explanation scenes in order.

## Run

Start the Node API:

```sh
npm run api
```

Start the Vite frontend:

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

Agent-facing API and scene authoring rules are documented in `ai-docs.md`.

## Add Scenes

Send one scene:

```sh
curl -X POST http://127.0.0.1:8787/add_scene \
  -H 'content-type: application/json' \
  -d '{
    "narration": "The browser sends a request to the API.",
    "mermaid": "flowchart LR\n  A[Browser] --> B[Node API]\n  B --> C[SSE]\n  C --> D[Frontend]",
    "minDuration": 2500
  }'
```

Or send multiple scenes:

```sh
curl -X POST http://127.0.0.1:8787/add_scene \
  -H 'content-type: application/json' \
  -d '{
    "scenes": [
      {
        "narration": "First scene.",
        "mermaid": "flowchart LR\n  A[Input] --> B[Renderer]"
      },
      {
        "narration": "Second scene.",
        "html": "<section style=\"height:100%;display:grid;place-items:center\"><h1>HTML scene</h1></section>"
      }
    ]
  }'
```

Each scene requires:

- `narration`: speakable text string
- one of `mermaid`: Mermaid diagram string, `html`: semantic scene HTML, or `code`: syntax-highlighted code scene object

Optional:

- `minDuration`: minimum scene duration in milliseconds, defaulting to `2000`

## API

- `POST /add_scene`: accepts one scene, an array of scenes, or `{ "scenes": [...] }`
- `POST /api/clear_scenes`: clears the current scene queue and resets playback state
- `POST /render`: renders the currently loaded scene queue to a 1280x720 MP4 and sentence-level SRT captions with local Voicebox, Playwright, and ffmpeg
- `GET /api/scenes`: returns cached scenes and the current scene index
- `PUT /api/current_scene`: persists the current scene index
- `GET /api/events`: streams scene updates with server-sent events
- `GET /api/health`: health check
