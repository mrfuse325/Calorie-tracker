import { normalizeFood, normalizeSearch } from './src/usda.js';

export class FoodApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Single shared service for searches and portion-details; a hosted Durable
// Object persists the quota state and coordinates every Worker instance.
export function createFoodSearch({ apiKey = globalThis.process?.env?.USDA_API_KEY || 'DEMO_KEY', fetchImpl = fetch, now = Date.now, initialState, saveState = async () => {} } = {}) {
  const cache = new Map(), pending = new Map();
  const demo = apiKey === 'DEMO_KEY';
  const hour = 60 * 60 * 1000, day = 24 * hour;
  const quota = initialState || { hourStart: now(), dayStart: now(), hourly: 0, daily: 0, blockedUntil: 0 };
  const allowance = { hourly: demo ? 25 : 800, daily: demo ? 40 : 5000 };

  async function load(key, path, requestOptions, normalize, ttl) {
    const time = now();
    const cached = cache.get(key);
    if (cached && cached.expires > time) return { ...cached.result, cached: true };
    if (pending.has(key)) return pending.get(key);
    if (time < quota.blockedUntil) throw new FoodApiError(429, 'Food search is temporarily paused by USDA. Try later or enter nutrition manually.');
    if (time - quota.hourStart >= hour) { quota.hourStart = time; quota.hourly = 0; }
    if (time - quota.dayStart >= day) { quota.dayStart = time; quota.daily = 0; }
    if (quota.hourly >= allowance.hourly || quota.daily >= allowance.daily) throw new FoodApiError(429, demo ? 'The limited demo food allowance has been reached. Try later, use a free USDA key, or enter nutrition manually.' : 'The food lookup allowance has been reached. Try later or enter nutrition manually.');
    quota.hourly++; quota.daily++;
    const operation = (async () => {
      try {
        await saveState({ ...quota });
        const url = new URL(`https://api.nal.usda.gov/fdc/v1/${path}`);
        url.searchParams.set('api_key', apiKey);
        const response = await fetchImpl(url, { ...requestOptions, signal: AbortSignal.timeout(8000) });
        if (response.status === 429) {
          quota.blockedUntil = now() + hour;
          await saveState({ ...quota });
          throw new FoodApiError(429, 'USDA has paused food lookup. Try again later or enter nutrition manually.');
        }
        if (response.status === 404) throw new FoodApiError(404, 'This food is no longer available from USDA. Choose another match or use manual entry.');
        if (response.status === 401 || response.status === 403) throw new FoodApiError(503, 'Food lookup credentials are unavailable. Check the server USDA key or enter nutrition manually.');
        if (!response.ok) throw new FoodApiError(502, 'USDA food lookup is unavailable. Try later or enter nutrition manually.');
        const normalized = normalize(await response.json());
        const result = { ...normalized, mode: demo ? 'demo' : 'personal-key', cached: false };
        if (cache.size >= 100) cache.delete(cache.keys().next().value);
        cache.set(key, { result, expires: now() + ttl });
        return result;
      } catch (error) {
        if (error instanceof FoodApiError) throw error;
        throw new FoodApiError(502, 'Could not reach food lookup. Check your connection or enter nutrition manually.');
      }
    })();
    pending.set(key, operation);
    try { return await operation; } finally { pending.delete(key); }
  }
  const search = async rawQuery => {
    if (typeof rawQuery !== 'string') throw new FoodApiError(400, 'Enter a food name.');
    const query = rawQuery.trim().replace(/\s+/g, ' ').toLowerCase();
    if (query.length < 2 || query.length > 100) throw new FoodApiError(400, 'Search using 2–100 characters.');
    return load(`search:${query}`, 'foods/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, pageSize: 20, dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)'] }),
    }, payload => ({ foods: normalizeSearch(payload) }), day);
  };
  search.details = async rawId => {
    if (!/^\d{1,12}$/.test(String(rawId)) || Number(rawId) <= 0) throw new FoodApiError(400, 'Choose a valid USDA food.');
    const id = String(Number(rawId));
    return load(`detail:${id}`, `food/${id}`, { method: 'GET', headers: { Accept: 'application/json' } }, payload => {
      const food = normalizeFood(payload);
      if (!food || food.source_id !== id) throw new FoodApiError(404, 'This food has no supported generic nutrition data. Choose another match.');
      return { food };
    }, 7 * day);
  };
  return search;
}
