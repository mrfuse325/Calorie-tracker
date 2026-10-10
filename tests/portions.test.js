import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFood, normalizePortions } from '../src/usda.js';
import { servingReference, gramReference, defaultPortion, suggestedPortion, availablePortions } from '../src/portions.js';
import { makeEntry } from '../src/nutrition.js';
const food = { source: 'usda', source_id: '123', food_name: 'Rice, cooked', basis_quantity: 100, basis_unit: 'g', basis: { energy_kcal: 130, protein_g: 2.7, carbs_g: 28, fat_g: null }, portions: [{ id: 'cup', label: '1 cup', grams: 158 }] };
test('default serving prefers a whole household portion over weight references and fractions', () => {
  const portions = [{ id: 'weight', label: '100 g', grams: 100 }, { id: 'half', label: '0.5 cup', grams: 79 }, ...food.portions];
  assert.equal(defaultPortion(portions).id, 'cup');
  assert.equal(defaultPortion(portions.slice(0, 2)).id, 'half');
  assert.equal(defaultPortion(portions.slice(0, 1)).id, 'weight');
  assert.equal(defaultPortion([]), null);
});
test('missing serving data uses food-specific estimates rather than one gram', () => {
  for (const [name, grams] of [['Rice, cooked', 80], ['Salmon, cooked', 84], ['Chicken, roasted', 80], ['Beef, cooked', 65], ['Broccoli, raw', 75], ['Apples, raw', 150]]) {
    const portion = availablePortions({ food_name: name, portions: [{ id: 'g', label: '1 g', grams: 1 }] })[0];
    assert.equal(portion.grams, grams); assert.equal(portion.estimated, true);
  }
  assert.equal(servingReference(food, suggestedPortion('Rice, cooked').grams).basis.energy_kcal, 104);
  assert.equal(availablePortions(food)[0].grams, 158);
  for (const name of ['Rice, uncooked', 'Apple juice', 'Bananas, dried', 'Chicken soup', 'Lasagna', 'Snack mix', 'Chicken, raw']) assert.equal(suggestedPortion(name), null);
});
test('published portions retain their actual measure weight, including fractional portions', () => {
  assert.deepEqual(normalizePortions({ foodPortions: [{ id: 1, amount: 1, modifier: 'cup', gramWeight: 158 }, { id: 2, amount: 0.5, modifier: 'cup', gramWeight: 79 }, { id: 3, portionDescription: '1 slice', gramWeight: 30 }, { id: 4, amount: 1, measureUnit: { name: 'piece' }, gramWeight: 50 }] }), [{ id: '1', label: '1 cup', grams: 158 }, { id: '2', label: '0.5 cup', grams: 79 }, { id: '3', label: '1 slice', grams: 30 }, { id: '4', label: '1 piece', grams: 50 }]);
  assert.deepEqual(normalizePortions({ foodPortions: [{ modifier: 'cup', gramWeight: 0 }, { modifier: 'cup' }, { gramWeight: 100 }, { modifier: 'cup', gramWeight: 'NaN' }] }), []);
});
test('per-serving nutrition uses actual serving grams, preserves missing values, and logs fractional servings', () => {
  const reference = servingReference(food, 158, '1 cup');
  assert.equal(reference.basis.energy_kcal, 205.4);
  assert.equal(reference.basis.fat_g, null);
  assert.equal(reference.basis_quantity, 1);
  const values = { food_name: food.food_name, diary_date: '2026-10-08', meal: 'lunch', unit: 'serving', quantity: 1.5, basis_quantity: 1, ...reference.basis, reference };
  const entry = makeEntry(values);
  assert.ok(Math.abs(entry.snapshot.energy_kcal - 308.1) < 1e-9);
  assert.equal(entry.serving_label, '1 cup'); assert.equal(entry.serving_grams, 158); assert.equal(entry.source, 'usda');
  const edited = makeEntry({ ...values, quantity: 2, reference: entry }, entry);
  assert.equal(edited.snapshot.energy_kcal, 410.8); assert.equal(edited.serving_grams, 158);
  assert.ok(Math.abs(gramReference(entry).basis.energy_kcal - 130) < 1e-9);
});
test('no portion data means no invented serving weight', () => {
  assert.throws(() => servingReference(food, ''));
  assert.throws(() => servingReference(food, 0));
  assert.throws(() => servingReference(food, Infinity));
  assert.equal(gramReference({ ...food, basis_unit: 'serving', serving_grams: null }), null);
  const normalized = normalizeFood({ fdcId: 1, description: 'Rice', dataType: 'Foundation', foodNutrients: [{ nutrientId: 1008, unitName: 'KCAL', value: 130 }] });
  assert.deepEqual(normalized.portions, []);
});
test('manual labels use one serving by default without requiring a gram conversion', () => {
  const entry = makeEntry({ food_name: 'Yogurt', diary_date: '2026-10-08', meal: 'snack', unit: 'serving', quantity: 2, basis_quantity: 1, energy_kcal: 120, protein_g: 15, carbs_g: null, fat_g: 0, serving_label: '1 container' });
  assert.equal(entry.snapshot.energy_kcal, 240); assert.equal(entry.serving_label, '1 container'); assert.equal(entry.source, 'manual');
});
