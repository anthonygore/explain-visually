import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serverPath = resolve(pluginRoot, 'mcp/explain-visually.mjs');

function startServer() {
  const child = spawn(process.execPath, [serverPath], { stdio: ['pipe', 'pipe', 'pipe'] });
  let buffer = '';
  const pending = new Map();
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const message = JSON.parse(line);
      pending.get(message.id)?.(message);
      pending.delete(message.id);
    }
  });
  return {
    child,
    request(id, method, params = {}) {
      return new Promise((resolveRequest) => {
        pending.set(id, resolveRequest);
        child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
      });
    },
  };
}

test('MCP server exposes the Explain Visually contract', async (t) => {
  const server = startServer();
  t.after(() => server.child.kill('SIGTERM'));

  const initialized = await server.request(1, 'initialize', { protocolVersion: '2025-06-18' });
  assert.equal(initialized.result.serverInfo.name, 'explain-visually');

  const listed = await server.request(2, 'tools/list');
  assert.deepEqual(
    listed.result.tools.map((tool) => tool.name),
    ['clear_scenes', 'add_scenes', 'get_scenes', 'set_current_scene', 'render_video', 'get_preview_info'],
  );

  const preview = await server.request(3, 'tools/call', { name: 'get_preview_info', arguments: {} });
  assert.match(preview.result.content[0].text, /frontendUrl/);
});
