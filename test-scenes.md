# Test Scenes

Use this document to replay representative scenes after renderer changes. The payload covers Mermaid diagrams, semantic HTML, syntax-highlighted code, and highlighting states.

Load all scenes:

```sh
curl -X POST http://127.0.0.1:8787/add_scene \
  -H 'content-type: application/json' \
  -d @test-scenes.json
```

If you want to keep this as Markdown-only, copy the JSON body below and POST it to `/add_scene`.

```json
{
  "scenes": [
    {
      "narration": "This Mermaid scene shows the scene ingestion flow. The API receives the payload, broadcasts it with server sent events, and the browser renders the scene.",
      "mermaid": "flowchart LR\n  A[Agent] --> B[POST /add_scene]\n  B e1@--> C[Node API cache]\n  C --> D[SSE stream]\n  D --> E[Browser player]\n\n  classDef active fill:#fde68a,stroke:#f59e0b,stroke-width:3px,color:#0f172a;\n  class C active;\n  linkStyle 1 stroke:#f59e0b,stroke-width:4px;",
      "minDuration": 3000
    },
    {
      "narration": "This semantic HTML scene tests headings, paragraphs, a highlighted word, approved classes, and table-cell highlighting. The renderer owns the layout and strips unsupported styles.",
      "html": "<section><h1>Semantic HTML Contract</h1><p>Agents provide <mark>meaning</mark>, not layout. The renderer controls sizing, spacing, and typography.</p><table><thead><tr><th>Input</th><th>Rule</th><th>Result</th></tr></thead><tbody><tr><td class=\"highlight\">style attribute</td><td>Not allowed</td><td>Removed</td></tr><tr><td class=\"emphasis\">approved classes</td><td>Allowed for meaning</td><td class=\"success\">Kept</td></tr><tr><td>unknown classes</td><td>Not allowed</td><td class=\"danger\">Removed</td></tr></tbody></table></section>",
      "minDuration": 3500
    },
    {
      "narration": "This code scene focuses line six, where the server appends accepted scenes before broadcasting them.",
      "code": {
        "language": "javascript",
        "title": "server.mjs",
        "content": "if (request.method === 'POST' && url.pathname === '/add_scene') {\n  try {\n    const payload = await readJson(request);\n    const acceptedScenes = extractScenes(payload);\n    scenes.push(...acceptedScenes);\n    broadcast('scene', { scenes: acceptedScenes });\n    sendJson(response, 200, { ok: true });\n  } catch (error) {\n    sendJson(response, 400, { ok: false, error: error.message });\n  }\n}",
        "focusLines": [6]
      },
      "minDuration": 3500
    },
    {
      "narration": "This diff scene tests addition and removal highlighting. The new code scene branch is highlighted as the important change.",
      "code": {
        "language": "diff",
        "title": "scene renderer diff",
        "diff": true,
        "content": "-  return semanticHtmlToDocument(scene.html ?? '');\n+  if (scene.code) {\n+    return codeToDocument(scene.code);\n+  }\n+\n+  return semanticHtmlToDocument(scene.html ?? '');",
        "focusLines": [2, 3]
      },
      "minDuration": 3500
    },
    {
      "narration": "This dense HTML scene tests auto-fit. It should remain visible inside the sixteen by nine canvas, although it may become smaller and harder to read.",
      "html": "<section><h1>Auto-fit Stress Test</h1><p class=\"muted\">This intentionally crowded scene should scale down instead of clipping.</p><table><thead><tr><th>Scene type</th><th>Best for</th><th>Highlight method</th><th>Failure mode</th></tr></thead><tbody><tr><td>Mermaid</td><td>Automatic diagram layout</td><td>classDef, class, linkStyle</td><td>Overly complex graphs get tiny</td></tr><tr><td>HTML</td><td>Text, tables, lists</td><td>mark or approved classes</td><td>Dense content scales down</td></tr><tr><td>Code</td><td>Source and diffs</td><td>focusLines, diff, addedLines</td><td>Long files become unreadable</td></tr><tr><td>Playback</td><td>Ordered narration</td><td>Current scene index</td><td>Too much narration slows review</td></tr><tr><td>Agents</td><td>Scene generation</td><td class=\"highlight\">Semantic intent only</td><td>Layout instructions are ignored</td></tr></tbody></table></section>",
      "minDuration": 4000
    }
  ]
}
```

## Coverage

- Mermaid flowchart with highlighted node and edge.
- Semantic HTML with `mark`, `highlight`, `emphasis`, `success`, and `danger`.
- Code scene with syntax highlighting and `focusLines`.
- Diff scene with addition/removal styling and focused changed lines.
- Dense semantic HTML scene for auto-fit regression checks.
