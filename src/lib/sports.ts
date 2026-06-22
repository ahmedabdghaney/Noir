/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SportSRC football live-match helpers.
 * Free JSON API, CORS-enabled, no key required.
 */

const BASE = 'https://api.sportsrc.org/';

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

export async function fetchFootballMatches(): Promise<SportMatch[]> {
  try {
    const res = await fetch(`${BASE}?data=matches&category=football`);
    const json = await res.json();
    return json?.data || [];
  } catch (err) {
    console.error('fetchFootballMatches error:', err);
    return [];
  }
}

export async function fetchSportDetail(id: string): Promise<any | null> {
  try {
    const res = await fetch(`${BASE}?data=detail&category=football&id=${encodeURIComponent(id)}`);
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

// Collect ALL stream sources/servers for a match.
export function extractStreamSources(detail: any): { label: string; url: string }[] {
  if (!detail) return [];
  const out: { label: string; url: string }[] = [];

  const pushUrl = (url: any, label: string) => {
    if (typeof url === 'string' && url.startsWith('http')) {
      out.push({ label, url });
    }
  };

  pushUrl(detail.embed, 'البث');
  pushUrl(detail.embedUrl, 'البث');
  pushUrl(detail.stream, 'البث');
  pushUrl(detail.streamUrl, 'البث');
  pushUrl(detail.iframe, 'البث');
  pushUrl(detail.url, 'البث');
  pushUrl(detail.link, 'البث');

  const arrays = [detail.sources, detail.servers, detail.streams, detail.channels];
  arrays.forEach((arr) => {
    if (Array.isArray(arr)) {
      arr.forEach((s: any, i: number) => {
        if (typeof s === 'string') {
          pushUrl(s, `سيرفر ${i + 1}`);
        } else if (s && typeof s === 'object') {
          const url = s.url || s.embed || s.link || s.src;
          const label = s.name || s.label || s.title || `سيرفر ${i + 1}`;
          pushUrl(url, label);
        }
      });
    }
  });

  if (typeof detail.embedCode === 'string') {
    const m = detail.embedCode.match(/src=["']([^"']+)["']/);
    if (m) pushUrl(m[1], 'البث');
  }

  const seen = new Set<string>();
  return out.filter((s) => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}
