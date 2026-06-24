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

// Simple in-memory cache (per session)
const sourcesCache = new Map<string, StreamingSource[]>();

/**
 * Fetch streaming sources for a title by its TMDB id.
 * Uses Watchmode's TMDB-format lookup: movie-{id} or tv-{id}.
 */
export async function fetchStreamingSources(
  type: 'movie' | 'tv',
  tmdbId: number,
  regions: string = 'US'
): Promise<StreamingSource[]> {
  const cacheKey = `${type}-${tmdbId}-${regions}`;
  if (sourcesCache.has(cacheKey)) return sourcesCache.get(cacheKey)!;

  try {
    const wmId = `${type}-${tmdbId}`;
    const url = `${WM_BASE}/title/${wmId}/sources/?apiKey=${WATCHMODE_KEY}&regions=${regions}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Watchmode ${res.status}`);
    const data = await res.json();
    const list: StreamingSource[] = Array.isArray(data) ? data : [];
    sourcesCache.set(cacheKey, list);
    return list;
  } catch (err) {
    console.error('fetchStreamingSources error:', err);
    return [];
  }
}

// Deduplicate sources by name, prefer subscription type, keep one entry per provider
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
