import { nutrients, scale } from './nutrition.js';
import { cachedUsdaPortions } from './usda-serving-cache.js';

// Provider ordering can put a weight reference ahead of household measures.
// Prefer a published whole household portion without inventing a food's size.
export function defaultPortion(portions = []) {
  const household = portions.filter(portion => !/^\s*\d+(?:\.\d+)?\s*(?:g|grams?|kg|oz|ounces?|lb|pounds?)\b/i.test(portion.label));
  return household.find(portion => /^\s*1\s+(?!\/)/.test(portion.label)) || household[0] || portions[0] || null;
}

// Approximate defaults requested for common foods. These are portion estimates,
// not exact weights for an individual cup/piece or a mixed meal.
export function suggestedPortion(foodName = '') {
  const name = foodName.trim().toLowerCase();
  if (/\b(dried|dehydrated|juice|powder|flour|chips|sauce|soup|stew|sandwich|pizza|salad|lasagna|pie|snack|baby food)\b/.test(name)) return null;
  let grams, label;
  if (/^(rice|pasta|spaghetti|macaroni|noodles)\b/.test(name) && /\bcooked\b/.test(name) && !/\b(uncooked|dry|raw)\b/.test(name)) { grams = 80; label = '½ cup cooked'; }
  else if (/^(fish|salmon|tuna|cod|tilapia|trout|haddock|halibut|sardines)\b/.test(name)) { grams = 84; label = '3 oz portion'; }
  else if (/^(chicken|turkey|poultry|duck)\b/.test(name) && !/\braw\b/.test(name)) { grams = 80; label = 'Poultry portion'; }
  else if (/^(beef|pork|lamb|veal|venison|meat)\b/.test(name) && !/\braw\b/.test(name)) { grams = 65; label = 'Meat portion'; }
  else if (/^(vegetables?|broccoli|carrots?|spinach|cauliflower|cabbage|peas|green beans|zucchini|lettuce|tomatoes?|cucumber|peppers?)\b/.test(name)) { grams = 75; label = 'Vegetable portion'; }
  else if (/^(fruit|apples?|bananas?|oranges?|pears?|peaches?|grapes?|berries|strawberries|blueberries|melon|watermelon|mango|pineapple|kiwi)\b/.test(name)) { grams = 150; label = 'Fruit portion'; }
  else return null;
  return { id: 'estimated-standard', grams, label: `${label} (estimated)`, estimated: true };
}

export function availablePortions(food) {
  const published = (food.portions || []).filter(portion => portion.grams > 1);
  if (published.length) return published;
  const cached = cachedUsdaPortions(food);
  if (cached.length) return cached;
  const estimate = suggestedPortion(food.food_name);
  return estimate ? [estimate] : [];
}

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
