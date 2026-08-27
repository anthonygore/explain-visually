#!/usr/bin/env node

import { stdin, stdout } from 'node:process';

const API_URL = (process.env.EXPLAIN_VISUALLY_API_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
const FRONTEND_URL = process.env.EXPLAIN_VISUALLY_FRONTEND_URL || 'http://127.0.0.1:5173/';
const PROTOCOL_VERSION = '2025-06-18';

const tools = [
  {
    name: 'clear_scenes',
    description: 'Clear the Explain Visually preview queue before starting a new explanation.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'add_scenes',
    description: 'Append an ordered list of validated explanation scenes to the preview queue.',
    inputSchema: {
      type: 'object',
      properties: {
        scenes: { type: 'array', description: 'Scene objects containing narration and exactly one visual type.', items: { type: 'object' } },
      },
      required: ['scenes'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_scenes',
    description: 'Inspect the currently loaded scenes and selected scene index.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'set_current_scene',
    description: 'Select a scene in the Explain Visually preview.',
    inputSchema: {
      type: 'object',
      properties: { currentIndex: { type: 'integer', minimum: 0 } },
      required: ['currentIndex'],
      additionalProperties: false,
    },
  },
  {
    name: 'render_video',
    description: 'Render the currently loaded scene queue to an MP4 and captions file.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_preview_info',
    description: 'Return the Explain Visually frontend, API, and health URLs.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
];

function reply(id, result) {
  stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`);
}

function errorReply(id, code, message) {
  stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })}\n`);
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Explain Visually API returned ${response.status}`);
  return body;
}

function textResult(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

async function callTool(name, args) {
  switch (name) {
    case 'clear_scenes':
      return textResult(await request('/api/clear_scenes', { method: 'POST' }));
    case 'add_scenes':
      if (!Array.isArray(args?.scenes)) throw new Error('scenes must be an array');
      return textResult(await request('/add_scene', { method: 'POST', body: JSON.stringify(args.scenes) }));
    case 'get_scenes':
      return textResult(await request('/api/scenes'));
    case 'set_current_scene':
      return textResult(await request('/api/current_scene', { method: 'PUT', body: JSON.stringify({ currentIndex: args?.currentIndex }) }));
    case 'render_video':
      return textResult(await request('/render', { method: 'POST' }));
    case 'get_preview_info':
      return textResult({ frontendUrl: FRONTEND_URL, apiUrl: API_URL, healthUrl: `${API_URL}/api/health` });
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function handle(message) {
  if (!message || message.jsonrpc !== '2.0' || !('method' in message)) return;
  if (!('id' in message)) return;

  try {
    if (message.method === 'initialize') {
      reply(message.id, {
        protocolVersion: message.params?.protocolVersion || PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'explain-visually', version: '0.1.0' },
      });
    } else if (message.method === 'tools/list') {
      reply(message.id, { tools });
    } else if (message.method === 'tools/call') {
      reply(message.id, await callTool(message.params?.name, message.params?.arguments || {}));
    } else if (message.method === 'ping') {
      reply(message.id, {});
    } else {
      errorReply(message.id, -32601, `Method not found: ${message.method}`);
    }
  } catch (error) {
    reply(message.id, { isError: true, content: [{ type: 'text', text: error.message }] });
  }
}

let buffer = '';
stdin.setEncoding('utf8');
stdin.on('data', (chunk) => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    try {
      void handle(JSON.parse(line));
    } catch (error) {
      errorReply(null, -32700, `Invalid JSON: ${error.message}`);
    }
  }
});
