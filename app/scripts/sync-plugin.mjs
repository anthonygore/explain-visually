import { accessSync, constants, cp, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { promisify } from 'node:util';
import { delimiter, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const copy = promisify(cp);
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(appRoot, '..');
const pluginSource = resolve(repoRoot, 'plugin');
const pluginInstall = process.env.EXPLAIN_VISUALLY_PLUGIN_INSTALL
  ?? resolve(homedir(), 'plugins/explain-visually');
const cachebusterScript = process.env.CODEX_PLUGIN_CACHEBUSTER_SCRIPT
  ?? resolve(homedir(), '.codex/skills/.system/plugin-creator/scripts/update_plugin_cachebuster.py');
const marketplacePlugin = process.env.EXPLAIN_VISUALLY_MARKETPLACE_PLUGIN
  ?? pluginInstall;
const marketplaceName = process.env.EXPLAIN_VISUALLY_MARKETPLACE ?? 'personal';

function executableExists(command) {
  try {
    accessSync(command, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findExecutable(command) {
  if (command.includes('/')) {
    return executableExists(command) ? command : undefined;
  }

  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    if (!directory) continue;
    const candidate = resolve(directory, command);
    if (executableExists(candidate)) return candidate;
  }

  return undefined;
}

function resolveCodexCommand() {
  const candidates = [
    process.env.CODEX_CLI,
    findExecutable('codex'),
    '/Applications/ChatGPT.app/Contents/Resources/codex',
  ].filter(Boolean);

  return candidates.find(executableExists);
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!existsSync(pluginSource)) {
  throw new Error(`Plugin source does not exist: ${pluginSource}`);
}

if (!existsSync(cachebusterScript)) {
  console.warn(`Skipping plugin sync: cachebuster helper not found at ${cachebusterScript}`);
  process.exit(0);
}

await copy(pluginSource, marketplacePlugin, { recursive: true, force: true });
console.log(`Synced plugin source to ${marketplacePlugin}`);

run('python3', [cachebusterScript, marketplacePlugin, '--cachebuster', `commit-${Date.now()}`]);

const codexCommand = resolveCodexCommand();
if (!codexCommand) {
  console.warn('Skipping plugin add: codex CLI not found. Set CODEX_CLI to its executable path to enable this step.');
  process.exit(0);
}

run(codexCommand, ['plugin', 'add', `explain-visually@${marketplaceName}`]);
