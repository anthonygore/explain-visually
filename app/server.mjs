import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { chromium } from 'playwright';

const PORT = Number(process.env.API_PORT ?? 8787);
const APP_ENV = process.env.EXPLAIN_VISUALLY_ENV ?? 'development';
const DEFAULT_MIN_DURATION = 2000;
const VOICEBOX_URL = process.env.VOICEBOX_URL ?? 'http://127.0.0.1:17493';
const VOICEBOX_PROFILE = process.env.VOICEBOX_PROFILE ?? 'George';
const VOICEBOX_ENGINE = process.env.VOICEBOX_ENGINE ?? 'kokoro';
const RENDER_FRONTEND_URL = process.env.RENDER_FRONTEND_URL ?? 'http://127.0.0.1:5173';
const RENDERS_DIR = path.resolve('renders');
const FRAME_WIDTH = 1280;
const FRAME_HEIGHT = 720;
const FPS = 30;
const execFileAsync = promisify(execFile);

const clients = new Set();
const scenes = [];
const renderJobs = new Map();
let currentIndex = 0;

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'access-control-allow-origin': '*',
  });
  response.end(body);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Payload too large'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    request.on('error', reject);
  });
}

function normalizeScene(scene) {
  if (!scene || typeof scene !== 'object' || Array.isArray(scene)) {
    throw new Error('Each scene must be an object');
  }

  if (typeof scene.narration !== 'string') {
    throw new Error('Scene narration is required and must be a string');
  }

  if (scene.html !== undefined && typeof scene.html !== 'string') {
    throw new Error('Scene html must be a string when provided');
  }

  if (scene.mermaid !== undefined && typeof scene.mermaid !== 'string') {
    throw new Error('Scene mermaid must be a string when provided');
  }

  if (scene.code !== undefined && (!scene.code || typeof scene.code !== 'object' || Array.isArray(scene.code))) {
    throw new Error('Scene code must be an object when provided');
  }

  if (scene.html === undefined && scene.mermaid === undefined && scene.code === undefined) {
    throw new Error('Scene must include html, mermaid, or code');
  }

  if (scene.code !== undefined) {
    validateCodeScene(scene.code);
  }

  const minDuration = scene.minDuration === undefined
    ? DEFAULT_MIN_DURATION
    : Number(scene.minDuration);

  if (!Number.isFinite(minDuration) || minDuration < 0) {
    throw new Error('Scene minDuration must be a non-negative number');
  }

  return {
    id: randomUUID(),
    narration: scene.narration,
    html: scene.html,
    mermaid: scene.mermaid,
    code: scene.code,
    minDuration,
    createdAt: new Date().toISOString(),
  };
}

function validateCodeScene(code) {
  if (typeof code.content !== 'string') {
    throw new Error('Scene code.content is required and must be a string');
  }

  if (code.language !== undefined && typeof code.language !== 'string') {
    throw new Error('Scene code.language must be a string when provided');
  }

  if (code.title !== undefined && typeof code.title !== 'string') {
    throw new Error('Scene code.title must be a string when provided');
  }

  if (code.diff !== undefined && typeof code.diff !== 'boolean') {
    throw new Error('Scene code.diff must be a boolean when provided');
  }

  if (code.focusLines !== undefined) {
    validateLineList(code.focusLines, 'code.focusLines');
  }

  if (code.addedLines !== undefined) {
    validateLineList(code.addedLines, 'code.addedLines');
  }

  if (code.removedLines !== undefined) {
    validateLineList(code.removedLines, 'code.removedLines');
  }
}

function validateLineList(value, field) {
  if (!Array.isArray(value)) {
    throw new Error(`Scene ${field} must be an array when provided`);
  }

  for (const line of value) {
    if (!Number.isInteger(line) || line < 1) {
      throw new Error(`Scene ${field} entries must be positive integers`);
    }
  }
}

function extractScenes(payload) {
  if (Array.isArray(payload)) return payload.map(normalizeScene);
  if (Array.isArray(payload.scenes)) return payload.scenes.map(normalizeScene);
  return [normalizeScene(payload)];
}

