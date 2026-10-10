import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { foodResponse } from '../worker.mjs';
import { FoodApiError, createFoodSearch } from '../food-api.mjs';
test('hosted API validates paths and methods without accepting arbitrary URLs', async () => {
  const lookup = async query => ({ foods: [], query });
  const request = path => new Request(`https://app.example${path}`);
  assert.equal((await foodResponse(request('/api/fetch?url=https://evil.example'), lookup)).status, 404);
  assert.equal((await foodResponse(new Request('https://app.example/api/foods/search', { method: 'POST' }), lookup)).status, 405);
  const result = await foodResponse(request('/api/foods/search?q=rice'), lookup);
  assert.equal(result.status, 200); assert.equal((await result.json()).query, 'rice');
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
  lookup.details = async id => ({ food: { id } });
  assert.equal((await (await foodResponse(request('/api/foods/usda/123'), lookup)).json()).food.id, '123');
});
test('hosted errors retain quota messages and hide unexpected server errors', async () => {
  const quota = await foodResponse(new Request('https://app.example/api/foods/search?q=rice'), async () => { throw new FoodApiError(429, 'Try later.'); });
  assert.equal(quota.status, 429);
  const unknown = await foodResponse(new Request('https://app.example/api/foods/search?q=rice'), async () => { throw Error('secret-key'); });
  assert.equal(unknown.status, 503); assert.ok(!(await unknown.text()).includes('secret-key'));
});
test('worker uses one shared quota object and serves frontend assets separately', async () => {
  let calls = 0;
  const env = { NUTRITION_PROXY: { idFromName: name => { assert.equal(name, 'usda-shared-budget'); return 'shared'; }, get: id => { assert.equal(id, 'shared'); return { fetch: async () => { calls++; return new Response('api'); } }; } }, ASSETS: { fetch: async () => new Response('frontend') } };
  assert.equal(await (await worker.fetch(new Request('https://app.example/'), env)).text(), 'frontend');
  assert.equal(await (await worker.fetch(new Request('https://app.example/api/foods/search?q=rice'), env)).text(), 'api');
  assert.equal(calls, 1);
});
test('persisted quota reservations survive service restart', async () => {
  let state, calls = 0;
  const options = { now: () => 0, saveState: async next => { state = next; }, fetchImpl: async () => { calls++; return new Response(JSON.stringify({ foods: [] })); } };
  const first = createFoodSearch(options);
  for (let i = 0; i < 25; i++) await first(`food ${i}`);
  const restarted = createFoodSearch({ ...options, initialState: state });
  await assert.rejects(restarted('rice'), error => error.status === 429);
  assert.equal(calls, 25);
});
