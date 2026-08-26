---
name: explainvisually
description: Create visual explainer scenes using the local Code Explainer app. Use when the user asks to explain a topic, question, or code visually with this local renderer.
metadata:
  short-description: Build visual explainer scenes
  version: 2026-08-26-1315
---

# Explain Visually

Use the local Code Explainer app as the preview engine for short visual explanations.

Local services:

- Frontend: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8787`

Before authoring scenes, read the API and renderer contract in `api-docs.md` in this skill directory.

## Purpose

Turn the user's topic into a small ordered scene plan that will be rendered as a visual explainer. 

Since this will be a video-like presentation, keep the content terse and simple.

The main artifact you will create is a JSON scene plan.


## Process

1. Write the narration
2. Create the visuals
3. Insert titles (optional)
4. Split scenes for focus
5. Review
6. Save plan
7. Load plan
8. Report

### 1. Write the narration

Write the narration first. The narration should satisfy the user's topic.

Rules:

- Always do this fresh i.e. don't refer to previous runs of this skill (unless the user asks you to) or preivously generated plans.
- Be as concise as possible and use simple language where possible.
- The narration will be read aloud, so do not include anything that cannot be used in TTS e.g. URLs.
- The total length should be between 50 to 2000 words.

### 2. Create the visuals

Now split the narration into scenes. Each scene should be one concise idea that has an obvious visual component.

Choose one visual type:

- `mermaid` for processes, relationships, state, and flow charts.
- `html` for text, lists, definitions, comparisons, and tables.
- `code` for short source excerpts, diffs, and line focus.

### 3. Insert titles

If there are multiple, distinct, sections in the explanation, it may be necessary break it into sections. This is strictly optional and should not be done if the draft is clearly a single continuous idea. A good rule of thumb: if this were an article, would it have headings?

The best way to do this is insert title scenes before each section.

```json
{
  "html": "<section><h1>1. Request</h1></section>",
  "minDuration": 2000
}
```

Then insert an agenda scene at the beginning.

```json
{
  "narration": "We'll cover the request, the server, and the response.",
  "html": "<section><h1>Request-response loop</h1><ol><li>Request</li><li>Server</li><li>Response</li></ol></section>"
}
```

### 4. Split scenes for focus

As per step 2, scenes will generally be based around one idea. 

But, ideally the screen should have one obvious thing to focus on. So we may need to split the scene in order to manage visual focus better.

For example, consider this scene where there is a lengthy narration and a lot on screen.

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

Indicators that a scene should be split:

- The narration explains multiple steps or elements
- The narration is longer than 20 words
- There is dense information on screen

Use the renderer's supported highlight mechanisms:

- Mermaid: approved classes from `api-docs.md`, `class`, edge IDs, and `linkStyle` when edge focus is needed. Do not emit baseline `classDef` styling.
- HTML: `mark` or approved classes such as `highlight`, `success`, and `danger`.
- Code: `focusLines`, `addedLines`, `removedLines`, and `diff`.

### 5. Review

Before completion, do another pass over the plan to review it.

The main things to look for and fix:

- Ensure narration contains only speakable words
- After scenes have been split, review reused visuals for accidental drift: unnecessary label changes, reordered nodes or rows, repeated styling blocks.
- Omit `minDuration` when there is narration unless extra silent reading time is needed. Use `minDuration` for scenes with no narration.
- Do not write layout CSS.
- For HTML, use semantic tags only and approved classes from `api-docs.md`.
- For Mermaid, do not define baseline diagram styling. The frontend owns the Mermaid theme and approved focus classes.
- Do not send more than one visual type in a scene unless the user explicitly asks for fallback behavior.
- Ensure the final payload shape is `{ "version": "<metadata.version>", "scenes": [...] }`, using the `metadata.version` value from this skill.

### 6. Save plan

If this is run in a local workspace, save the exact scene payload before sending it:

- Directory: `generated-scenes/` in the current workspace. Create it if the workspace is writable.
- Filename: use a timestamp and short topic slug, for example `2026-08-25-134500-web-request-response.json`.
- File shape: `{ "version": "<metadata.version>", "scenes": [...] }`, using the `metadata.version` value from this skill.
- If no writable workspace is available, skip saving and say that no local plan file was written.

### 7. Load plan

Stop after loading scenes. Do not call `/render`; rendering is a separate user-directed step after the user has reviewed the loaded scenes.

Before creating a new explanation, clear the existing preview queue:

```sh
curl -X POST http://127.0.0.1:8787/api/clear_scenes
```

Then send scenes to the preview queue:

```sh
curl -X POST http://127.0.0.1:8787/add_scene \
  -H 'content-type: application/json' \
  -d @generated-scenes/2026-08-25-134500-web-request-response.json
```

After loading scenes, report the saved JSON path to the user so they can use it for feedback.

### 8. Report

Once complete, report on:

- success or failure
- the saved plan file
- the frontend URL

## Best practices

### Titles

Title and section-title scenes should orient the viewer, not explain the concept in detail. Use short narration such as "Let's learn about the web request-response loop." Move the actual explanation into later scenes.

### Content density

Generally we don't want too much in a scene.

Firstly, it can be hard to read. Treat the 16:9 frame like a video canvas. The renderer can scale oversized content down, but dense scaled content becomes hard to read. 

More importantly, viewer's can generally only focus on one thing at a time. So keep each scene focused on one main idea. 

Guidelines for density based on content:

- Tables: usually 2-4 columns and 2-5 body rows. 
- Keep headings and paragraphs concise. 
- Diagrams should probably only have 2-8 nodes.
- For code, prefer focused excerpts over full files.

If you need more than this, the answer is usually to split dense explanations into multiple scenes instead of one crowded scene. 

### Relationship between narration and scene

[TBA]

#### Text

With text, don't simply print the narration to screen. The exception to this is when you have a concise key message or takeaway, or an important definition.

Good - an important message can have matching text and narration
Good - a heading can be read aloud
Good - the narration has the key message, the text just focuses on the important part

Bad - the narration is simply duplicating text on screen
Bad - the narration and text are completely different

### Visual continuity

When reusing a diagram, table, or code block across adjacent scenes, keep the underlying content structurally stable. Make the smallest possible change needed to express the new focus, usually only highlight metadata.

Treat these as different cases:

- Same visual, new focus: keep labels, ordering, wording, and layout stable; change only highlights.
- New visual state: content may change, but narration should make the transition clear.
- Different concept: use a new diagram, table, or code block.

### Focus attention

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
