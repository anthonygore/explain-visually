import { normalizeScene, sceneToDocument } from './scene-renderer.js';

const frame = document.querySelector('#render-frame');

Object.assign(document.documentElement.style, {
  width: '100%',
  height: '100%',
  margin: '0',
  background: '#ffffff',
});

Object.assign(document.body.style, {
  width: '100%',
  height: '100%',
  margin: '0',
  overflow: 'hidden',
  background: '#ffffff',
});

Object.assign(frame.style, {
  display: 'block',
  width: '1280px',
  height: '720px',
  border: '0',
  background: '#ffffff',
});

function waitForFrameLoad() {
  return new Promise((resolve) => {
    frame.addEventListener('load', resolve, { once: true });
  });
}

async function loadRenderScene() {
  const params = new URLSearchParams(window.location.search);
  const renderId = params.get('renderId');
  const sceneIndex = Number(params.get('scene') ?? 0);

  if (!renderId || !Number.isInteger(sceneIndex) || sceneIndex < 0) {
    throw new Error('renderId and scene index are required');
  }

  const response = await fetch(`/api/render_jobs/${encodeURIComponent(renderId)}/scenes`);
  if (!response.ok) throw new Error(`Unable to load render job: ${response.status}`);

  const payload = await response.json();
  const scene = payload.scenes[sceneIndex];
  if (!scene) throw new Error(`Scene ${sceneIndex} was not found`);

  const srcdoc = await sceneToDocument(normalizeScene(scene));
  const loaded = waitForFrameLoad();
  frame.srcdoc = srcdoc;
  await loaded;

  await new Promise((resolve) => window.setTimeout(resolve, 500));
  window.__sceneReady = true;
}

loadRenderScene().catch((error) => {
  document.body.textContent = error.message;
  window.__sceneError = error.message;
});
