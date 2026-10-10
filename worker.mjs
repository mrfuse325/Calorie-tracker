import { createFoodSearch, FoodApiError } from './food-api.mjs';

export async function foodResponse(request, lookup) {
  const url = new URL(request.url);
  const detail = url.pathname.match(/^\/api\/foods\/usda\/(\d{1,12})$/);
  const json = (data, status = 200, extra = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...extra } });
  if (url.pathname !== '/api/foods/search' && !detail) return json({ error: 'Not found' }, 404);
  if (request.method !== 'GET') return json({ error: 'Use GET for food lookup.' }, 405, { Allow: 'GET' });
  try { return json(await (detail ? lookup.details(detail[1]) : lookup(url.searchParams.get('q')))); }
  catch (error) { return json({ error: error instanceof FoodApiError ? error.message : 'Food lookup is unavailable.' }, error instanceof FoodApiError ? error.status : 503); }
}

// One SQLite-backed Durable Object coordinates upstream quotas across all
// hosted requests. Only quota counters are persisted; diaries stay on-device.
export class NutritionProxy {
  constructor(ctx, env) {
    this.ready = ctx.blockConcurrencyWhile(async () => {
      const initialState = await ctx.storage.get('quota');
      this.lookup = createFoodSearch({ apiKey: env.USDA_API_KEY || 'DEMO_KEY', initialState, saveState: state => ctx.storage.put('quota', state) });
    });
  }
  async fetch(request) { await this.ready; return foodResponse(request, this.lookup); }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      if (!env.NUTRITION_PROXY) return Response.json({ error: 'Food lookup is not configured. Manual entry remains available.' }, { status: 503 });
      const id = env.NUTRITION_PROXY.idFromName('usda-shared-budget');
      return env.NUTRITION_PROXY.get(id).fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};
