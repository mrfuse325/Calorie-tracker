import test from 'node:test';
import assert from 'node:assert/strict';
import { makeEntry, scale, totals, localDate, validDate } from '../src/nutrition.js';
const basis = { energy_kcal: 130, protein_g: 2.7, carbs_g: null, fat_g: 0 };
const values = { food_name: 'Cooked rice', diary_date: '2026-10-08', meal: 'lunch', quantity: '150', unit: 'g', basis_quantity: '100', ...basis };
test('scales known nutrition while preserving missing values and genuine zero', () => {
  assert.deepEqual(scale(basis, 150, 100), { energy_kcal: 195, protein_g: 4.05, carbs_g: null, fat_g: 0 });
});
test('editing quantity retains identity, creation time, and original nutrition basis', () => {
  const original = makeEntry(values);
  const updated = makeEntry({ ...values, quantity: '200' }, original);
  assert.equal(updated.id, original.id);
  assert.equal(updated.created_at, original.created_at);
  assert.equal(updated.snapshot.energy_kcal, 260);
  assert.deepEqual(updated.basis, original.basis);
  assert.equal(original.snapshot.energy_kcal, 195);
});
test('totals count incomplete nutrients rather than silently presenting complete data', () => {
  const entry = makeEntry(values);
  const other = makeEntry({ ...values, energy_kcal: '', carbs_g: '10' });
  const result = totals([entry, other]);
  assert.deepEqual(result.energy_kcal, { value: 195, missing: 1 });
  assert.deepEqual(result.carbs_g, { value: 15, missing: 1 });
  assert.deepEqual(totals([]).energy_kcal, { value: 0, missing: 0 });
});
test('rejects invalid, absent, negative, zero, and overflowing quantities', () => {
  for (const quantity of ['-1', '0', '', 'Infinity', 'abc']) assert.throws(() => makeEntry({ ...values, quantity }));
  assert.throws(() => scale(basis, 1e308, 1e-308));
  assert.throws(() => makeEntry({ ...values, protein_g: '-1' }));
  assert.throws(() => makeEntry({ ...values, basis_quantity: '' }));
});
test('manual entry validates food, date, meal, units, and entirely unknown nutrition', () => {
  for (const patch of [{ food_name: ' ' }, { diary_date: '2026-02-30' }, { meal: 'invalid' }, { unit: 'cup' }, { energy_kcal: '', protein_g: '', carbs_g: '', fat_g: '' }]) assert.throws(() => makeEntry({ ...values, ...patch }));
  assert.equal(validDate('2024-02-29'), true);
  assert.equal(validDate('2026-02-29'), false);
});
test('whole-entry nutrition works by matching basis and amount', () => {
  const entry = makeEntry({ ...values, unit: 'serving', quantity: '1', basis_quantity: '1' });
  assert.equal(entry.snapshot.energy_kcal, 130);
});
test('date grouping uses local calendar components', () => {
  assert.equal(localDate(new Date(2026, 0, 2, 0, 1)), '2026-01-02');
});
