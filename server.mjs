import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.API_PORT ?? 8787);
const DEFAULT_MIN_DURATION = 2000;

const clients = new Set();
const scenes = [];
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

  if (scene.html === undefined && scene.mermaid === undefined) {
    throw new Error('Scene must include either html or mermaid');
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
    minDuration,
    createdAt: new Date().toISOString(),
  };
}

function extractScenes(payload) {
  if (Array.isArray(payload)) return payload.map(normalizeScene);
  if (Array.isArray(payload.scenes)) return payload.scenes.map(normalizeScene);
  return [normalizeScene(payload)];
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
    sendJson(response, 200, { ok: true });
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
