import { normalizeSearch } from './src/usda.js';

export class FoodApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// This proxy serves the single local Node process. A hosted deployment needs a
// shared quota limiter; resetting this process also resets these counters.
export function createFoodSearch({ apiKey = process.env.USDA_API_KEY || 'DEMO_KEY', fetchImpl = fetch, now = Date.now } = {}) {
  const cache = new Map(), pending = new Map();
  const demo = apiKey === 'DEMO_KEY';
  let hourStart = now(), dayStart = now(), hourly = 0, daily = 0, blockedUntil = 0;
  const hour = 60 * 60 * 1000, day = 24 * hour;
  const allowance = { hourly: demo ? 25 : 800, daily: demo ? 40 : 5000 };

  async function search(rawQuery) {
    if (typeof rawQuery !== 'string') throw new FoodApiError(400, 'Enter a food name.');
    const query = rawQuery.trim().replace(/\s+/g, ' ').toLowerCase();
    if (query.length < 2 || query.length > 100) throw new FoodApiError(400, 'Search using 2–100 characters.');
    const time = now();
    const cached = cache.get(query);
    if (cached && cached.expires > time) return { ...cached.result, cached: true };
    if (pending.has(query)) return pending.get(query);
    if (time < blockedUntil) throw new FoodApiError(429, 'Food search is temporarily paused by USDA. Try later or enter nutrition manually.');
    if (time - hourStart >= hour) { hourStart = time; hourly = 0; }
    if (time - dayStart >= day) { dayStart = time; daily = 0; }
    if (hourly >= allowance.hourly || daily >= allowance.daily) throw new FoodApiError(429, demo ? 'The limited demo search allowance has been reached. Try later, use a free USDA key, or enter nutrition manually.' : 'The food search allowance has been reached. Try later or enter nutrition manually.');
    hourly++; daily++;
    const operation = (async () => {
      try {
        const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
        url.searchParams.set('api_key', apiKey);
        const response = await fetchImpl(url, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ query, pageSize: 20, dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)'] }),
          signal: AbortSignal.timeout(8000),
        });
        if (response.status === 429) {
          blockedUntil = now() + hour;
          throw new FoodApiError(429, 'USDA has paused food search. Try again later or enter nutrition manually.');
        }
        if (response.status === 401 || response.status === 403) throw new FoodApiError(503, 'Food search credentials are unavailable. Check the server USDA key or enter nutrition manually.');
        if (!response.ok) throw new FoodApiError(502, 'USDA food search is unavailable. Try later or enter nutrition manually.');
        const foods = normalizeSearch(await response.json());
        const result = { foods, mode: demo ? 'demo' : 'personal-key', cached: false };
        if (cache.size >= 100) cache.delete(cache.keys().next().value);
        cache.set(query, { result, expires: now() + day });
        return result;
      } catch (error) {
        if (error instanceof FoodApiError) throw error;
        throw new FoodApiError(502, 'Could not reach food search. Check your connection or enter nutrition manually.');
      }
    })();
    pending.set(query, operation);
    try { return await operation; } finally { pending.delete(query); }
  }
  return search;
}
