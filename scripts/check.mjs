import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

async function files(directory) {
  const items = await readdir(directory, { withFileTypes: true });
  const lists = await Promise.all(items.map(item => item.isDirectory() ? files(`${directory}/${item.name}`) : [`${directory}/${item.name}`]));
  return lists.flat();
}
const paths = ['server.mjs', 'food-api.mjs', ...await files('src'), ...await files('scripts'), ...await files('tests')].filter(path => /\.(mjs|js)$/.test(path));
for (const path of paths) {
  const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Syntax checked ${paths.length} JavaScript files.`);
