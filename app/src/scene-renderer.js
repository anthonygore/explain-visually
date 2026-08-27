import mermaid from 'mermaid';
import { codeToHtml } from 'shiki';
import {
  mermaidFocusClassDefs,
  mermaidThemeConfig,
  sceneTheme,
  sceneThemeCssVariables,
  shikiTheme,
} from './scene-theme.js';

const DEFAULT_MIN_DURATION = 2000;
const ALLOWED_HTML_TAGS = new Set([
  'SECTION',
  'DIV',
  'SPAN',
  'H1',
  'H2',
  'H3',
  'P',
  'UL',
  'OL',
  'LI',
  'TABLE',
  'THEAD',
  'TBODY',
  'TR',
  'TH',
  'TD',
  'PRE',
  'CODE',
  'STRONG',
  'EM',
  'MARK',
  'BR',
]);
const REMOVE_WITH_CONTENT_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'IFRAME', 'OBJECT', 'EMBED']);
const ALLOWED_HTML_CLASSES = new Set([
  'highlight',
  'muted',
  'emphasis',
  'danger',
  'success',
]);

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'strict',
  ...mermaidThemeConfig(),
});

export function normalizeScene(scene) {
  return {
    narration: scene.narration,
    html: scene.html,
    mermaid: scene.mermaid,
    code: scene.code,
    minDuration: Number.isFinite(scene.minDuration) && scene.minDuration >= 0
      ? scene.minDuration
      : DEFAULT_MIN_DURATION,
  };
}

export async function sceneToDocument(scene, options = {}) {
  const themeName = options.theme;

  if (typeof scene.mermaid === 'string') {
    return mermaidToDocument(scene.mermaid, themeName);
  }

  if (scene.code) {
    return codeToDocument(scene.code, themeName);
  }

  return semanticHtmlToDocument(scene.html ?? '', themeName);
}

async function mermaidToDocument(diagram, themeName) {
  const theme = sceneTheme(themeName);

  try {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      ...mermaidThemeConfig(theme),
    });
    const renderId = `mermaid-${crypto.randomUUID()}`;
    const { svg } = await mermaid.render(renderId, withMermaidFocusClasses(diagram, theme));
    return constrainHtml(`<main class="mermaid-scene">${svg}</main>`, mermaidSceneStyles(), '', theme);
  } catch (error) {
    return constrainHtml(
      `<main class="mermaid-error"><h1>Mermaid render error</h1><pre>${escapeHtml(error.message)}</pre></main>`,
      mermaidSceneStyles(),
      '',
      theme,
    );
  }
}

function withMermaidFocusClasses(diagram, theme) {
  if (!/^\s*(?:---[\s\S]*?---\s*)?(flowchart|graph)\b/i.test(diagram)) {
    return diagram;
  }

  return `${diagram.trimEnd()}

${mermaidFocusClassDefs(theme)}`;
}

async function codeToDocument(code, themeName) {
  const theme = sceneTheme(themeName);
  const codeHtml = await codeToHtml(code.content, {
    lang: code.language || 'text',
    theme: shikiTheme(theme),
    transformers: [codeLineTransformer(code)],
  });

  const title = code.title
    ? `<header class="code-scene-title">${escapeHtml(code.title)}</header>`
    : '';

  return constrainHtml(
    `<main class="code-scene">${title}<div class="code-frame">${codeHtml}</div></main>`,
    codeSceneStyles(),
    fitSceneScript('.code-scene', '.code-frame'),
    theme,
  );
}

function codeLineTransformer(code) {
  const focusLines = new Set(code.focusLines ?? []);
  const addedLines = new Set(code.addedLines ?? []);
  const removedLines = new Set(code.removedLines ?? []);

  return {
    line(node, lineNumber) {
      const lineText = extractText(node);
      const classes = ['code-line'];

      if (focusLines.has(lineNumber)) classes.push('is-focused');
      if (addedLines.has(lineNumber) || (code.diff && lineText.startsWith('+'))) classes.push('is-added');
      if (removedLines.has(lineNumber) || (code.diff && lineText.startsWith('-'))) classes.push('is-removed');

      node.properties.class = [
        ...new Set([...(node.properties.class ?? []), ...classes]),
      ];
      node.properties['data-line'] = String(lineNumber);
    },
  };
}

function extractText(node) {
  if (typeof node.value === 'string') return node.value;
  return (node.children ?? []).map(extractText).join('');
}

function constrainHtml(html, extraStyles = '', extraScript = '', theme = sceneTheme()) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html,
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: transparent;
      }

      *,
      *::before,
      *::after {
        box-sizing: border-box;
      }

      ${sceneThemeCssVariables(theme)}

      body {
        position: relative;
        contain: strict;
      }

      ${extraStyles}
    </style>
  </head>
  <body>${html}${extraScript}</body>
