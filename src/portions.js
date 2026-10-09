import { nutrients, scale } from './nutrition.js';

export function servingReference(food, grams, label = '1 serving') {
  const serving_grams = Number(grams);
  if (grams === '' || !Number.isFinite(serving_grams) || serving_grams <= 0 || serving_grams > 10000) throw Error('Enter the weight in grams for one serving, or choose a USDA portion.');
  const basis = scale(food.basis, serving_grams, food.basis_quantity);
  return { ...food, basis, basis_quantity: 1, basis_unit: 'serving', serving_grams, serving_label: String(label).trim().slice(0, 100) || '1 serving', original_basis: { ...food.basis } };
}

export function gramReference(entry) {
  if (entry.basis_unit === 'g') return entry;
  if (entry.basis_unit !== 'serving' || !Number.isFinite(entry.serving_grams) || entry.serving_grams <= 0) return null;
  const basis = Object.fromEntries(nutrients.map(key => [key, entry.basis[key] === null ? null : entry.basis[key] * 100 / entry.serving_grams]));
  return { ...entry, basis, basis_quantity: 100, basis_unit: 'g' };
}
