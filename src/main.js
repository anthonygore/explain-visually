import './styles.css';
import mermaid from 'mermaid';
import { codeToHtml } from 'shiki';

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
  theme: 'default',
});

const frame = document.querySelector('#scene-frame');
const previousButton = document.querySelector('#previous-button');
const playToggleButton = document.querySelector('#play-toggle-button');
const stopButton = document.querySelector('#stop-button');
const nextButton = document.querySelector('#next-button');
const status = document.querySelector('#scene-status');

const state = {
  scenes: [],
  currentIndex: 0,
  isPlaying: false,
  isPaused: false,
  activeUtterance: null,
  activeSceneToken: 0,
};

function clampIndex(index) {
  if (state.scenes.length === 0) return 0;
  return Math.min(Math.max(index, 0), state.scenes.length - 1);
}

function normalizeScene(scene) {
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

async function renderScene(index) {
  if (state.scenes.length === 0) {
    frame.srcdoc = blankScene();
    updateStatus();
    return;
  }

  state.currentIndex = clampIndex(index);
  frame.srcdoc = await sceneToDocument(state.scenes[state.currentIndex]);
  updateStatus();
  persistCurrentScene();
}

async function sceneToDocument(scene) {
  if (typeof scene.mermaid === 'string') {
    return mermaidToDocument(scene.mermaid);
  }

  if (scene.code) {
    return codeToDocument(scene.code);
  }

  return semanticHtmlToDocument(scene.html ?? '');
}

async function mermaidToDocument(diagram) {
  try {
    const renderId = `mermaid-${crypto.randomUUID()}`;
    const { svg } = await mermaid.render(renderId, diagram);
    return constrainHtml(`<main class="mermaid-scene">${svg}</main>`, mermaidSceneStyles());
  } catch (error) {
    return constrainHtml(
      `<main class="mermaid-error"><h1>Mermaid render error</h1><pre>${escapeHtml(error.message)}</pre></main>`,
      mermaidSceneStyles(),
    );
  }
}

async function codeToDocument(code) {
  const codeHtml = await codeToHtml(code.content, {
    lang: code.language || 'text',
    theme: 'github-dark',
    transformers: [codeLineTransformer(code)],
  });

  const title = code.title
    ? `<header class="code-scene-title">${escapeHtml(code.title)}</header>`
    : '';

  return constrainHtml(
    `<main class="code-scene">${title}<div class="code-frame">${codeHtml}</div></main>`,
    codeSceneStyles(),
    fitSceneScript('.code-scene', '.code-frame'),
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

function constrainHtml(html, extraStyles = '', extraScript = '') {
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

function semanticHtmlToDocument(html) {
  return constrainHtml(
    `<main class="semantic-scene-fit"><div class="semantic-scene-content">${sanitizeSemanticHtml(html)}</div></main>`,
    semanticSceneStyles(),
    semanticSceneScript(),
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
        color: #18202a;
        background: #f7fafc;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
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
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        background: #ffffff;
      }

      th,
      td {
        padding: 14px 16px;
        border-bottom: 1px solid #e2e8f0;
        text-align: left;
        vertical-align: top;
      }

      tr:last-child th,
      tr:last-child td {
        border-bottom: 0;
      }

      th {
        color: #0f172a;
        background: #e8edf4;
        font-weight: 720;
      }

      pre {
        max-width: 100%;
        padding: 20px;
        overflow: auto;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        color: #f8fafc;
        background: #17202a;
      }

      code,
      pre {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
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
        color: #0f172a;
        background: #fde68a;
        box-shadow: inset 0 -0.18em 0 #f59e0b;
      }

      td.highlight,
      th.highlight {
        background: #fef3c7;
      }

      .muted {
        color: #64748b;
      }

      .emphasis {
        color: #0f172a;
        font-weight: 760;
      }

      .danger {
        color: #991b1b;
        background: #fee2e2;
      }

      .success {
        color: #166534;
        background: #dcfce7;
      }
  `;
}

function semanticSceneScript() {
  return fitSceneScript('.semantic-scene-fit', '.semantic-scene-content');
}

function codeSceneStyles() {
  return `
      body {
        color: #dbe5ee;
        background: #0f1419;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
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
        color: #a7b4c2;
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
        border: 1px solid #2b3642;
        border-radius: 8px;
        background: #0d1117;
        box-shadow: 0 24px 70px rgb(0 0 0 / 0.32);
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
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
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
        color: #6e7681;
        text-align: right;
      }

      .code-line.is-focused {
        background: rgb(251 191 36 / 0.18);
        box-shadow: inset 4px 0 0 #f59e0b;
      }

      .code-line.is-added {
        background: rgb(22 163 74 / 0.2);
      }

      .code-line.is-added::before {
        color: #86efac;
      }

      .code-line.is-removed {
        background: rgb(220 38 38 / 0.2);
      }

      .code-line.is-removed::before {
        color: #fca5a5;
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
        background: #f7fafc;
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
        color: #7f1d1d;
        background: #fff1f2;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
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

function blankScene() {
  return constrainHtml('<div></div>');
}

function updateStatus() {
  const current = state.scenes.length === 0 ? 0 : state.currentIndex + 1;
  status.textContent = `${current} / ${state.scenes.length}`;
  previousButton.disabled = state.scenes.length === 0 || state.currentIndex <= 0;
  playToggleButton.disabled = state.scenes.length === 0;
  stopButton.disabled = !state.isPlaying && state.currentIndex === 0;
  nextButton.disabled = state.scenes.length === 0 || state.currentIndex >= state.scenes.length - 1;
  playToggleButton.setAttribute('aria-label', state.isPlaying && !state.isPaused ? 'Pause' : 'Play');
  playToggleButton.classList.toggle('is-playing', state.isPlaying && !state.isPaused);
}

async function persistCurrentScene() {
  try {
    await fetch('/api/current_scene', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentIndex: state.currentIndex }),
    });
  } catch {
    // Playback remains local if the prototype server is temporarily unavailable.
  }
}

function pickDanielVoice() {
  const voices = speechSynthesis.getVoices();
  return voices.find((voice) => voice.name === 'Daniel')
    ?? voices.find((voice) => voice.name.toLowerCase().includes('daniel'))
    ?? null;
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForMinDuration(ms, token) {
  let elapsed = 0;
  let previousTick = performance.now();

  while (elapsed < ms && state.activeSceneToken === token && state.isPlaying) {
    await sleep(Math.min(100, ms - elapsed));

    const now = performance.now();
    if (!state.isPaused) {
      elapsed += now - previousTick;
    }
    previousTick = now;
  }
}

function speak(text, token) {
  const trimmedText = text.trim();
  if (!trimmedText) return Promise.resolve();

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(trimmedText);
    const voice = pickDanielVoice();

    if (voice) utterance.voice = voice;

    utterance.onend = resolve;
    utterance.onerror = resolve;
    state.activeUtterance = utterance;
    speechSynthesis.speak(utterance);
  }).then(() => {
    if (state.activeSceneToken === token) {
      state.activeUtterance = null;
    }
  });
}

async function playCurrentScene() {
  if (!state.isPlaying || state.currentIndex >= state.scenes.length) {
    finishPlayback();
    return;
  }

  const token = ++state.activeSceneToken;
  const scene = state.scenes[state.currentIndex];
  await renderScene(state.currentIndex);

  await Promise.all([
    waitForMinDuration(scene.minDuration, token),
    speak(scene.narration, token),
  ]);

  if (!state.isPlaying || state.isPaused || state.activeSceneToken !== token) return;

  if (state.currentIndex + 1 < state.scenes.length) {
    state.currentIndex += 1;
    playCurrentScene();
    return;
  }

  finishPlayback();
}

function startPlayback() {
  if (state.scenes.length === 0 || state.isPlaying) return;
  state.isPlaying = true;
  state.isPaused = false;
  state.currentIndex = clampIndex(state.currentIndex);
  updateStatus();
  playCurrentScene();
}

function togglePlayback() {
  if (!state.isPlaying) {
    startPlayback();
    return;
  }

  if (state.isPaused) {
    state.isPaused = false;
    speechSynthesis.resume();
    updateStatus();
    return;
  }

  state.isPaused = true;
  speechSynthesis.pause();
  updateStatus();
}

function stopPlayback() {
  cancelActivePlayback();
  state.currentIndex = 0;
  renderScene(state.currentIndex);
  updateStatus();
}

function finishPlayback() {
  cancelActivePlayback();
  renderScene(0);
  updateStatus();
}

function cancelActivePlayback() {
  state.isPlaying = false;
  state.isPaused = false;
  state.activeSceneToken += 1;
  speechSynthesis.cancel();
  state.activeUtterance = null;
}

async function stepScene(delta) {
  if (state.scenes.length === 0) return;

  const nextIndex = clampIndex(state.currentIndex + delta);
  if (nextIndex === state.currentIndex) return;

  cancelActivePlayback();
  await renderScene(nextIndex);
  updateStatus();
}

async function addScenes(scenes) {
  const previousCount = state.scenes.length;
  state.scenes.push(...scenes.map(normalizeScene));

  if (previousCount === 0) {
    await renderScene(0);
  } else {
    updateStatus();
  }

  if (state.isPlaying && !state.isPaused && state.currentIndex === previousCount - 1) {
    updateStatus();
  }
}

async function loadInitialState() {
  const response = await fetch('/api/scenes');
  if (!response.ok) throw new Error('Unable to load scenes');
  const payload = await response.json();

  state.scenes = payload.scenes.map(normalizeScene);
  state.currentIndex = clampIndex(payload.currentIndex ?? 0);
  await renderScene(state.currentIndex);
}

function connectSceneStream() {
  const events = new EventSource('/api/events');

  events.addEventListener('scene', async (event) => {
    const payload = JSON.parse(event.data);
    await addScenes(Array.isArray(payload.scenes) ? payload.scenes : [payload.scene]);
  });

  events.addEventListener('sync', async (event) => {
    const payload = JSON.parse(event.data);
    state.scenes = payload.scenes.map(normalizeScene);
    state.currentIndex = clampIndex(payload.currentIndex ?? state.currentIndex);
    await renderScene(state.currentIndex);
  });

  events.addEventListener('current_scene', async (event) => {
    if (state.isPlaying) return;

    const payload = JSON.parse(event.data);
    const nextIndex = clampIndex(payload.currentIndex ?? state.currentIndex);
    if (nextIndex === state.currentIndex) return;

    await renderScene(nextIndex);
  });
}

previousButton.addEventListener('click', () => {
  void stepScene(-1);
});
playToggleButton.addEventListener('click', togglePlayback);
stopButton.addEventListener('click', stopPlayback);
nextButton.addEventListener('click', () => {
  void stepScene(1);
});

speechSynthesis.addEventListener('voiceschanged', pickDanielVoice);

loadInitialState()
  .catch(() => {
    void renderScene(0);
  })
  .finally(connectSceneStream);
