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

Before authoring scenes, read the project rules in `/Users/anthonygore/Documents/ChatGPT/Code Explainer/ai-docs.md`.

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
- For HTML, use semantic tags only and approved classes from `ai-docs.md`.
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

Use the renderer's supported highlight mechanisms:

- Mermaid: approved classes from `ai-docs.md`, `class`, edge IDs, and `linkStyle` when edge focus is needed. Do not emit baseline `classDef` styling.
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
