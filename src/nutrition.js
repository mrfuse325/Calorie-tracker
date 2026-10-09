export const nutrients = ['energy_kcal', 'protein_g', 'carbs_g', 'fat_g'];
export const meals = ['breakfast', 'lunch', 'dinner', 'snack'];
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && localDate(date) === value;
}
export function numberValue(value, { positive = false } = {}) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || (positive && parsed === 0)) throw Error('Enter valid nonnegative numbers; quantities must be greater than zero.');
  return parsed;
}
export function scale(basis, quantity, basisQuantity) {
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(basisQuantity) || basisQuantity <= 0) throw Error('Quantity and nutrition basis must be greater than zero.');
  const result = Object.fromEntries(nutrients.map(key => {
    const value = numberValue(basis[key]);
    const scaled = value === null ? null : value * quantity / basisQuantity;
    if (scaled !== null && !Number.isFinite(scaled)) throw Error('Nutrition values are too large.');
    return [key, scaled];
  }));
  return result;
}
export function makeEntry(values, previous = null) {
  const food_name = String(values.food_name || '').trim();
  if (!food_name || food_name.length > 150) throw Error('Enter a food name of 1–150 characters.');
  if (!validDate(values.diary_date)) throw Error('Choose a valid date.');
  if (!meals.includes(values.meal)) throw Error('Choose a meal.');
  if (!['g', 'ml', 'serving'].includes(values.unit)) throw Error('Choose a supported unit.');
  const quantity = numberValue(values.quantity, { positive: true });
  const basis_quantity = numberValue(values.basis_quantity, { positive: true });
  const basis = Object.fromEntries(nutrients.map(key => [key, numberValue(values[key])]));
  if (nutrients.every(key => basis[key] === null)) throw Error('Enter at least one nutrition value. Leave unknown values blank.');
  const snapshot = scale(basis, quantity, basis_quantity);
  const now = new Date().toISOString();
  const reference = Object.hasOwn(values, 'reference') ? values.reference : previous;
  const matchesReference = reference?.source === 'usda' && reference.food_name === food_name && reference.basis_unit === values.unit && reference.basis_quantity === basis_quantity && nutrients.every(key => reference.basis?.[key] === basis[key]);
  const portion = values.unit === 'serving' ? { serving_label: String(values.serving_label || reference?.serving_label || '1 serving').trim().slice(0, 100) } : {};
  return { id: previous?.id || crypto.randomUUID(), food_name, diary_date: values.diary_date, meal: values.meal, quantity, unit: values.unit, basis_quantity, basis_unit: values.unit, basis, snapshot, ...portion, source: matchesReference ? 'usda' : 'manual', ...(matchesReference ? { source_id: reference.source_id, fetched_at: reference.fetched_at, provider_url: reference.provider_url, ...(reference.serving_grams ? { serving_grams: reference.serving_grams } : {}) } : {}), created_at: previous?.created_at || now, updated_at: now };
}
export function totals(entries) {
  return Object.fromEntries(nutrients.map(key => [key, entries.reduce((total, entry) => {
    const value = entry.snapshot[key];
    if (value === null || value === undefined) total.missing++;
    else total.value += value;
    return total;
  }, { value: 0, missing: 0 })]));
}
