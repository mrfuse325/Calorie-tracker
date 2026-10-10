import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
import { createFoodSearch, FoodApiError } from './food-api.mjs';
const root = fileURLToPath(new URL('.', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const searchFoods = createFoodSearch();
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const foodDetail = url.pathname.match(/^\/api\/foods\/usda\/(\d{1,12})$/);
  if (url.pathname === '/api/foods/search' || foodDetail) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') { res.writeHead(405, { Allow: 'GET' }); res.end(JSON.stringify({ error: 'Use GET for food search.' })); return; }
    try { res.end(JSON.stringify(await (foodDetail ? searchFoods.details(foodDetail[1]) : searchFoods(url.searchParams.get('q'))))); }
    catch (error) { res.writeHead(error instanceof FoodApiError ? error.status : 500); res.end(JSON.stringify({ error: error instanceof FoodApiError ? error.message : 'Food search unavailable.' })); }
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (!(['index.html', 'styles.css', 'icon.svg', 'manifest.webmanifest'].includes(relative) || /^src\/[a-z-]+\.js$/.test(relative))) throw Error('Not found');
    const path = resolve(root, relative);
    if (!path.startsWith(root)) throw Error('Not found');
    const content = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(content);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.on('error', error => {
  console.error(`Could not start local server: ${error.code}. Check port 5173 and local network permissions.`);
  process.exitCode = 1;
});
server.listen(5173, '127.0.0.1', () => console.log('Calorie tracker: http://127.0.0.1:5173'));
