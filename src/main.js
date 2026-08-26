import './styles.css';
import { blankScene, normalizeScene, sceneToDocument } from './scene-renderer.js';

const frame = document.querySelector('#scene-frame');
const previousButton = document.querySelector('#previous-button');
const playToggleButton = document.querySelector('#play-toggle-button');
const stopButton = document.querySelector('#stop-button');
const nextButton = document.querySelector('#next-button');
const status = document.querySelector('#scene-status');
const themeSelect = document.querySelector('#theme-select');

const state = {
  scenes: [],
  currentIndex: 0,
  activeTheme: localStorage.getItem('explain-visually-theme') || 'default',
  isPlaying: false,
  isPaused: false,
  activeUtterance: null,
  activeSceneToken: 0,
};

function clampIndex(index) {
  if (state.scenes.length === 0) return 0;
  return Math.min(Math.max(index, 0), state.scenes.length - 1);
}

async function renderScene(index) {
  if (state.scenes.length === 0) {
    frame.srcdoc = blankScene();
    updateStatus();
    return;
  }

  state.currentIndex = clampIndex(index);
  frame.srcdoc = await sceneToDocument(state.scenes[state.currentIndex], { theme: state.activeTheme });
  updateStatus();
  persistCurrentScene();
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
  themeSelect.value = state.activeTheme;
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
themeSelect.addEventListener('change', () => {
  state.activeTheme = themeSelect.value;
  localStorage.setItem('explain-visually-theme', state.activeTheme);
  void renderScene(state.currentIndex);
});

speechSynthesis.addEventListener('voiceschanged', pickDanielVoice);

loadInitialState()
  .catch(() => {
    void renderScene(0);
  })
  .finally(connectSceneStream);
