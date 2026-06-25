/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const WATCHMODE_KEY = (import.meta as any).env?.VITE_WATCHMODE_API_KEY || 'omtsz1CMOqbxCuhp2NluW163bG7ZGZAipMzUssT1';
const WM_BASE = 'https://api.watchmode.com/v1';

export interface StreamingSource {
  source_id: number;
  name: string;
  type: string; // sub | rent | buy | free
  web_url: string;
  format?: string;
  price?: number | null;
  region: string;
}

const sourcesCache = new Map<string, StreamingSource[]>();

/**
 * Fetch streaming sources for a title by its TMDB id.
 * Step 1: resolve TMDB id -> Watchmode id via /search/
 * Step 2: fetch /title/{wmId}/sources/
 */
export async function fetchStreamingSources(
  type: 'movie' | 'tv',
  tmdbId: number,
  regions: string = ''
): Promise<StreamingSource[]> {
  const cacheKey = `${type}-${tmdbId}-${regions || 'all'}`;
  if (sourcesCache.has(cacheKey)) return sourcesCache.get(cacheKey)!;

  try {
    const searchField = type === 'movie' ? 'tmdb_movie_id' : 'tmdb_tv_id';
    const searchUrl = `${WM_BASE}/search/?apiKey=${WATCHMODE_KEY}&search_field=${searchField}&search_value=${tmdbId}`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) throw new Error(`Watchmode search ${searchRes.status}`);
    const searchData = await searchRes.json();
    const wmId = searchData?.title_results?.[0]?.id;
    if (!wmId) {
      sourcesCache.set(cacheKey, []);
      return [];
    }

    const regionParam = regions ? `&regions=${regions}` : '';
    const srcUrl = `${WM_BASE}/title/${wmId}/sources/?apiKey=${WATCHMODE_KEY}${regionParam}`;
    const srcRes = await fetch(srcUrl);
    if (!srcRes.ok) throw new Error(`Watchmode sources ${srcRes.status}`);
    const data = await srcRes.json();
    const list: StreamingSource[] = Array.isArray(data) ? data : [];
    sourcesCache.set(cacheKey, list);
    return list;
  } catch (err) {
    console.error('fetchStreamingSources error:', err);
    return [];
  }
}

// Deduplicate by provider name, prefer subscription type
export function dedupeSources(sources: StreamingSource[]): StreamingSource[] {
  const typeRank: Record<string, number> = { sub: 0, free: 1, rent: 2, buy: 3 };
  const byName = new Map<string, StreamingSource>();
  for (const s of sources) {
    const existing = byName.get(s.name);
    if (!existing || (typeRank[s.type] ?? 9) < (typeRank[existing.type] ?? 9)) {
      byName.set(s.name, s);
    }
  }
  return Array.from(byName.values());
}

export const sourceTypeLabel = (type: string): string => {
  switch (type) {
    case 'sub': return 'اشتراك';
    case 'free': return 'مجاني';
    case 'rent': return 'إيجار';
    case 'buy': return 'شراء';
    default: return '';
  }
};
