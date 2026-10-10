// Small public-data snapshot for the reported food. Live USDA portions take
// priority. This keeps its portions usable when the separate detail lookup is
// rate limited. Weights only apply to this exact FDC record and description.
// Record: https://fdc.nal.usda.gov/food-details/2708815/nutrients
// Public reproductions checked 2026-10-09:
// https://feastapp.ai/nutrition/meals/macaroni-or-noodles-with-cheese-easy-mac-type/
// https://getfoodfacts.com/food/macaroni-or-noodles-with-cheese-easy-mac-type-2708815
export function cachedUsdaPortions(food) {
  if (food.source !== 'usda' || String(food.source_id) !== '2708815' || food.food_name?.trim().toLowerCase() !== 'macaroni or noodles with cheese, easy mac type') return [];
  return [
    { id: 'cached-cup', label: '1 cup', grams: 230, cached: true },
    { id: 'cached-tub', label: '1 microwavable tub, regular size, prepared', grams: 212, cached: true },
    { id: 'cached-large-tub', label: '1 large microwavable tub, prepared', grams: 423, cached: true },
  ];
}
