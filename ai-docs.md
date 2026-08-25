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
  "html": "<section><h1>Title</h1><p>Semantic HTML scene.</p></section>",
  "minDuration": 2000
}
```

```json
{
  "narration": "Speakable narration text.",
  "mermaid": "flowchart LR\n  A[Input] --> B[Output]",
  "minDuration": 2000
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
  },
  "minDuration": 3000
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
  "mermaid": "flowchart LR\n  A[Browser] --> B[Node API]\n  B --> C[SSE]\n  C --> D[Frontend]",
  "minDuration": 2500
}
```

Prefer simple diagrams. Use node classes and edge IDs when highlighting is needed.

Example:

```text
flowchart LR
  A[Browser] e1@--> B[Node API]
  B --> C[SSE]

  classDef active fill:#fde68a,stroke:#f59e0b,stroke-width:3px,color:#0f172a;
  class B active;
```

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
