// Search responses from generic USDA food types express nutrient values per 100 g.
const genericTypes = new Set(['Foundation', 'SR Legacy', 'Survey (FNDDS)']);
function nutrient(food, id, unit) {
  const rows = Array.isArray(food.foodNutrients) ? food.foodNutrients : [];
  const item = rows.find(row => Number(row.nutrientId ?? row.nutrient?.id) === id && String(row.unitName ?? row.nutrient?.unitName).toUpperCase() === unit);
  const value = item?.value ?? item?.amount;
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
export function normalizeFood(food) {
  if (!food || !genericTypes.has(food.dataType) || !Number.isSafeInteger(food.fdcId) || food.fdcId <= 0 || typeof food.description !== 'string') return null;
  const kcal = nutrient(food, 1008, 'KCAL') ?? nutrient(food, 2048, 'KCAL') ?? nutrient(food, 2047, 'KCAL');
  const kj = nutrient(food, 1062, 'KJ');
  const basis = {
    energy_kcal: kcal ?? (kj === null ? null : kj / 4.184),
    protein_g: nutrient(food, 1003, 'G'),
    carbs_g: nutrient(food, 1005, 'G'),
    fat_g: nutrient(food, 1004, 'G'),
  };
  if (Object.values(basis).every(value => value === null)) return null;
  return {
    source: 'usda', source_id: String(food.fdcId), food_name: food.description.slice(0, 150),
    data_type: food.dataType, basis_quantity: 100, basis_unit: 'g', basis,
    fetched_at: new Date().toISOString(), provider_url: `https://fdc.nal.usda.gov/food-details/${food.fdcId}/nutrients`,
  };
}

export function normalizeSearch(payload) {
  if (!payload || !Array.isArray(payload.foods)) throw Error('USDA returned an unexpected response.');
  const seen = new Set();
  return payload.foods.map(normalizeFood).filter(food => {
    if (!food || seen.has(food.source_id)) return false;
    seen.add(food.source_id);
    return true;
  }).slice(0, 20);
}
