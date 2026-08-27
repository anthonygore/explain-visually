import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const envFile = resolve(process.cwd(), '..', '.env');
const fileEnv = existsSync(envFile)
  ? Object.fromEntries(
      readFileSync(envFile, 'utf8')
        .split(/\r?\n/)
        .filter((line) => line.trim() && !line.trim().startsWith('#'))
        .map((line) => {
          const separator = line.indexOf('=');
          return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')];
        }),
    )
  : {};
const childEnv = { ...fileEnv, ...process.env };
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [
  spawn(npm, ['run', 'api'], { stdio: 'inherit', env: childEnv }),
  spawn(npm, ['run', 'dev'], { stdio: 'inherit', env: childEnv }),
];

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill(signal);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

for (const child of children) {
  child.on('error', (error) => {
    console.error(`Unable to start service: ${error.message}`);
    shutdown('SIGTERM');
    process.exitCode = 1;
  });
  child.on('exit', (code, signal) => {
    if (!shuttingDown && code !== 0) {
      console.error(`A service stopped (${signal || `exit ${code}`}).`);
      shutdown('SIGTERM');
      process.exitCode = code || 1;
    }
  });
}