async function renderSceneAudio(scene, index, renderDir, profile) {
  if (scene.narration.trim() === '') {
    return {
      index,
      skipped: true,
      audioPath: null,
      audioDurationMs: 0,
      durationMs: scene.minDuration,
      error: null,
    };
  }

  const response = await fetch(`${VOICEBOX_URL}/generate/stream`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      profile_id: profile.id,
      text: scene.narration,
      language: profile.language ?? 'en',
      engine: VOICEBOX_ENGINE,
    }),
  });

  if (!response.ok) {
    throw new Error(`Voicebox returned ${response.status}: ${await response.text()}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  const audioPath = path.join(renderDir, `scene-${String(index + 1).padStart(3, '0')}.wav`);
  await writeFile(audioPath, audioBuffer);

  const audioDurationMs = getWavDurationMs(audioBuffer);

  return {
    index,
    skipped: false,
    audioPath,
    audioDurationMs,
    durationMs: Math.max(audioDurationMs, scene.minDuration),
    error: null,
  };
}

async function renderScenesToVideo(renderId, renderDir, renderScenes, renderedScenes) {
  renderJobs.set(renderId, { scenes: renderScenes });

  let browser;

  try {
    browser = await chromium.launch();
    const page = await browser.newPage({
      viewport: { width: FRAME_WIDTH, height: FRAME_HEIGHT },
      deviceScaleFactor: 1,
    });

    for (const [index] of renderScenes.entries()) {
      const sceneNumber = String(index + 1).padStart(3, '0');
      const screenshotPath = path.join(renderDir, `scene-${sceneNumber}.png`);
      const segmentPath = path.join(renderDir, `segment-${sceneNumber}.mp4`);
      const renderUrl = `${RENDER_FRONTEND_URL}/capture.html?renderId=${encodeURIComponent(renderId)}&scene=${index}`;

      await page.goto(renderUrl, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__sceneReady === true || Boolean(window.__sceneError), null, { timeout: 15_000 });

      const sceneError = await page.evaluate(() => window.__sceneError ?? null);
      if (sceneError) throw new Error(`Scene ${index + 1} render failed: ${sceneError}`);

      await page.screenshot({ path: screenshotPath, fullPage: false });
      await createSceneSegment(screenshotPath, renderedScenes[index], segmentPath);
      renderedScenes[index].screenshotPath = screenshotPath;
      renderedScenes[index].segmentPath = segmentPath;
    }

    const videoPath = path.join(renderDir, 'video.mp4');
    await concatSegments(renderDir, renderScenes.length, videoPath);
    await cleanupRenderIntermediates(renderedScenes);

    return videoPath;
  } finally {
    if (browser) await browser.close();
    renderJobs.delete(renderId);
  }
}

async function createSceneSegment(screenshotPath, renderedScene, segmentPath) {
  const durationSeconds = Math.max(renderedScene.durationMs / 1000, 0.001);
  const commonArgs = [
    '-y',
    '-loop',
    '1',
    '-framerate',
    String(FPS),
    '-i',
    screenshotPath,
  ];

  const outputArgs = [
    '-t',
    durationSeconds.toFixed(3),
    '-c:v',
    'libx264',
    '-c:a',
    'aac',
    '-ar',
    '44100',
    '-ac',
    '2',
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(FPS),
    '-vf',
    `scale=${FRAME_WIDTH}:${FRAME_HEIGHT}:force_original_aspect_ratio=decrease,pad=${FRAME_WIDTH}:${FRAME_HEIGHT}:(ow-iw)/2:(oh-ih)/2`,
    segmentPath,
  ];

  if (renderedScene.audioPath) {
    await execFileAsync('ffmpeg', [
      ...commonArgs,
      '-i',
      renderedScene.audioPath,
      ...outputArgs,
    ]);
    return;
  }

  await execFileAsync('ffmpeg', [
    ...commonArgs,
    '-f',
    'lavfi',
    '-i',
    'anullsrc=channel_layout=stereo:sample_rate=44100',
    ...outputArgs,
  ]);
}

async function concatSegments(renderDir, count, videoPath) {
  const concatPath = path.join(renderDir, 'segments.txt');
  const lines = Array.from({ length: count }, (_, index) => {
    const sceneNumber = String(index + 1).padStart(3, '0');
    return `file '${path.join(renderDir, `segment-${sceneNumber}.mp4`).replaceAll("'", "'\\''")}'`;
  });

  await writeFile(concatPath, `${lines.join('\n')}\n`);
  await execFileAsync('ffmpeg', [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    concatPath,
    '-c',
    'copy',
    videoPath,
  ]);
  await rm(concatPath, { force: true });
}

async function cleanupRenderIntermediates(renderedScenes) {
  const pathsToRemove = renderedScenes
    .flatMap((scene) => [scene.audioPath, scene.screenshotPath, scene.segmentPath])
    .filter(Boolean);

  await Promise.all(pathsToRemove.map((filePath) => rm(filePath, { force: true })));

  for (const scene of renderedScenes) {
    scene.audioPath = null;
    delete scene.screenshotPath;
    delete scene.segmentPath;
  }
}

async function writeCaptions(renderDir, renderScenes, renderedScenes) {
  const captionsPath = path.join(renderDir, 'captions.srt');
  const blocks = [];
  let captionIndex = 1;
  let cursorMs = 0;

  for (const [sceneIndex, scene] of renderScenes.entries()) {
    const renderedScene = renderedScenes[sceneIndex];
    const durationMs = Math.max(renderedScene.durationMs ?? scene.minDuration, 1);
    const sentences = splitCaptionSentences(scene.narration);

    if (sentences.length === 0) {
      cursorMs += durationMs;
      continue;
    }

    const totalWeight = sentences.reduce((sum, sentence) => sum + sentence.length, 0);
    let sceneCaptionStartMs = cursorMs;

    for (const [sentenceIndex, sentence] of sentences.entries()) {
      const isLast = sentenceIndex === sentences.length - 1;
      const sentenceDurationMs = isLast
        ? cursorMs + durationMs - sceneCaptionStartMs
        : Math.round((durationMs * sentence.length) / totalWeight);
      const sentenceEndMs = isLast
        ? cursorMs + durationMs
        : Math.min(cursorMs + durationMs, sceneCaptionStartMs + sentenceDurationMs);

      blocks.push([
        String(captionIndex),
        `${formatSrtTimestamp(sceneCaptionStartMs)} --> ${formatSrtTimestamp(sentenceEndMs)}`,
        sentence,
      ].join('\n'));

      captionIndex += 1;
      sceneCaptionStartMs = sentenceEndMs;
    }

    cursorMs += durationMs;
  }

  await writeFile(captionsPath, `${blocks.join('\n\n')}\n`, 'utf8');
  return captionsPath;
}

function splitCaptionSentences(text) {
  const normalized = text
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return [];

  const matches = normalized.match(/[^.!?]+[.!?]+["')\]]?|[^.!?]+$/g) ?? [normalized];
  return matches
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function formatSrtTimestamp(ms) {
  const safeMs = Math.max(0, Math.round(ms));
  const hours = Math.floor(safeMs / 3_600_000);
  const minutes = Math.floor((safeMs % 3_600_000) / 60_000);
  const seconds = Math.floor((safeMs % 60_000) / 1000);
  const milliseconds = safeMs % 1000;

  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ].join(':') + `,${String(milliseconds).padStart(3, '0')}`;
}

async function getVoiceboxProfile() {
  const response = await fetch(`${VOICEBOX_URL}/profiles`);

  if (!response.ok) {
    throw new Error(`Voicebox profiles request returned ${response.status}`);
  }

  const profiles = await response.json();
  const profile = profiles.find((item) => item.id === VOICEBOX_PROFILE || item.name === VOICEBOX_PROFILE);

  if (!profile) {
    throw new Error(`Voicebox profile "${VOICEBOX_PROFILE}" was not found`);
  }

  return profile;
}

function getWavDurationMs(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Voicebox did not return a valid WAV file');
  }

  let offset = 12;
  let byteRate = null;
  let dataSize = null;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;

    if (chunkId === 'fmt ') {
      byteRate = buffer.readUInt32LE(chunkStart + 8);
    }

    if (chunkId === 'data') {
      dataSize = chunkSize;
      break;
    }

    offset = chunkStart + chunkSize + (chunkSize % 2);
  }

  if (!byteRate || !dataSize) {
    throw new Error('Unable to measure WAV duration');
  }

  return Math.round((dataSize / byteRate) * 1000);
}

function broadcast(event, payload) {
  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;

  for (const client of clients) {
    client.write(message);
  }
}

function handleOptions(response) {
  response.writeHead(204, {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  response.end();
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === 'OPTIONS') {
    handleOptions(response);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/health') {
    sendJson(response, 200, { ok: true, environment: APP_ENV });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/scenes') {
    sendJson(response, 200, { scenes, currentIndex });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/events') {
    response.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'access-control-allow-origin': '*',
    });
    response.write(`event: sync\ndata: ${JSON.stringify({ scenes, currentIndex })}\n\n`);
    clients.add(response);
    request.on('close', () => clients.delete(response));
    return;
  }

  const renderJobMatch = url.pathname.match(/^\/api\/render_jobs\/([^/]+)\/scenes$/);
  if (request.method === 'GET' && renderJobMatch) {
    const renderJob = renderJobs.get(renderJobMatch[1]);

    if (!renderJob) {
      sendJson(response, 404, { ok: false, error: 'Render job not found' });
      return;
    }

    sendJson(response, 200, { scenes: renderJob.scenes });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/add_scene') {
    try {
      const payload = await readJson(request);
      const acceptedScenes = extractScenes(payload);
      scenes.push(...acceptedScenes);
      broadcast('scene', { scenes: acceptedScenes });
      sendJson(response, 200, { ok: true });
    } catch (error) {
      sendJson(response, 400, { ok: false, error: error.message });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/clear_scenes') {
    scenes.length = 0;
    currentIndex = 0;
    broadcast('sync', { scenes, currentIndex });
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/render') {
    const renderId = randomUUID();

    try {
      const renderScenes = scenes.map((scene) => ({ ...scene }));

      if (renderScenes.length === 0) {
        sendJson(response, 400, {
          ok: false,
          renderId,
          error: 'No scenes are loaded to render',
        });
        return;
      }

      const profile = await getVoiceboxProfile();
      const renderDir = path.join(RENDERS_DIR, renderId);
      await mkdir(renderDir, { recursive: true });

      const renderedScenes = [];

      for (const [index, scene] of renderScenes.entries()) {
        try {
          renderedScenes.push(await renderSceneAudio(scene, index, renderDir, profile));
        } catch (error) {
          renderedScenes.push({
            index,
            skipped: false,
            audioPath: null,
            audioDurationMs: null,
            durationMs: scene.minDuration,
            error: error.message,
          });
        }
      }

      const errors = renderedScenes.filter((scene) => scene.error);
      let videoPath = null;
      let captionsPath = null;
      let videoError = null;

      if (errors.length === 0) {
        try {
          videoPath = await renderScenesToVideo(renderId, renderDir, renderScenes, renderedScenes);
          captionsPath = await writeCaptions(renderDir, renderScenes, renderedScenes);
        } catch (error) {
          videoError = error.message;
          errors.push({ error: videoError });
        }
      }

      sendJson(response, errors.length > 0 ? 502 : 200, {
        ok: errors.length === 0,
        renderId,
        renderDir,
        videoPath,
        captionsPath,
        voicebox: {
          url: VOICEBOX_URL,
          profile: profile.name,
          profileId: profile.id,
          engine: VOICEBOX_ENGINE,
        },
        scenes: renderedScenes,
        video: videoPath
          ? {
              path: videoPath,
              width: FRAME_WIDTH,
              height: FRAME_HEIGHT,
              fps: FPS,
            }
          : null,
        captions: captionsPath
          ? {
              path: captionsPath,
              format: 'srt',
            }
          : null,
        videoError,
        errors,
      });
    } catch (error) {
      sendJson(response, 502, {
        ok: false,
        renderId,
        error: error.message,
        voicebox: {
          url: VOICEBOX_URL,
          profile: VOICEBOX_PROFILE,
          engine: VOICEBOX_ENGINE,
        },
      });
    }
    return;
  }

  if (request.method === 'PUT' && url.pathname === '/api/current_scene') {
    try {
      const payload = await readJson(request);
      const nextIndex = Number(payload.currentIndex);

      if (!Number.isInteger(nextIndex) || nextIndex < 0) {
        throw new Error('currentIndex must be a non-negative integer');
      }

      currentIndex = scenes.length === 0 ? 0 : Math.min(nextIndex, scenes.length - 1);
      broadcast('current_scene', { currentIndex });
      sendJson(response, 200, { ok: true });
    } catch (error) {
      sendJson(response, 400, { ok: false, error: error.message });
    }
    return;
  }

  sendJson(response, 404, { ok: false, error: 'Not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`API server listening on http://127.0.0.1:${PORT}`);
});
