import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateGoals } from '../src/goals.js';
const profile = { age: '30', sex: 'male', measurement: 'metric', height_cm: '180', weight_kg: '80', activity: 'sedentary', protein_percent: '20', carbs_percent: '50', fat_percent: '30' };
test('Mifflin male estimate applies activity and preserves macro calorie balance', () => {
  const result = calculateGoals(profile);
  assert.equal(result.resting, 1780);
  assert.equal(result.goals.energy_kcal, 2136);
  assert.equal(result.protein_reference_g, 64);
  assert.equal(result.goals.protein_g, 106.8);
  assert.equal(result.goals.carbs_g, 267);
  assert.ok(Math.abs(result.goals.fat_g - 71.2) < 1e-9);
  assert.ok(Math.abs(result.goals.protein_g * 4 + result.goals.carbs_g * 4 + result.goals.fat_g * 9 - 2136) < 1e-9);
  assert.ok(Math.abs(result.ranges.carbs_g[0] - 240.3) < 1e-9);
  assert.ok(Math.abs(result.ranges.carbs_g[1] - 347.1) < 1e-9);
});
test('female coefficient and moderate activity are applied independently', () => {
  const result = calculateGoals({ ...profile, sex: 'female', activity: 'moderate' });
  assert.equal(result.resting, 1614);
  assert.equal(result.goals.energy_kcal, 2502);
});
test('equivalent metric and US measurements produce identical calories', () => {
  const metric = calculateGoals(profile);
  const us = calculateGoals({ ...profile, measurement: 'us', feet: 5, inches: 180 / 2.54 - 60, pounds: 80 / 0.45359237 });
  assert.equal(us.goals.energy_kcal, metric.goals.energy_kcal);
  assert.ok(Math.abs(us.height_cm - 180) < 1e-9);
  assert.ok(Math.abs(us.weight_kg - 80) < 1e-9);
});
test('split changes alter macros without changing maintenance calories', () => {
  const result = calculateGoals({ ...profile, protein_percent: 25, carbs_percent: 45, fat_percent: 30 });
  assert.equal(result.goals.energy_kcal, 2136);
  assert.equal(result.goals.protein_g, 133.5);
});
test('rejects missing measurements, unsupported people, invalid activity and mismatched splits', () => {
  for (const patch of [{ age: 18 }, { age: 81 }, { age: 30.5 }, { weight_kg: '' }, { height_cm: Infinity }, { sex: '' }, { measurement: 'other' }, { activity: 'bad' }, { protein_percent: 30 }, { fat_percent: -1 }, { protein_percent: 5, carbs_percent: 65, fat_percent: 30 }, { weight_kg: 0 }]) {
    assert.throws(() => calculateGoals({ ...profile, ...patch }));
  }
  for (const patch of [{ feet: 5.5 }, { inches: 12 }, { pounds: '' }, { feet: 3, inches: 0 }]) assert.throws(() => calculateGoals({ ...profile, measurement: 'us', feet: 5, inches: 10, pounds: 180, ...patch }));
});
test('weekly weight-loss rates subtract 250, 500, or 1000 kcal and rescale all macros', () => {
  const result = calculateGoals({ ...profile, loss_rate: 1 });
  assert.equal(result.maintenance_kcal, 2136); assert.equal(result.goals.energy_kcal, 1636); assert.equal(result.daily_deficit, 500);
  assert.equal(result.can_apply, true);
  assert.equal(result.goals.protein_g, 81.8);
  assert.equal(result.goals.carbs_g, 204.5);
  assert.ok(Math.abs(result.goals.fat_g * 9 + result.goals.protein_g * 4 + result.goals.carbs_g * 4 - 1636) < 1e-9);
  assert.deepEqual(result.options.map(option => option.calories), [2136, 1886, 1636, 1136]);
  assert.equal(result.options[3].eligible, false);
  assert.throws(() => calculateGoals({ ...profile, loss_rate: 3 }));
  assert.throws(() => calculateGoals({ ...profile, loss_rate: 0.75 }));
});
test('aggressive or underweight loss targets cannot be automatically applied', () => {
  const low = calculateGoals({ ...profile, loss_rate: 2 });
  assert.equal(low.goals.energy_kcal, 1136); assert.equal(low.can_apply, false);
  const underweight = calculateGoals({ ...profile, weight_kg: 50, loss_rate: 0.5 });
  assert.equal(underweight.can_apply, false); assert.match(underweight.restriction, /underweight/);
});
test('reference activity factor 1.465 supports feet and pounds consistently', () => {
  const result = calculateGoals({ ...profile, age: 25, measurement: 'us', feet: 5, inches: 10, pounds: 165, activity: 'some', loss_rate: 1 });
  assert.equal(result.activity_factor, 1.465);
  assert.equal(result.maintenance_kcal, Math.round((10 * 165 * 0.45359237 + 6.25 * 70 * 2.54 - 5 * 25 + 5) * 1.465));
  assert.equal(result.goals.energy_kcal, result.maintenance_kcal - 500);
});
