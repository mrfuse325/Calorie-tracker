import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const profile = await mkdtemp(join(tmpdir(), 'calorie-browser-'));
const chrome = spawn(process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let socket;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await pause(100); }
  }
  if (!port) throw Error('Could not launch Chrome. Set CHROME_PATH to your Chrome executable.');
  const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(res => res.json());
  socket = new WebSocket(tabs[0].webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const requests = new Map();
  socket.onmessage = event => {
    const result = JSON.parse(event.data);
    if (requests.has(result.id)) { requests.get(result.id)(result); requests.delete(result.id); }
  };
  async function command(method, params = {}) {
    const id = ++sequence;
    const response = new Promise(resolve => requests.set(id, resolve));
    socket.send(JSON.stringify({ id, method, params }));
    const result = await response;
    if (result.error) throw Error(JSON.stringify(result.error));
    return result.result;
  }
  async function evaluate(expression) {
    const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  async function waitFor(expression) {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await pause(50); }
    throw Error(`Timed out: ${expression}`);
  }
  await command('Page.navigate', { url: 'http://127.0.0.1:5173' });
  await waitFor('document.querySelector("#add-open") && !document.querySelector("#add-open").disabled');
  await evaluate(`document.querySelector('#add-open').click(); const form = document.querySelector('#entry-form'); for (const [key,value] of Object.entries({food_name:'Cooked rice',quantity:150,basis_quantity:100,energy_kcal:130,protein_g:2.7,fat_g:0})) form.elements[key].value = value; form.requestSubmit();`);
  await waitFor('!document.querySelector("#entry-dialog").open && document.querySelector("#entry-count").textContent === "1 entry"');
  assert.match(await evaluate('document.querySelector("#summary").textContent'), /195 kcal/);
  assert.match(await evaluate('document.querySelector("#summary").textContent'), /1 entry missing carbs/);
  await evaluate(`document.querySelector('[aria-label="Edit Cooked rice"]').click(); document.querySelector('#entry-form').elements.quantity.value = 200; document.querySelector('#entry-form').requestSubmit();`);
  await waitFor('!document.querySelector("#entry-dialog").open');
  assert.match(await evaluate('document.querySelector("#summary").textContent'), /260 kcal/);
  await evaluate(`document.querySelector('#goals-open').click(); document.querySelector('#goals-form').elements.energy_kcal.value = 200; document.querySelector('#goals-form').requestSubmit();`);
  await waitFor('!document.querySelector("#goals-dialog").open');
  assert.match(await evaluate('document.querySelector("#summary").textContent'), /60 over target/);
  await command('Page.reload');
  await waitFor('document.querySelector("#entry-count")?.textContent === "1 entry"');
  assert.match(await evaluate('document.querySelector("#summary").textContent'), /260 kcal/);
  assert.match(await evaluate('document.querySelector("#summary").textContent'), /60 over target/);
  await evaluate(`document.querySelector('[aria-label="Delete Cooked rice"]').click()`);
  await waitFor('document.querySelector("#entry-count").textContent === "0 entries"');
  await evaluate(`document.querySelector('#notice button').click()`);
  await waitFor('document.querySelector("#entry-count").textContent === "1 entry"');
  await evaluate(`document.querySelector('[aria-label="Delete Cooked rice"]').click()`);
  await waitFor('document.querySelector("#entry-count").textContent === "0 entries"');
  await command('Page.reload');
  await waitFor('document.querySelector("#add-open") && !document.querySelector("#add-open").disabled');
  assert.equal(await evaluate('document.querySelector("#entry-count").textContent'), '0 entries');
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
  await evaluate(`document.querySelector('#add-open').click()`);
  assert.equal(await evaluate('document.querySelector("#entry-dialog").scrollWidth <= document.querySelector("#entry-dialog").clientWidth'), true);
  console.log('Browser smoke passed: add, scale, incomplete totals, edit, targets, refresh, delete, undo, persistence, mobile overflow.');
} finally {
  socket?.close();
  chrome.kill();
  await pause(500);
  await rm(profile, { recursive: true, force: true });
}
