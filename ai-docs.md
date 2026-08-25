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
- `html`: optional string. Semantic scene markup. Required if `mermaid` is not provided.
- `mermaid`: optional string. Mermaid diagram source. Required if `html` is not provided.
- `minDuration`: optional non-negative number in milliseconds. Defaults to `2000`.

Do not send both `html` and `mermaid` unless you intend the frontend to prefer `mermaid`.

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

Use `html` for text, lists, tables, code snippets, headings, and mixed explanatory content.

All rendered scenes sit inside a fixed 16:9 frame. Semantic HTML scenes are automatically scaled down when their content would overflow the frame. This prevents clipping, but small scaled content can become hard to read. Prefer concise scenes with one main idea, short tables, and limited text.

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

- The renderer will auto-fit oversized semantic HTML by scaling it down.
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

## Playback Behavior

Scenes are appended to the existing queue and are not cleared. Playback starts from the persisted current scene index. During playback, new scenes appended to the queue are played in order before playback ends.
