---
name: explainvisually
description: Create visual explainer scenes using the local Code Explainer app. Use when the user asks to explain a topic, question, or code visually with this local renderer.
metadata:
  short-description: Build visual explainer scenes
---

# Explain Visually

Use the local Code Explainer app as the preview engine for short visual explanations.

Local services:

- Frontend: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8787`

Before authoring scenes, read the API and renderer contract in `/Users/anthonygore/Documents/ChatGPT/Code Explainer/api-docs.md`.

## Workflow

Turn the user's topic into a small ordered scene plan. Keep each scene focused on one idea.

## Structure

Before writing scenes, decide whether the explanation needs a title scene. For multi-part explanations, consider an opening agenda scene and brief section title scenes before each major idea.

Title and section-title scenes should orient the viewer, not explain the concept in detail. Use short narration such as "Let's learn about the web request-response loop." Move the actual explanation into later scenes.

For each scene:

- Write `narration` first.
- Choose one visual type:
  - `mermaid` for processes, relationships, state, and flow charts.
  - `html` for text, lists, definitions, comparisons, and tables.
  - `code` for short source excerpts, diffs, and line focus.
- Omit `minDuration` when narration is enough to set the scene duration. Use it only when extra silent reading time is needed.
- Prefer concise content over dense slides; the renderer scales oversized content down, which hurts readability.

Scene authoring rules:

- Do not write layout CSS.
- For HTML, use semantic tags only and approved classes from `api-docs.md`.
- For Mermaid, do not define baseline diagram styling. The frontend owns the Mermaid theme and approved focus classes.
- Use highlights sparingly to direct attention.
- Do not send more than one visual type in a scene unless the user explicitly asks for fallback behavior.

## Visual Continuity

When reusing a diagram, table, or code block across adjacent scenes, keep the underlying content structurally stable. Make the smallest possible change needed to express the new focus, usually only highlight metadata.

Treat these as different cases:

- Same visual, new focus: keep labels, ordering, wording, and layout stable; change only highlights.
- New visual state: content may change, but narration should make the transition clear.
- Different concept: use a new diagram, table, or code block.

## Focus Pass

After drafting scenes, review them once for attention cues. If a scene explains multiple steps or elements, split it into adjacent scenes that reuse the same visual while highlighting the active node, edge, table cell, word, or code line.

When splitting a scene only to move focus across visual elements, preserve the original narration as closely as possible. Split it into short fragments instead of expanding it. Fragments may be sentence fragments, phrases, or single words if that keeps the narration compact and aligned with the highlighted element.

Use the renderer's supported highlight mechanisms:

- Mermaid: approved classes from `api-docs.md`, `class`, edge IDs, and `linkStyle` when edge focus is needed. Do not emit baseline `classDef` styling.
- HTML: `mark` or approved classes such as `highlight`, `success`, and `danger`.
- Code: `focusLines`, `addedLines`, `removedLines`, and `diff`.

Before saving the payload, review reused visuals for accidental drift: unnecessary label changes, reordered nodes or rows, repeated styling blocks, or `minDuration` on narrated scenes.

## Preview

Save the exact scene payload in the project feedback directory before sending it:

- Directory: `/Users/anthonygore/Documents/ChatGPT/Code Explainer/generated-scenes/`
- Filename: use a timestamp and short topic slug, for example `2026-08-25-134500-web-request-response.json`.
- File shape: `{ "scenes": [...] }`.
- This directory is intentionally ignored by git so generated plans can be reviewed without polluting commits.

Before creating a new explanation, clear the existing preview queue:

```sh
curl -X POST http://127.0.0.1:8787/api/clear_scenes
```

Then send scenes to the preview queue:

```sh
curl -X POST http://127.0.0.1:8787/add_scene \
  -H 'content-type: application/json' \
  -d @/Users/anthonygore/Documents/ChatGPT/Code\ Explainer/generated-scenes/2026-08-25-134500-web-request-response.json
