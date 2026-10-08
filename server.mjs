import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
const root = fileURLToPath(new URL('.', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (!(relative === 'index.html' || relative === 'styles.css' || /^src\/[a-z-]+\.js$/.test(relative))) throw Error('Not found');
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
