# Code Explainer Agent Docs

This app plays generated explanation scenes in order. Agents add scenes by calling the local Node API. The browser receives scenes through server-sent events, renders the current scene in a fixed 16:9 frame, and speaks the narration with the Web Speech API.

## Base URLs

Node API:

```text
http://127.0.0.1:8787
```

Vite frontend:

```text
http://127.0.0.1:5173/
```

## Endpoints

### POST /add_scene

Adds one or more scenes to the ordered queue. The API broadcasts accepted scenes to the frontend over SSE.

Response:

```json
{ "ok": true }
```

Accepted request body shapes:

```json
{
  "narration": "Speakable narration text.",
  "html": "<section><h1>Title</h1><p>Semantic HTML scene.</p></section>"
}
```

```json
{
  "narration": "Speakable narration text.",
  "mermaid": "flowchart LR\n  A[Input] --> B[Output]"
}
```

```json
{
  "narration": "Focus on the return statement.",
  "code": {
    "language": "javascript",
    "title": "handler.js",
    "content": "export function handler(req, res) {\n  const name = req.query.name ?? 'world';\n  return res.json({ message: `Hello ${name}` });\n}",
    "focusLines": [3]
  }
}
```

```json
[
  {
    "narration": "First scene.",
    "mermaid": "flowchart LR\n  A[Browser] --> B[API]"
  },
  {
    "narration": "Second scene.",
    "html": "<section><h1>Done</h1></section>"
  }
]
```

```json
{
  "scenes": [
    {
      "narration": "First scene.",
      "html": "<section><h1>Scene one</h1></section>"
    }
  ]
}
```

Scene properties:

- `narration`: required string. Text spoken by the browser.
- `html`: optional string. Semantic scene markup.
- `mermaid`: optional string. Mermaid diagram source.
- `code`: optional object. Syntax-highlighted code scene.
- `minDuration`: optional non-negative number in milliseconds. Defaults to `2000`.

Each scene must include one of `html`, `mermaid`, or `code`. Do not send more than one scene type unless you intend the frontend to prefer this order: `mermaid`, then `code`, then `html`.

### POST /api/clear_scenes

Clears the server's current scene queue and resets `currentIndex` to `0`. The API broadcasts a `sync` event so connected frontends update immediately.

Use this before starting a new generated explanation.

Example:

```sh
curl -X POST http://127.0.0.1:8787/api/clear_scenes
```

Response:

```json
{ "ok": true }
```

### POST /render

Renders the scenes currently loaded in the server queue to an MP4 video. This endpoint does not accept scene payload arguments. Add or preview scenes with `POST /add_scene` first, then call `POST /render` when the current queue should become a video.

Current behavior:

- Calls local Voicebox once per scene to render narration audio.
- Measures each WAV duration.
- Computes per-scene duration as `max(audioDurationMs, minDuration)`.
- Splits each scene narration into sentence-level SRT captions and writes `renders/<renderId>/captions.srt`.
- Captures each scene at 1280x720 through the browser renderer.
- Muxes each scene with its own audio, concatenates the segments, and writes `renders/<renderId>/video.mp4`.
- Deletes temporary audio, screenshots, and segment files after the final video is created.
- Returns errors if Voicebox, the browser renderer, or `ffmpeg` is unavailable.

Voicebox defaults:

```text
VOICEBOX_URL=http://127.0.0.1:17493
VOICEBOX_PROFILE=George
VOICEBOX_ENGINE=kokoro
RENDER_FRONTEND_URL=http://127.0.0.1:5173
```

These can be overridden with environment variables when starting the Node API.

Render prerequisites:

- The Vite frontend must be running at `RENDER_FRONTEND_URL`.
- The Node API must be able to launch Playwright Chromium.
- `ffmpeg` must be available on `PATH`.

Example:

```sh
curl -X POST http://127.0.0.1:8787/render \
  -H 'content-type: application/json'
```

Successful response:

```json
{
  "ok": true,
  "renderId": "uuid",
  "renderDir": "/absolute/path/to/renders/uuid",
  "videoPath": "/absolute/path/to/renders/uuid/video.mp4",
  "captionsPath": "/absolute/path/to/renders/uuid/captions.srt",
  "voicebox": {
    "url": "http://127.0.0.1:17493",
    "profile": "George",
    "profileId": "profile-id",
    "engine": "kokoro"
  },
  "scenes": [
    {
      "index": 0,
      "skipped": false,
      "audioPath": null,
      "audioDurationMs": 2800,
      "durationMs": 3000,
      "error": null
    }
  ],
  "video": {
    "path": "/absolute/path/to/renders/uuid/video.mp4",
    "width": 1280,
    "height": 720,
    "fps": 30
  },
  "captions": {
    "path": "/absolute/path/to/renders/uuid/captions.srt",
    "format": "srt"
  },
  "errors": []
}
```

If a scene has blank narration, audio generation is skipped for that scene and `durationMs` is set to `minDuration`.

The returned `audioDurationMs` values are informational. Intermediate WAV files are deleted after successful video creation; the final MP4 and SRT file remain in the render directory.

### GET /api/scenes

Returns the cached scene queue and current scene index.

```json
{
  "scenes": [],
  "currentIndex": 0
}
```

### PUT /api/current_scene

Persists the current scene index on the server.

```json
{
  "currentIndex": 0
}
```

Response:

```json
{ "ok": true }
```

### GET /api/events

Opens the SSE stream used by the frontend. Agents usually do not need to call this.

Events:

- `sync`: initial full state with `scenes` and `currentIndex`
- `scene`: newly accepted scenes
- `current_scene`: current index updates

### GET /api/health

Health check.

```json
{ "ok": true }
```

