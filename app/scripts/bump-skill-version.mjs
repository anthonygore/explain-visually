import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(appRoot, '..');
const skillPath = path.join(repoRoot, 'plugin/skills/explainvisually/SKILL.md');

function pad(value) {
  return String(value).padStart(2, '0');
}

function timestampVersion(date = new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + `-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

const content = await readFile(skillPath, 'utf8');
const version = timestampVersion();

if (!/^---\n[\s\S]*?\n---/.test(content)) {
  throw new Error(`No YAML frontmatter found in ${skillPath}`);
}

const nextContent = content.replace(
  /(^metadata:\n(?:  .+\n)*?  version: ).+$/m,
  `$1${version}`,
);

if (nextContent === content) {
  throw new Error(`No metadata.version field found in ${skillPath}`);
}

await writeFile(skillPath, nextContent, 'utf8');
console.log(`Updated explainvisually skill version to ${version}`);
