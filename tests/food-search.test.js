import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFood, normalizeSearch } from '../src/usda.js';
import { createFoodSearch } from '../food-api.mjs';
import { makeEntry } from '../src/nutrition.js';
const row = (nutrientId, unitName, value) => ({ nutrientId, unitName, value });
const rice = { fdcId: 168878, description: 'Rice, white, cooked', dataType: 'SR Legacy', foodNutrients: [row(1005, 'G', 28.17), row(1008, 'KCAL', 130), row(1003, 'G', 2.69), row(1004, 'G', 0.28)] };
const response = () => new Response(JSON.stringify({ foods: [rice] }), { status: 200 });

test('normalization uses identifiers, retains preparation, and states its 100 g basis', () => {
  const food = normalizeFood(rice);
  assert.equal(food.food_name, rice.description);
  assert.equal(food.basis_quantity, 100);
  assert.equal(food.basis_unit, 'g');
  assert.deepEqual(food.basis, { energy_kcal: 130, protein_g: 2.69, carbs_g: 28.17, fat_g: 0.28 });
  assert.equal(normalizeFood({ ...rice, dataType: 'Branded' }), null);
});
test('unit checks, kJ conversion, alternate energy IDs, and missing nutrients', () => {
  const food = normalizeFood({ ...rice, foodNutrients: [row(1062, 'kJ', 418.4), row(1003, 'G', 0), row(1004, 'MG', 25)] });
  assert.ok(Math.abs(food.basis.energy_kcal - 100) < 1e-9);
  assert.equal(food.basis.protein_g, 0);
  assert.equal(food.basis.carbs_g, null);
  assert.equal(food.basis.fat_g, null);
  assert.equal(normalizeFood({ ...rice, foodNutrients: [row(2048, 'KCAL', 110)] }).basis.energy_kcal, 110);
  assert.equal(normalizeFood({ ...rice, foodNutrients: [row(1003, 'G', -1)] }), null);
  assert.equal(normalizeFood({ ...rice, foodNutrients: [row(1003, 'G', null)] }), null);
});
test('search drops duplicates and malformed/unsupported foods', () => {
  assert.equal(normalizeSearch({ foods: [rice, rice, { ...rice, fdcId: null }, null] }).length, 1);
  assert.throws(() => normalizeSearch({ error: 'bad' }));
});
test('search caches equivalent queries, sends generic food filters, and uses server key', async () => {
  let calls = 0;
  const search = createFoodSearch({ apiKey: 'test-key', fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url.searchParams.get('api_key'), 'test-key');
    const body = JSON.parse(options.body);
    assert.equal(body.query, 'rice cooked');
    assert.deepEqual(body.dataType, ['Foundation', 'SR Legacy', 'Survey (FNDDS)']);
    assert.equal(body.pageSize, 20);
    return response();
  } });
  assert.equal((await search(' Rice   Cooked ')).cached, false);
  assert.equal((await search('rice cooked')).cached, true);
  assert.equal(calls, 1);
});
test('concurrent identical requests share one upstream call and cache expires', async () => {
  let calls = 0, time = 0;
  const search = createFoodSearch({ now: () => time, fetchImpl: async () => { calls++; return response(); } });
  await Promise.all([search('rice'), search('rice'), search('rice')]);
  assert.equal(calls, 1);
  time += 24 * 60 * 60 * 1000 + 1;
  await search('rice');
  assert.equal(calls, 2);
});
test('429 pauses future upstream requests for an hour without retry storms', async () => {
  let calls = 0, time = 0;
  const search = createFoodSearch({ now: () => time, fetchImpl: async () => { calls++; return new Response('', { status: 429 }); } });
  await assert.rejects(search('rice'), error => error.status === 429);
  await assert.rejects(search('eggs'), error => error.status === 429);
  assert.equal(calls, 1);
  time += 60 * 60 * 1000;
  await assert.rejects(search('eggs'), error => error.status === 429);
  assert.equal(calls, 2);
});
test('demo limits enforce hourly and daily budgets while cached results remain usable', async () => {
  let time = 0, calls = 0;
  const search = createFoodSearch({ now: () => time, fetchImpl: async () => { calls++; return response(); } });
  for (let i = 0; i < 25; i++) await search(`food ${i}`);
  await assert.rejects(search('new food'), error => error.status === 429);
  assert.equal((await search('food 0')).cached, true);
  time += 60 * 60 * 1000;
  for (let i = 25; i < 40; i++) await search(`food ${i}`);
  await assert.rejects(search('new food'), error => error.status === 429);
  assert.equal(calls, 40);
});
test('invalid queries never call USDA; failures do not leak credentials or get cached', async () => {
  let calls = 0;
  const search = createFoodSearch({ apiKey: 'private-key', fetchImpl: async () => { calls++; throw Error('private-key'); } });
  for (const query of [null, '', 'x', 'x'.repeat(101)]) await assert.rejects(search(query), error => error.status === 400);
  assert.equal(calls, 0);
  await assert.rejects(search('rice'), error => error.status === 502 && !error.message.includes('private-key'));
  await assert.rejects(search('rice'));
  assert.equal(calls, 2);
});
test('malformed provider responses and credential failures return usable errors', async () => {
  const badData = createFoodSearch({ fetchImpl: async () => new Response('{}') });
  await assert.rejects(badData('rice'), error => error.status === 502);
  const badKey = createFoodSearch({ fetchImpl: async () => new Response('', { status: 403 }) });
  await assert.rejects(badKey('rice'), error => error.status === 503);
});
test('selected food snapshots provenance; edits scale original basis; overrides become manual', () => {
  const food = normalizeFood(rice);
  const values = { food_name: food.food_name, diary_date: '2026-10-08', meal: 'lunch', quantity: '150', unit: 'g', basis_quantity: 100, ...food.basis, reference: food };
  const entry = makeEntry(values);
  assert.equal(entry.snapshot.energy_kcal, 195);
  assert.equal(entry.source, 'usda'); assert.equal(entry.source_id, food.source_id);
  const updated = makeEntry({ ...values, quantity: 200, reference: entry }, entry);
  assert.equal(updated.snapshot.energy_kcal, 260); assert.equal(updated.source, 'usda');
  assert.equal(makeEntry({ ...values, energy_kcal: 125 }, entry).source, 'manual');
  assert.equal(makeEntry({ ...values, reference: null }, entry).source, 'manual');
  assert.equal(makeEntry({ ...values, food_name: 'Other food' }).source, 'manual');
});