</html>`;
}

function fitSceneScript(sceneSelector, contentSelector) {
  return `
    <script>
      const SCENE_WIDTH = 1280;
      const SCENE_HEIGHT = 720;
      const SAFE_WIDTH = 1184;
      const SAFE_HEIGHT = 624;

      function fitScene() {
        const scene = document.querySelector('${sceneSelector}');
        const content = document.querySelector('${contentSelector}');
        if (!scene || !content) return;

        const sceneScale = Math.min(window.innerWidth / SCENE_WIDTH, window.innerHeight / SCENE_HEIGHT);
        scene.style.transform = 'translate(-50%, -50%) scale(' + sceneScale + ')';

        content.style.transform = 'translate(-50%, -50%) scale(1)';
        content.style.width = '1040px';

        const contentWidth = content.scrollWidth;
        const contentHeight = content.scrollHeight;

        if (!contentWidth || !contentHeight) return;

        const contentScale = Math.min(1, SAFE_WIDTH / contentWidth, SAFE_HEIGHT / contentHeight);
        content.style.transform = 'translate(-50%, -50%) scale(' + contentScale + ')';
      }

      window.addEventListener('load', fitScene);
      window.addEventListener('resize', fitScene);
      requestAnimationFrame(fitScene);
      requestAnimationFrame(() => requestAnimationFrame(fitScene));
      setTimeout(fitScene, 100);
    </script>
  `;
}

function semanticHtmlToDocument(html, themeName) {
  const theme = sceneTheme(themeName);

  return constrainHtml(
    `<main class="semantic-scene-fit"><div class="semantic-scene-content">${sanitizeSemanticHtml(html)}</div></main>`,
    semanticSceneStyles(),
    semanticSceneScript(),
    theme,
  );
}

function sanitizeSemanticHtml(html) {
  const document = new DOMParser().parseFromString(`<template>${html}</template>`, 'text/html');
  const template = document.querySelector('template');
  const fragment = template.content;

  sanitizeNode(fragment);

  return template.innerHTML;
}

function sanitizeNode(parent) {
  for (const node of [...parent.childNodes]) {
    if (node.nodeType === Node.COMMENT_NODE) {
      node.remove();
      continue;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    if (REMOVE_WITH_CONTENT_TAGS.has(node.tagName)) {
      node.remove();
      continue;
    }

    if (!ALLOWED_HTML_TAGS.has(node.tagName)) {
      unwrapNode(node);
      continue;
    }

    sanitizeAttributes(node);
    sanitizeNode(node);
  }
}

function unwrapNode(node) {
  const parent = node.parentNode;
  if (!parent) return;

  while (node.firstChild) {
    parent.insertBefore(node.firstChild, node);
  }

  node.remove();
  sanitizeNode(parent);
}

function sanitizeAttributes(node) {
  const allowedClasses = (node.getAttribute('class') ?? '')
    .split(/\s+/)
    .filter((className) => ALLOWED_HTML_CLASSES.has(className));

  for (const attribute of [...node.attributes]) {
    node.removeAttribute(attribute.name);
  }

  if (allowedClasses.length > 0) {
    node.setAttribute('class', [...new Set(allowedClasses)].join(' '));
  }
}

function semanticSceneStyles() {
  return `
      body {
        color: var(--scene-color-text);
        background: var(--scene-color-surface);
        font-family: var(--scene-font-sans);
      }

      .semantic-scene-fit {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 1280px;
        height: 720px;
        padding: 48px;
        overflow: hidden;
        transform-origin: center center;
      }

      .semantic-scene-content {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 1040px;
        transform-origin: center center;
      }

      section,
      div {
        max-width: 100%;
      }

      section {
        display: grid;
        align-content: center;
        gap: 24px;
        width: 100%;
      }

      h1,
      h2,
      h3,
      p,
      ul,
      ol,
      pre,
      table {
        margin: 0;
      }

      h1 {
        font-size: 52px;
        line-height: 1.05;
        font-weight: 780;
      }

      h2 {
        font-size: 40px;
        line-height: 1.1;
        font-weight: 740;
      }

      h3 {
        font-size: 28px;
        line-height: 1.18;
        font-weight: 700;
      }

      p,
      li,
      td,
      th {
        font-size: 24px;
        line-height: 1.35;
      }

      ul,
      ol {
        display: grid;
        gap: 12px;
        padding-left: 1.2em;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        overflow: hidden;
        border: var(--scene-stroke-width) solid var(--scene-color-border);
        border-radius: var(--scene-radius);
        background: var(--scene-color-panel);
      }

      th,
      td {
        padding: 14px 16px;
        border-bottom: var(--scene-stroke-width) solid var(--scene-color-border-subtle);
        text-align: left;
        vertical-align: top;
      }

      tr:last-child th,
      tr:last-child td {
        border-bottom: 0;
      }

      th {
        color: var(--scene-color-text);
        background: var(--scene-color-panel-alt);
        font-weight: 720;
      }

      pre {
        max-width: 100%;
        padding: 20px;
        overflow: auto;
        border: var(--scene-stroke-width) solid var(--scene-color-border);
        border-radius: var(--scene-radius);
        color: var(--scene-color-text-inverse);
        background: var(--scene-color-code-surface);
      }

      code,
      pre {
        font-family: var(--scene-font-mono);
      }

      code {
        font-size: 0.86em;
      }

      pre code {
        font-size: 18px;
        line-height: 1.45;
      }

      mark,
      .highlight {
        color: var(--scene-color-text);
        background: var(--scene-color-focus);
        box-shadow: inset 0 -0.18em 0 var(--scene-color-focus-strong);
      }

      td.highlight,
      th.highlight {
        background: var(--scene-color-focus);
      }

      .muted {
        color: var(--scene-color-muted);
      }

      .emphasis {
        color: var(--scene-color-text);
        font-weight: 760;
      }

      .danger {
        color: var(--scene-color-danger-text);
        background: var(--scene-color-danger-soft);
      }

      .success {
        color: var(--scene-color-success-text);
        background: var(--scene-color-success-soft);
      }
  `;
}

function semanticSceneScript() {
  return fitSceneScript('.semantic-scene-fit', '.semantic-scene-content');
}

function codeSceneStyles() {
  return `
      body {
        color: var(--scene-color-text-inverse);
        background: var(--scene-color-code-page);
        font-family: var(--scene-font-sans);
      }

      .code-scene {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 1280px;
        height: 720px;
        padding: 48px;
        overflow: hidden;
        transform-origin: center center;
      }

      .code-scene-title {
        position: absolute;
        top: 24px;
        left: 48px;
        right: 48px;
        color: var(--scene-color-muted-inverse);
        font-size: 18px;
        line-height: 1.2;
        font-weight: 650;
      }

      .code-frame {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 1040px;
        overflow: hidden;
        border: var(--scene-stroke-width) solid var(--scene-color-border-inverse);
        border-radius: var(--scene-radius);
        background: var(--scene-color-code-surface);
        box-shadow: var(--scene-shadow);
        transform-origin: center center;
      }

      .code-frame pre {
        margin: 0 !important;
        padding: 22px 0 !important;
        overflow: visible !important;
        background: transparent !important;
      }

      .code-frame code {
        display: grid;
        font-family: var(--scene-font-mono);
        font-size: 20px;
        line-height: 1.5;
      }

      .code-line {
        display: block;
        min-height: 1.5em;
        padding: 0 24px 0 72px;
        position: relative;
        white-space: pre;
      }

      .code-line::before {
        content: attr(data-line);
        position: absolute;
        left: 24px;
        width: 30px;
        color: var(--scene-color-muted-inverse);
        text-align: right;
      }

      .code-line.is-focused {
        background: color-mix(in srgb, var(--scene-color-focus) 22%, transparent);
        box-shadow: inset 4px 0 0 var(--scene-color-focus-strong);
      }

      .code-line.is-added {
        background: color-mix(in srgb, var(--scene-color-success) 22%, transparent);
      }

      .code-line.is-added::before {
        color: var(--scene-color-success-soft);
      }

      .code-line.is-removed {
        background: color-mix(in srgb, var(--scene-color-danger) 22%, transparent);
      }

      .code-line.is-removed::before {
        color: var(--scene-color-danger-soft);
      }
  `;
}

function mermaidSceneStyles() {
  return `
      .mermaid-scene {
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
        padding: 40px;
        background: var(--scene-color-surface);
      }

      .mermaid-scene svg {
        width: 100%;
        max-width: 100%;
        height: 100%;
        max-height: 100%;
      }

      .mermaid-error {
        width: 100%;
        height: 100%;
        padding: 32px;
        overflow: auto;
        color: var(--scene-color-danger-text);
        background: var(--scene-color-danger-soft);
        font-family: var(--scene-font-mono);
      }

      .mermaid-error h1 {
        margin: 0 0 16px;
        font: 700 24px/1.2 system-ui, sans-serif;
      }

      .mermaid-error pre {
        white-space: pre-wrap;
      }
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function blankScene() {
  return constrainHtml('<div></div>');
}