## Scene Type Rules

Use `mermaid` for diagrams where automatic layout matters: flows, graphs, sequences, timelines, mind maps, state diagrams, and similar visuals.

Use `code` for source code, config, terminal-like snippets, and diffs that need syntax highlighting or focused lines.

Use `html` for text, lists, tables, code snippets, headings, and mixed explanatory content.

All rendered scenes sit inside a fixed 16:9 frame. Treat this like a video canvas: the renderer lays scenes out on a 1280x720 design surface, then scales that surface to the visible container. Semantic HTML and code scenes are also scaled down internally when their content would overflow the design surface. This prevents clipping, but small scaled content can become hard to read. Prefer concise scenes with one main idea, short tables, and limited text.

## Mermaid Scenes

The `mermaid` field should contain only Mermaid source.

Example:

```json
{
  "narration": "The request moves from the browser to the API, then back to the frontend.",
  "mermaid": "flowchart LR\n  A[Browser] --> B[Node API]\n  B --> C[SSE]\n  C --> D[Frontend]"
}
```

Prefer simple diagrams. The frontend owns baseline Mermaid styling. Do not include `themeVariables`, broad `classDef` blocks, or styling whose purpose is to make the base diagram look nicer.

For flowcharts and graphs, the frontend injects these approved focus classes: `active`, `highlight`, `muted`, `emphasis`, `success`, and `danger`. Apply those classes to nodes when narration needs to focus attention. Do not define the class styling yourself.

Example:

```text
flowchart LR
  A[Browser] e1@--> B[Node API]
  B --> C[SSE]

  class B active;
```

When reusing a diagram across adjacent scenes, keep the underlying diagram structurally stable. Make the smallest change needed to express the new focus, usually only class assignments or edge highlighting. Do not change labels, ordering, wording, or layout unless the scene is intentionally introducing a new version of the visual.

## HTML Scenes

HTML scenes are semantic markup only. The app owns layout and visual style.

Do not include:

- inline `style` attributes
- `<style>` tags
- `<script>` tags
- external assets, fonts, stylesheets, or iframes
- arbitrary classes for layout or design

The frontend sanitizes HTML before rendering:

- unsafe tags are removed
- unknown tags are unwrapped
- all attributes are removed except approved classes
- unapproved classes are removed

Allowed tags:

```text
section, div, span, h1, h2, h3, p, ul, ol, li,
table, thead, tbody, tr, th, td,
pre, code, strong, em, mark, br
```

Approved classes:

```text
highlight, muted, emphasis, danger, success
```

Use these classes only to express meaning, not layout.

Content sizing rule:

- The renderer lays out semantic HTML on a 1280x720 design surface.
- The full design surface scales to the visible 16:9 container.
- The renderer will auto-fit oversized semantic HTML by scaling content down inside that design surface.
- Do not depend on auto-fit for dense content.
- Keep tables short, usually 2-4 columns and 2-5 body rows.
- Keep headings and paragraphs concise.
- Split dense explanations into multiple scenes instead of one crowded scene.

Good HTML example:

```html
<section>
  <h1>HTTP Request</h1>
  <p>The browser creates a <mark>GET request</mark> for the page.</p>

  <table>
    <thead>
      <tr>
        <th>Part</th>
        <th>Example</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="highlight">Method</td>
        <td>GET</td>
      </tr>
      <tr>
        <td>Path</td>
        <td>/signup</td>
      </tr>
    </tbody>
  </table>
</section>
```

Bad HTML example:

```html
<section style="display:flex">
  <style>
    h1 { color: red; }
  </style>
  <h1 class="text-4xl grid-cols-2">HTTP Request</h1>
  <script>alert("no")</script>
</section>
```

The bad example will be sanitized and will not preserve styles, scripts, or unapproved classes.

## Code Scenes

Code scenes render syntax-highlighted code with line numbers. Use them instead of HTML for source code.

Shape:

```json
{
  "narration": "The nullish coalescing operator supplies a fallback name.",
  "code": {
    "language": "javascript",
    "title": "handler.js",
    "content": "export function handler(req, res) {\n  const name = req.query.name ?? 'world';\n  return res.json({ message: `Hello ${name}` });\n}",
    "focusLines": [2]
  }
}
```

Code properties:

- `content`: required string. The code or diff text to render.
- `language`: optional string. Examples: `javascript`, `typescript`, `tsx`, `html`, `css`, `json`, `bash`, `diff`. Defaults to `text`.
- `title`: optional string. Filename or short label shown above the code.
- `focusLines`: optional array of 1-based line numbers to highlight.
- `diff`: optional boolean. When true, lines starting with `+` are styled as additions and lines starting with `-` are styled as removals.
- `addedLines`: optional array of 1-based line numbers to style as additions.
- `removedLines`: optional array of 1-based line numbers to style as removals.

Diff example:

```json
{
  "narration": "The new branch handles Mermaid scenes before falling back to HTML.",
  "code": {
    "language": "diff",
    "title": "scene renderer diff",
    "diff": true,
    "content": "-  return semanticHtmlToDocument(scene.html ?? '');\n+  if (scene.code) {\n+    return codeToDocument(scene.code);\n+  }\n+\n+  return semanticHtmlToDocument(scene.html ?? '');",
    "focusLines": [2, 3]
  }
}
```

Code scenes are laid out on the same 1280x720 design surface and scale with the visible 16:9 container. Oversized snippets are scaled down inside the code frame. Keep snippets short enough to read; prefer focused excerpts over full files.

## Playback Behavior

Scenes are appended to the existing queue and are not cleared. Playback starts from the persisted current scene index. During playback, new scenes appended to the queue are played in order before playback ends.
