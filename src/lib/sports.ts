/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SportSRC live-stream data helpers.
 * Free JSON API, CORS-enabled, no key required.
 */

const BASE = 'https://api.sportsrc.org/';

export interface SportCategory {
  id: string;
  name: string;
}

export interface SportTeam {
  name: string | null;
  badge: string;
}

export interface SportMatch {
  id: string;
  title: string;
  category: string;
  date: number; // Unix ms
  popular?: boolean;
  poster: string;
  teams: {
    home: SportTeam;
    away: SportTeam;
  };
}

// Arabic names for the categories we surface (keeps the UI simple/localized).
export const CATEGORY_LABELS_AR: Record<string, string> = {
  football: 'كرة القدم',
  basketball: 'كرة السلة',
  'american-football': 'كرة القدم الأمريكية',
  hockey: 'الهوكي',
  baseball: 'البيسبول',
  'motor-sports': 'رياضة السيارات',
  fight: 'النزالات (UFC والملاكمة)',
  tennis: 'التنس',
  rugby: 'الرغبي',
  golf: 'الغولف',
  billiards: 'البلياردو',
  afl: 'الكرة الأسترالية',
  darts: 'الدارتس',
  cricket: 'الكريكيت',
  other: 'رياضات أخرى',
};

export async function fetchSportCategories(): Promise<SportCategory[]> {
  try {
    const res = await fetch(`${BASE}?data=sports`);
    const json = await res.json();
    return json?.data || [];
  } catch (err) {
    console.error('fetchSportCategories error:', err);
    return [];
  }
}

export async function fetchSportMatches(category: string): Promise<SportMatch[]> {
  try {
    const res = await fetch(`${BASE}?data=matches&category=${encodeURIComponent(category)}`);
    const json = await res.json();
    return json?.data || [];
  } catch (err) {
    console.error('fetchSportMatches error:', err);
    return [];
  }
}

// Detail returns the streaming embed. Shape varies, so we return the raw object
// and extract an embed URL/iframe defensively in the component.
export async function fetchSportDetail(category: string, id: string): Promise<any | null> {
  try {
    const res = await fetch(
      `${BASE}?data=detail&category=${encodeURIComponent(category)}&id=${encodeURIComponent(id)}`,
    );
    const json = await res.json();
    const data = json?.data;
    if (Array.isArray(data)) {
      return data.find((m) => m.id === id) || data[0] || null;
    }
    return data || null;
  } catch (err) {
    console.error('fetchSportDetail error:', err);
    return null;
  }
}

// Pull a usable stream/embed URL out of a detail object, whatever shape it takes.
export function extractStreamUrl(detail: any): string | null {
  if (!detail) return null;
  // Common possible fields
  const candidates = [
    detail.embed,
    detail.embedUrl,
    detail.stream,
    detail.streamUrl,
    detail.url,
    detail.iframe,
    detail.link,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.startsWith('http')) return c;
  }
  // sources array
  if (Array.isArray(detail.sources) && detail.sources.length) {
    const s = detail.sources[0];
    if (typeof s === 'string' && s.startsWith('http')) return s;
    if (s && typeof s.url === 'string') return s.url;
    if (s && typeof s.embed === 'string') return s.embed;
  }
  // servers array
  if (Array.isArray(detail.servers) && detail.servers.length) {
    const s = detail.servers[0];
    if (typeof s === 'string' && s.startsWith('http')) return s;
    if (s && typeof s.url === 'string') return s.url;
    if (s && typeof s.embed === 'string') return s.embed;
  }
  // If detail has raw html iframe, extract src
  if (typeof detail.embedCode === 'string') {
    const m = detail.embedCode.match(/src=["']([^"']+)["']/);
    if (m) return m[1];
  }
  return null;
}

// Collect ALL stream sources/servers for a match, for a simple channel list.
export function extractStreamSources(detail: any): { label: string; url: string }[] {
  if (!detail) return [];
  const out: { label: string; url: string }[] = [];

  const pushUrl = (url: any, label: string) => {
    if (typeof url === 'string' && url.startsWith('http')) {
      out.push({ label, url });
    }
  };

  // Single fields
  pushUrl(detail.embed, 'البث');
  pushUrl(detail.embedUrl, 'البث');
  pushUrl(detail.stream, 'البث');
  pushUrl(detail.streamUrl, 'البث');
  pushUrl(detail.iframe, 'البث');

  // Arrays of sources / servers / streams
  const arrays = [detail.sources, detail.servers, detail.streams, detail.channels];
  arrays.forEach((arr) => {
    if (Array.isArray(arr)) {
      arr.forEach((s: any, i: number) => {
        if (typeof s === 'string') {
          pushUrl(s, `قناة ${i + 1}`);
        } else if (s && typeof s === 'object') {
          const url = s.url || s.embed || s.link || s.src;
          const label = s.name || s.label || s.title || `قناة ${i + 1}`;
          pushUrl(url, label);
        }
      });
    }
  });

  // De-duplicate by url
  const seen = new Set<string>();
  return out.filter((s) => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}
