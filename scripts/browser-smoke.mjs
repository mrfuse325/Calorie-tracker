import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const profile = await mkdtemp(join(tmpdir(), 'calorie-browser-'));
const chrome = spawn(process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless', '--disable-gpu', '--disable-dev-shm-usage', '--disable-extensions', '--disable-background-networking', '--disable-default-apps', ...(process.env.CHROME_NO_SANDBOX === '1' ? ['--no-sandbox'] : []), '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
let chromeError = '', launchError;
chrome.stderr.on('data', data => { chromeError = (chromeError + data.toString()).slice(-6000); });
chrome.on('error', error => { launchError = error; });
let socket;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  let port;
  for (let i = 0; i < 300; i++) {
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await pause(100); }
  }
  if (!port) throw Error(`Could not launch Chrome. Check CHROME_PATH. ${launchError?.message || chromeError}`);
  const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(res => res.json());
  const tab = tabs.find(item => item.type === 'page' && item.url === 'about:blank') || tabs.find(item => item.type === 'page');
  if (!tab) throw Error('Chrome did not create a test page.');
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const browserErrors = [];
  const requests = new Map();
  socket.onmessage = event => {
    const result = JSON.parse(event.data);
    if (result.method === 'Runtime.exceptionThrown') browserErrors.push(result.params.exceptionDetails);
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
    for (let i = 0; i < 200; i++) { if (await evaluate(expression)) return; await pause(50); }
    const page = await evaluate('({url:location.href,ready:document.readyState,body:document.body?.innerText.slice(0,2500)})');
    throw Error(`Timed out: ${expression}\nPage: ${JSON.stringify(page)}\nBrowser errors: ${JSON.stringify(browserErrors)}`);
  }
  async function reload() {
    await evaluate('document.documentElement.dataset.reloadPending = "1"');
    await command('Page.reload');
    await waitFor('!document.documentElement.dataset.reloadPending && document.querySelector("#add-open") && !document.querySelector("#add-open").disabled');
  }
  await command('Runtime.enable');
  await command('Page.enable');
  await command('Page.addScriptToEvaluateOnNewDocument', { source: `
    const realFetch = window.fetch.bind(window);
    window.__searchQueries = [];
    window.__easyDetails = 0;
    window.fetch = async (url, options) => {
      if (String(url).startsWith('/api/foods/usda/2708815')) { window.__easyDetails++; return new Response(JSON.stringify({error:'USDA has paused food lookup.'}), {status:429}); }
      if (String(url).startsWith('/api/foods/usda/') && window.__noPortions) return new Response(JSON.stringify({food:{source:'usda',source_id:'168878',food_name:'Unclassified mixed meal',data_type:'SR Legacy',basis_quantity:100,basis_unit:'g',basis:{energy_kcal:130,protein_g:2.69,carbs_g:28.17,fat_g:0.28},portions:[],provider_url:'https://fdc.nal.usda.gov/food-details/168878/nutrients'}}));
      if (String(url).startsWith('/api/foods/usda/')) return new Response(JSON.stringify({food:{source:'usda',source_id:'168878',food_name:'Rice, white, cooked',data_type:'SR Legacy',basis_quantity:100,basis_unit:'g',basis:{energy_kcal:130,protein_g:2.69,carbs_g:28.17,fat_g:0.28},portions:[{id:'cup',label:'1 cup',grams:158}],fetched_at:'2026-10-08T00:00:00Z',provider_url:'https://fdc.nal.usda.gov/food-details/168878/nutrients'}}));
      if (!String(url).startsWith('/api/foods/search')) return realFetch(url, options);
      const query = new URL(url, location.origin).searchParams.get('q');
      window.__searchQueries.push(query);
      if (query === 'easy mac') return new Response(JSON.stringify({foods:[{source:'usda',source_id:'2708815',food_name:'Macaroni or noodles with cheese, Easy Mac type',data_type:'Survey (FNDDS)',basis_quantity:100,basis_unit:'g',basis:{energy_kcal:110,protein_g:3.3,carbs_g:20.1,fat_g:1.9},portions:window.__easyNoMeasures ? [] : [{id:'cup',label:'1 cup',grams:230},{id:'tub',label:'1 microwavable tub, regular size, prepared',grams:212}],provider_url:'https://fdc.nal.usda.gov/food-details/2708815/nutrients'}]}));
      if (query === 'slow') await new Promise(resolve => setTimeout(resolve, 1200));
      if (query === 'offline') return new Response(JSON.stringify({error:'Food search unavailable. Enter nutrition manually.'}), {status:502});
      return new Response(JSON.stringify({mode:'demo', foods:[{source:'usda', source_id:'168878', food_name:query === 'slow' ? 'Old search result' : 'Rice, white, cooked', data_type:'SR Legacy', basis_quantity:100, basis_unit:'g', basis:{energy_kcal:130,protein_g:2.69,carbs_g:28.17,fat_g:0.28}, fetched_at:'2026-10-08T00:00:00Z', provider_url:'https://fdc.nal.usda.gov/food-details/168878/nutrients'}]}));
    };
  ` });
  await command('Page.navigate', { url: 'http://127.0.0.1:5173' });
  await waitFor('document.querySelector("#add-open") && !document.querySelector("#add-open").disabled');
  await evaluate(`document.querySelector('#add-open').click(); const form = document.querySelector('#entry-form'); for (const [key,value] of Object.entries({food_name:'Cooked rice',unit:'g',quantity:150,basis_quantity:100,energy_kcal:130,protein_g:2.7,fat_g:0})) form.elements[key].value = value; form.requestSubmit();`);
  await waitFor('!document.querySelector("#entry-dialog").open && document.querySelector("#entry-count").textContent === "1 entry"');
  assert.match(await evaluate('document.querySelector("#summary").textContent'), /195 kcal/);
  assert.match(await evaluate('document.querySelector("#summary").textContent'), /1 entry missing carbs/);
  await evaluate(`document.querySelector('[aria-label="Edit Cooked rice"]').click(); document.querySelector('#entry-form').elements.quantity.value = 200; document.querySelector('#entry-form').requestSubmit();`);
  await waitFor('!document.querySelector("#entry-dialog").open');
  assert.match(await evaluate('document.querySelector("#summary").textContent'), /260 kcal/);
  await evaluate(`document.querySelector('#goals-open').click(); document.querySelector('#goals-form').elements.energy_kcal.value = 200; document.querySelector('#goals-form').requestSubmit();`);
  await waitFor('!document.querySelector("#goals-dialog").open');
  assert.match(await evaluate('document.querySelector("#summary").textContent'), /60 over target/);
  await reload();
  await waitFor('document.querySelector("#entry-count")?.textContent === "1 entry"');
  assert.match(await evaluate('document.querySelector("#summary").textContent'), /260 kcal/);
  assert.match(await evaluate('document.querySelector("#summary").textContent'), /60 over target/);
  await evaluate(`document.querySelector('[aria-label="Delete Cooked rice"]').click()`);
  await waitFor('document.querySelector("#entry-count").textContent === "0 entries"');
  await evaluate(`document.querySelector('#notice button').click()`);
  await waitFor('document.querySelector("#entry-count").textContent === "1 entry"');
  await evaluate(`document.querySelector('[aria-label="Delete Cooked rice"]').click()`);
  await waitFor('document.querySelector("#entry-count").textContent === "0 entries"');
  await reload();
  await waitFor('document.querySelector("#add-open") && !document.querySelector("#add-open").disabled');
  assert.equal(await evaluate('document.querySelector("#entry-count").textContent'), '0 entries');
  await evaluate(`document.querySelector('#calculator-open').click()`);
  await waitFor('document.querySelector("#calculator-dialog").open && !document.querySelector("#calculator-form").elements.age.disabled');
  assert.equal(await evaluate('document.querySelector("#calculator-form").elements.measurement.value'), 'us');
  await evaluate(`const calc = document.querySelector('#calculator-form'); for (const [key,value] of Object.entries({age:30,sex:'male',feet:5,inches:180/2.54-60,pounds:80/0.45359237,activity:'sedentary',loss_rate:1})) calc.elements[key].value=value; calc.requestSubmit();`);
  await waitFor('!document.querySelector("#calculator-result").hidden');
  assert.match(await evaluate('document.querySelector("#calculator-result").textContent'), /1,636 kcal/);
  await evaluate(`document.querySelector('#calculator-apply').click()`);
  await waitFor('!document.querySelector("#calculator-dialog").open');
  await reload();
  assert.match(await evaluate('document.querySelector("#summary").textContent'), /Target: 1,636 kcal/);
  await evaluate(`document.querySelector('#calculator-open').click()`);
  await waitFor('!document.querySelector("#calculator-form").elements.age.disabled');
  assert.equal(await evaluate('document.querySelector("#calculator-form").elements.loss_rate.value'), '1');
  await evaluate(`document.querySelector('#calculator-close').click(); document.querySelector('#add-open').click(); const foodName = document.querySelector('#entry-form').elements.food_name; foodName.value='rice'; foodName.dispatchEvent(new Event('input', {bubbles:true}));`);
  await waitFor('document.querySelector("#food-results button") !== null');
  await evaluate(`document.querySelector('#food-results button').click()`);
  await waitFor('document.querySelector("#entry-form").elements.energy_kcal.value !== "" && !document.querySelector("#portion-fields").hidden');
  assert.equal(await evaluate('document.querySelector("#entry-form").elements.energy_kcal.value'), '205.4');
  assert.equal(await evaluate('document.querySelector("#entry-form").elements.unit.value'), 'serving');
  assert.equal(await evaluate('document.querySelector("#entry-form").elements.basis_quantity.value'), '1');
  assert.equal(await evaluate('document.querySelector("#entry-form").elements.serving_grams.value'), '158');
  assert.equal(await evaluate('document.querySelector("#entry-form").elements.serving_grams.closest("label").hidden'), true);
  await evaluate(`document.querySelector('#food-portion').value='custom'; document.querySelector('#food-portion').dispatchEvent(new Event('change'));`);
  assert.equal(await evaluate('document.querySelector("#entry-form").elements.serving_grams.value'), '158');
  assert.equal(await evaluate('document.querySelector("#entry-form").elements.serving_grams.closest("label").hidden'), false);
  await evaluate(`document.querySelector('#entry-form').elements.quantity.value = 1.5; document.querySelector('#entry-form').requestSubmit();`);
  await waitFor('!document.querySelector("#entry-dialog").open');
  assert.match(await evaluate('document.querySelector("#summary").textContent'), /308.1 kcal/);
  assert.match(await evaluate('document.querySelector("#meals").textContent'), /1 cup/);
  assert.match(await evaluate('document.querySelector("#meals").textContent'), /USDA food estimate/);
  await reload();
  assert.match(await evaluate('document.querySelector("#meals").textContent'), /USDA food estimate/);
  await evaluate(`window.__noPortions=true; document.querySelector('#add-open').click(); document.querySelector('#entry-form').elements.food_name.value='mixed meal'; document.querySelector('#food-search').click();`);
  await waitFor('document.querySelector("#food-results button") !== null');
  await evaluate(`document.querySelector('#food-results button').click()`);
  await waitFor('document.querySelector("#food-portion").value === "weight-reference"');
  assert.equal(await evaluate('document.querySelector("#entry-form").elements.unit.value'), 'g');
  assert.equal(await evaluate('document.querySelector("#entry-form").elements.quantity.value'), '100');
  assert.equal(await evaluate('document.querySelector("#entry-form").elements.serving_grams.required'), false);
  assert.equal(await evaluate('document.querySelector("#entry-form").checkValidity()'), true);
  await evaluate(`window.__noPortions=false; document.querySelector('#entry-close').click()`);
  for (const failDetails of [false, true]) {
    await evaluate(`window.__easyNoMeasures=${failDetails}; document.querySelector('#add-open').click(); document.querySelector('#entry-form').elements.food_name.value='easy mac'; document.querySelector('#food-search').click();`);
    await waitFor('document.querySelector("#food-results button") !== null');
    await evaluate(`document.querySelector('#food-results button').click()`);
    await waitFor('document.querySelector("#entry-form").elements.energy_kcal.value === "253"');
    assert.equal(await evaluate('document.querySelector("#entry-form").elements.unit.value'), 'serving');
    assert.equal(await evaluate('document.querySelector("#entry-form").elements.serving_grams.value'), '230');
    assert.equal(await evaluate('document.querySelector("#entry-form").checkValidity()'), true);
    assert.equal(await evaluate('window.__easyDetails'), failDetails ? 1 : 0);
    await evaluate(`{ const servingForm=document.querySelector('#entry-form'); servingForm.elements.quantity.value=0.5; servingForm.elements.quantity.dispatchEvent(new Event('input',{bubbles:true})); }`);
    assert.match(await evaluate('document.querySelector("#preview").textContent'), /126.5 kcal/);
    await evaluate(`{ const portion=document.querySelector('#food-portion'); portion.value=[...portion.options].find(option=>option.textContent.includes('regular size')).value; portion.dispatchEvent(new Event('change')); }`);
    assert.equal(await evaluate('document.querySelector("#entry-form").elements.energy_kcal.value'), '233.2');
    await evaluate(`document.querySelector('#entry-close').click()`);
  }
  await evaluate(`document.querySelector('#add-open').click(); document.querySelector('#entry-form').elements.food_name.value='slow'; document.querySelector('#food-search').click(); document.querySelector('#entry-form').elements.food_name.value='rice'; document.querySelector('#food-search').click();`);
  await waitFor('document.querySelector("#food-results button") !== null');
  await pause(1300);
  assert.doesNotMatch(await evaluate('document.querySelector("#food-results").textContent'), /Old search result/);
  await evaluate(`document.querySelector('#entry-form').elements.food_name.value='offline'; document.querySelector('#food-search').click();`);
  await waitFor('document.querySelector("#search-status").textContent.includes("unavailable")');
  await evaluate(`document.querySelector('#food-manual').click(); document.querySelector('#entry-close').click()`);
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
  await evaluate(`document.querySelector('#add-open').click()`);
  assert.equal(await evaluate('document.querySelector("#entry-dialog").scrollWidth <= document.querySelector("#entry-dialog").clientWidth'), true);
  console.log('Browser smoke passed: diary CRUD, weight-loss goals, US-unit profile restore, USDA portions, serving scaling, source snapshots, stale searches, search failure, mobile overflow.');
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ id: 999999, method: 'Browser.close' }));
  socket?.close();
  if (chrome.exitCode === null && chrome.signalCode === null) {
    const stopped = new Promise(resolve => chrome.once('exit', resolve));
    chrome.kill();
    await Promise.race([stopped, pause(2000)]);
    if (chrome.exitCode === null && chrome.signalCode === null) { chrome.kill('SIGKILL'); await Promise.race([stopped, pause(1000)]); }
  }
  try { await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
  catch (error) { console.error(`Could not remove temporary Chrome profile: ${error.message}`); }
}