```

After loading scenes, report the saved JSON path to the user so they can use it for feedback.

Do not render videos. Rendering is a separate user-directed step after the user has reviewed the loaded scenes.

# Best practices

## Choosing a scene type

Use `mermaid` for diagrams where automatic layout matters: flows, relationships, state, timelines, and similar visuals.

Use `html` for explanatory text, lists, definitions, comparisons, and tables.

Use `code` for source code, config, terminal-like snippets, and diffs that need syntax highlighting or focused lines.

## Content density

Treat the 16:9 frame like a video canvas. Keep each scene focused on one main idea.

The renderer can scale oversized content down, but dense scaled content becomes hard to read. Keep tables short, usually 2-4 columns and 2-5 body rows. Keep headings and paragraphs concise. Split dense explanations into multiple scenes instead of one crowded scene.

For code, prefer focused excerpts over full files.

## Highlighting

Try to guide the viewer's attention and link what's on screen with what is being discussed. One way to do this is by highlighting.

For HTML, add the class `highlight` to the element that should be emphasized. Prefer highlighting the smallest useful element: a word, table cell, table row, list item, or short phrase. Do not add layout CSS.

```json
{
  "narration": "The path identifies the resource being requested.",
  "html": "<section><h1>HTTP Request</h1><table><thead><tr><th>Part</th><th>Example</th></tr></thead><tbody><tr><td>Method</td><td>GET</td></tr><tr><td class=\"highlight\">Path</td><td>/products/42</td></tr><tr><td>Headers</td><td>Accept: text/html</td></tr></tbody></table></section>"
}
```

For Mermaid flowcharts and graphs, add one of the approved focus classes to the node being discussed. Do not define `classDef` styling in the scene; the frontend supplies those styles.

```json
{
  "narration": "The browser starts by sending a request.",
  "mermaid": "flowchart LR\n  browser[Browser] --> server[Server]\n  server --> browser\n\n  class browser active;"
}
```

For code, use `focusLines` for the active line or lines. Use `addedLines`, `removedLines`, or `diff` when explaining a change.

```json
{
  "narration": "This line sends the JSON response.",
  "code": {
    "language": "javascript",
    "title": "handler.js",
    "content": "export function handler(request, response) {\n  const user = findUser(request.params.id);\n  return response.json(user);\n}",
    "focusLines": [3]
  }
}
```

Ideally the screen should have one obvious thing to focus on, so in most cases you should only highlight one thing per scene.

## Split scenes for focus

Ideally the screen should have one obvious thing to focus on. So what do you do when there is a lot of information on screen like in this example?

```json
{
  "narration": "The request describes what the browser wants. It includes a method like GET or POST, a path, headers, and sometimes a body.",
  "html": "<section><h1>HTTP Request</h1><table><thead><tr><th>Part</th><th>Example</th><th>Meaning</th></tr></thead><tbody><tr><td>Method</td><td>GET</td><td>Read a resource</td></tr><tr><td>Path</td><td>/products/42</td><td>Which resource</td></tr><tr><td>Headers</td><td>Accept: text/html</td><td>Browser metadata</td></tr><tr><td>Body</td><td>name=Ana</td><td>Data sent with POST</td></tr></tbody></table></section>"
}
```

You can split the scene on each focus change by changing the highlight. Be sure to preserve the original narration and repeat the same visual with only highlight changes.

```json
[
{
  "narration": "The request describes what the browser wants. It includes a ",
  "html": "<section><h1>HTTP Request</h1><table><thead><tr><th>Part</th><th>Example</th><th>Meaning</th></tr></thead><tbody><tr><td>Method</td><td>GET</td><td>Read a resource</td></tr><tr><td>Path</td><td>/products/42</td><td>Which resource</td></tr><tr><td>Headers</td><td>Accept: text/html</td><td>Browser metadata</td></tr><tr><td>Body</td><td>name=Ana</td><td>Data sent with POST</td></tr></tbody></table></section>"
},
{
  "narration": "method like GET or POST, ",
  "html": "<section><h1>HTTP Request</h1><table><thead><tr><th>Part</th><th>Example</th><th>Meaning</th></tr></thead><tbody><tr class=\"highlight\"><td>Method</td><td>GET</td><td>Read a resource</td></tr><tr><td>Path</td><td>/products/42</td><td>Which resource</td></tr><tr><td>Headers</td><td>Accept: text/html</td><td>Browser metadata</td></tr><tr><td>Body</td><td>name=Ana</td><td>Data sent with POST</td></tr></tbody></table></section>"
},
{
  "narration": "a path, ",
  "html": "<section><h1>HTTP Request</h1><table><thead><tr><th>Part</th><th>Example</th><th>Meaning</th></tr></thead><tbody><tr><td>Method</td><td>GET</td><td>Read a resource</td></tr><tr class=\"highlight\"><td>Path</td><td>/products/42</td><td>Which resource</td></tr><tr><td>Headers</td><td>Accept: text/html</td><td>Browser metadata</td></tr><tr><td>Body</td><td>name=Ana</td><td>Data sent with POST</td></tr></tbody></table></section>"
},
{
  "narration": "headers, ",
  "html": "<section><h1>HTTP Request</h1><table><thead><tr><th>Part</th><th>Example</th><th>Meaning</th></tr></thead><tbody><tr><td>Method</td><td>GET</td><td>Read a resource</td></tr><tr><td>Path</td><td>/products/42</td><td>Which resource</td></tr><tr class=\"highlight\"><td>Headers</td><td>Accept: text/html</td><td>Browser metadata</td></tr><tr><td>Body</td><td>name=Ana</td><td>Data sent with POST</td></tr></tbody></table></section>"
},
{
  "narration": "and sometimes a body.",
  "html": "<section><h1>HTTP Request</h1><table><thead><tr><th>Part</th><th>Example</th><th>Meaning</th></tr></thead><tbody><tr><td>Method</td><td>GET</td><td>Read a resource</td></tr><tr><td>Path</td><td>/products/42</td><td>Which resource</td></tr><tr><td>Headers</td><td>Accept: text/html</td><td>Browser metadata</td></tr><tr class=\"highlight\"><td>Body</td><td>name=Ana</td><td>Data sent with POST</td></tr></tbody></table></section>"
}
]
```
