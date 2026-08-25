import './styles.css';

const DEFAULT_MIN_DURATION = 2000;

const frame = document.querySelector('#scene-frame');
const playToggleButton = document.querySelector('#play-toggle-button');
const stopButton = document.querySelector('#stop-button');
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
    minDuration: Number.isFinite(scene.minDuration) && scene.minDuration >= 0
      ? scene.minDuration
      : DEFAULT_MIN_DURATION,
  };
}

function renderScene(index) {
  if (state.scenes.length === 0) {
    frame.srcdoc = blankScene();
    updateStatus();
    return;
  }

  state.currentIndex = clampIndex(index);
  frame.srcdoc = constrainHtml(state.scenes[state.currentIndex].html);
  updateStatus();
  persistCurrentScene();
}

function constrainHtml(html) {
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
    </style>
  </head>
  <body>${html}</body>
</html>`;
}

function blankScene() {
  return constrainHtml('<div></div>');
}

function updateStatus() {
  const current = state.scenes.length === 0 ? 0 : state.currentIndex + 1;
  status.textContent = `${current} / ${state.scenes.length}`;
  playToggleButton.disabled = state.scenes.length === 0;
  stopButton.disabled = !state.isPlaying && state.currentIndex === 0;
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
  renderScene(state.currentIndex);

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
  state.isPlaying = false;
  state.isPaused = false;
  state.activeSceneToken += 1;
  speechSynthesis.cancel();
  state.activeUtterance = null;
  state.currentIndex = 0;
  renderScene(state.currentIndex);
  updateStatus();
}

function finishPlayback() {
  state.isPlaying = false;
  state.isPaused = false;
  state.activeSceneToken += 1;
  speechSynthesis.cancel();
  state.activeUtterance = null;
  renderScene(0);
  updateStatus();
}

function addScenes(scenes) {
  const previousCount = state.scenes.length;
  state.scenes.push(...scenes.map(normalizeScene));

  if (previousCount === 0) {
    renderScene(0);
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
  renderScene(state.currentIndex);
}

function connectSceneStream() {
  const events = new EventSource('/api/events');

  events.addEventListener('scene', (event) => {
    const payload = JSON.parse(event.data);
    addScenes(Array.isArray(payload.scenes) ? payload.scenes : [payload.scene]);
  });

  events.addEventListener('sync', (event) => {
    const payload = JSON.parse(event.data);
    state.scenes = payload.scenes.map(normalizeScene);
    state.currentIndex = clampIndex(payload.currentIndex ?? state.currentIndex);
    renderScene(state.currentIndex);
  });
}

playToggleButton.addEventListener('click', togglePlayback);
stopButton.addEventListener('click', stopPlayback);

speechSynthesis.addEventListener('voiceschanged', pickDanielVoice);

loadInitialState()
  .catch(() => {
    renderScene(0);
  })
  .finally(connectSceneStream);
