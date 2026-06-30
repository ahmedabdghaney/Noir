/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MovieOrShow, DetailedInfo } from '../types';

const FALLBACK_KEY = 'ba9b34ad730f140e4c7de6c7491d0a90';
const TMDB_KEY = (import.meta as any).env?.VITE_TMDB_API_KEY || FALLBACK_KEY;
const API_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p';

// Local runtime caches to avoid multiple redundancy calls
const responseCache = new Map<string, any>();
export let GMAP: Record<number, string> = {};
export let MOVIE_GENRES: { id: number; name: string }[] = [];

// أقدم سنة مسموحة — أي فلم/مسلسل أقدم منها (سنة الإصدار أقل من 1998) يُستبعد من كل القوائم.
// 1997 وما قبلها = ممنوع. 1998 فما فوق = مسموح.
const MIN_YEAR = 1998;

// يفحص سنة الإصدار من item.year (نص "YYYY") — يسمح فقط لو السنة معروفة و≥ MIN_YEAR.
// عناصر بدون سنة (year فارغة) تُستبعد أيضاً تحسباً (أفضل نرفض غامض من نعرض ممنوع).
function isYearAllowed(item: MovieOrShow): boolean {
  const y = parseInt(item.year, 10);
  return !isNaN(y) && y >= MIN_YEAR;
}

// Base request tool
async function tmdbFetch(path: string, params: Record<string, any> = {}): Promise<any> {
  const url = new URL(API_BASE + path);
  url.searchParams.set('api_key', TMDB_KEY);
  
  // Set default language for details (en-US for theatrical posters and original details)
  url.searchParams.set('language', 'en-US');

  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '') {
      url.searchParams.set(key, String(val));
    }
  }

  const cacheKey = url.toString();
  if (responseCache.has(cacheKey)) {
    return responseCache.get(cacheKey);
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TMDB error parent: ${res.status}`);
  }

  const data = await res.json();
  responseCache.set(cacheKey, data);
  return data;
}

// Helpers for images
export const getPosterUrl = (path: string | null) => path ? `${IMG_BASE}/original${path}` : null;
export const getBackdropUrl = (path: string | null) => path ? `${IMG_BASE}/w1280${path}` : null;
export const getOriginalBackdropUrl = (path: string | null) => path ? `${IMG_BASE}/original${path}` : null;
export const getProfileUrl = (path: string | null) => path ? `${IMG_BASE}/w185${path}` : null;
export const getStillUrl = (path: string | null) => path ? `${IMG_BASE}/original${path}` : null;

// Normalize utility
export function normalizeItem(item: any, customType?: 'movie' | 'tv'): MovieOrShow {
  const isTV = customType === 'tv' || item.media_type === 'tv' || (!item.title && item.name);
  const ids: number[] = item.genre_ids || (item.genres ? item.genres.map((g: any) => g.id) : []);
  
  let itemTitle = 'غير معروف';
  // Option: Arabic content shows Arabic, foreign content keeps its ORIGINAL name.
  // original_title/original_name is Arabic for Arabic films and the native name
  // (e.g. English) for foreign films — exactly what we want for both cases.
  if (!isTV) {
    itemTitle = item.original_title || item.title || 'غير معروف';
  } else {
    itemTitle = item.original_name || item.name || 'غير معروف';
  }

  // Force English name for Obsession movie specifically
  if (item.id === 791373 || String(itemTitle).toLowerCase() === 'هوس' || String(item.title).toLowerCase() === 'هوس') {
    if (!isTV) {
      itemTitle = 'Obsession';
    }
  }

  return {
    id: item.id,
    type: isTV ? 'tv' : 'movie',
    title: itemTitle,
    overview: item.overview || '',
    poster: getPosterUrl(item.poster_path),
    backdrop: getBackdropUrl(item.backdrop_path),
    rating: item.vote_average || 0,
    year: (item.release_date || item.first_air_date || '').slice(0, 4),
    date: item.release_date || item.first_air_date || '',
    genres: ids.map(id => GMAP[id] || '').filter(Boolean),
  };
}

// Initialize dynamic genre databases in Arabic
export async function initializeGenres(): Promise<void> {
  try {
    const [movieRes, tvRes] = await Promise.all([
      tmdbFetch('/genre/movie/list', { language: 'ar' }),
      tmdbFetch('/genre/tv/list', { language: 'ar' }),
    ]);

    MOVIE_GENRES = movieRes.genres || [];
    
    MOVIE_GENRES.forEach((g: any) => {
      GMAP[g.id] = g.name;
    });
    
    if (tvRes.genres) {
      tvRes.genres.forEach((g: any) => {
        if (!GMAP[g.id]) {
          GMAP[g.id] = g.name;
        }
      });
    }
  } catch (error) {
    console.warn('Failed to load TMDB Arabic genres library:', error);
    // Silent fail safely, falling back to simple tags or english labels
  }
}

// Get Home lists
export async function fetchTrendingWeek(): Promise<MovieOrShow[]> {
  const res = await tmdbFetch('/trending/all/week', { language: 'en-US' });
  return (res.results || []).map((m: any) => normalizeItem(m)).filter((item: MovieOrShow) => item.poster && isYearAllowed(item));
}

export async function fetchNowPlaying(): Promise<MovieOrShow[]> {
  const res = await tmdbFetch('/movie/now_playing', { region: 'US', language: 'en-US' });
  return (res.results || []).map((m: any) => normalizeItem(m, 'movie')).filter((item: MovieOrShow) => item.poster && isYearAllowed(item));
}

export async function fetchPopularTV(): Promise<MovieOrShow[]> {
  const res = await tmdbFetch('/tv/popular', { language: 'en-US' });
  return (res.results || []).map((m: any) => normalizeItem(m, 'tv')).filter((item: MovieOrShow) => item.poster && isYearAllowed(item));
}

export async function fetchPopularMovies(): Promise<MovieOrShow[]> {
  const res = await tmdbFetch('/movie/popular', { language: 'en-US' });
  return (res.results || []).map((m: any) => normalizeItem(m, 'movie')).filter((item: MovieOrShow) => item.poster && isYearAllowed(item));
}

// Detailed queries
export async function fetchDetailedTitle(type: 'movie' | 'tv', id: number): Promise<DetailedInfo> {
  // Fetch Arabic first (for overview), then English as fallback for missing fields.
  const [ar, en] = await Promise.all([
    tmdbFetch(`/${type}/${id}`, {
      append_to_response: 'videos,credits,similar,images',
      include_image_language: 'en,null',
      language: 'ar',
    }),
    tmdbFetch(`/${type}/${id}`, {
      append_to_response: 'videos,credits,similar,images',
      include_image_language: 'en,null',
      language: 'en-US',
    }),
  ]);
  // Use Arabic overview if present, else English. Keep English as the base
  // (complete data) and only take the Arabic overview when it exists.
  const overview = (ar.overview && ar.overview.trim()) ? ar.overview : (en.overview || '');
  return { ...en, overview };
}

// Picks the best title logo (prefers English, falls back to any) from TMDB images
export const getTitleLogoUrl = (data: any): string | null => {
  const logos = data?.images?.logos;
  if (!logos || logos.length === 0) return null;
  const en = logos.find((l: any) => l.iso_639_1 === 'en');
  const chosen = en || logos[0];
  return chosen?.file_path ? `${IMG_BASE}/original${chosen.file_path}` : null;
};

export interface EpisodeInfo {
  episode_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  runtime: number | null;
  air_date: string | null;
  vote_average: number;
}

export async function fetchSeasonEpisodes(tvId: number, seasonNumber: number): Promise<EpisodeInfo[]> {
  try {
    const [ar, en] = await Promise.all([
      tmdbFetch(`/tv/${tvId}/season/${seasonNumber}`, { language: 'ar' }),
      tmdbFetch(`/tv/${tvId}/season/${seasonNumber}`, { language: 'en-US' }),
    ]);
    const enEps: any[] = en.episodes || [];
    const arEps: any[] = ar.episodes || [];
    const enByNum = new Map<number, any>(enEps.map((e) => [e.episode_number, e]));
    // Base on Arabic list (falls back to English when Arabic season is empty)
    const baseList = arEps.length ? arEps : enEps;
    return baseList.map((e: any) => {
      const enE = enByNum.get(e.episode_number) || {};
      const overview = (e.overview && e.overview.trim()) ? e.overview : (enE.overview || '');
      return {
        episode_number: e.episode_number,
        name: e.name || enE.name || `الحلقة ${e.episode_number}`,
        overview,
        still_path: e.still_path || enE.still_path || null,
        runtime: e.runtime || enE.runtime || null,
        air_date: e.air_date || enE.air_date || null,
        vote_average: e.vote_average || enE.vote_average || 0,
      };
    });
  } catch (err) {
    console.error('fetchSeasonEpisodes error:', err);
    return [];
  }
}

// Discover/search parameters types
interface DiscoveryOptions {
  page?: number;
  genreIds?: string;
  year?: string;
  ratingGte?: string;
  originCountry?: string;
  originalLanguage?: string;
  runtimeLte?: string;
  runtimeGte?: string;
  sortBy?: string;
  withCompanies?: number;   // TMDB company id — يُستخدم مع type='movie'
  withNetworks?: number;    // TMDB network id — يُستخدم مع type='tv'
}

export async function searchTitles(type: 'movie' | 'tv', query: string, page = 1): Promise<{ results: MovieOrShow[]; totalPages: number }> {
  const res = await tmdbFetch(`/search/${type}`, {
    query,
    page,
    include_adult: false,
    language: 'en-US',
  });
  
  return {
    results: (res.results || []).map((m: any) => normalizeItem(m, type)).filter((item: MovieOrShow) => item.poster && isYearAllowed(item)),
    totalPages: Math.min(res.total_pages || 1, 500),
  };
}

export async function discoverTitles(type: 'movie' | 'tv', options: DiscoveryOptions): Promise<{ results: MovieOrShow[]; totalPages: number }> {
  const dateSort = type === 'tv' ? 'first_air_date.desc' : 'primary_release_date.desc';
  const alphaSort = type === 'tv' ? 'name.asc' : 'original_title.asc';
  
  // Decide active sorting
  let activeSort = 'popularity.desc';
  if (options.sortBy === 'rating') activeSort = 'vote_average.desc';
  else if (options.sortBy === 'year') activeSort = dateSort;
  else if (options.sortBy === 'az') activeSort = alphaSort;

  const params: Record<string, any> = {
    include_adult: false,
    page: options.page || 1,
    'vote_count.gte': options.sortBy === 'rating' ? 300 : 50,
    sort_by: activeSort,
    language: 'en-US',
    // فلترة سنة من السيرفر مباشرة — TMDB ما يرجع نتائج أقدم من MIN_YEAR إطلاقاً
    [type === 'tv' ? 'first_air_date.gte' : 'primary_release_date.gte']: `${MIN_YEAR}-01-01`,
  };

  if (options.genreIds) params.with_genres = options.genreIds;
  if (options.withCompanies) params.with_companies = options.withCompanies;
  if (options.withNetworks) params.with_networks = options.withNetworks;
  // لو المستخدم حدد سنة يدوياً أقل من MIN_YEAR، نتجاهلها (نخليها كأنها ما انحددت)
  // عشان فلتر primary_release_date.gte فوق يضل هو الفيصل ولا يصير تعارض بالنتائج.
  if (options.year && parseInt(options.year, 10) >= MIN_YEAR) {
    params[type === 'tv' ? 'first_air_date_year' : 'primary_release_year'] = options.year;
  }
  if (options.ratingGte) params['vote_average.gte'] = options.ratingGte;
  if (options.originCountry) params.with_origin_country = options.originCountry;
  if (options.originalLanguage) params.with_original_language = options.originalLanguage;
  if (options.runtimeLte) params['with_runtime.lte'] = options.runtimeLte;
  if (options.runtimeGte) params['with_runtime.gte'] = options.runtimeGte;

  const res = await tmdbFetch(`/discover/${type}`, params);

  return {
    results: (res.results || []).map((m: any) => normalizeItem(m, type)).filter((item: MovieOrShow) => item.poster && isYearAllowed(item)),
    totalPages: Math.min(res.total_pages || 1, 500),
  };
}

// يجيب شعار شركة إنتاج (company) أو شبكة بث (network) — TMDB يرجّع logo_path
// مباشرة بـ endpoint التفاصيل، بدون حاجة لـ /images المنفصل.
export async function fetchStudioLogo(opts: { companyId?: number; networkId?: number }): Promise<string | null> {
  try {
    const path = opts.companyId ? `/company/${opts.companyId}` : opts.networkId ? `/network/${opts.networkId}` : null;
    if (!path) return null;
    const res = await tmdbFetch(path, {});
    return res?.logo_path ? `${IMG_BASE}/w500${res.logo_path}` : null;
  } catch {
    return null;
  }
}

// يحسب درجة تطابق بين نص البحث وعنوان النتيجة — كل ما زاد الرقم، زاد التطابق
function relevanceScore(query: string, title: string): number {
  const q = query.trim().toLowerCase();
  const t = (title || '').trim().toLowerCase();
  if (!q || !t) return 0;

  if (t === q) return 100;                 // تطابق تام
  if (t.startsWith(q)) return 80;           // العنوان يبدأ بنص البحث بالضبط
  // كل كلمة بالعنوان تبدأ بكلمة من كلمات البحث (يلتقط "Frankenstein" من "franken")
  const titleWords = t.split(/\s+/);
  if (titleWords.some(w => w.startsWith(q))) return 60;
  if (t.includes(q)) return 40;             // تطابق جزئي بأي موقع
  return 0;                                  // ما في تطابق بالعنوان — رجّح حسب الشهرة فقط
}

// Multi search query for quick predictions overlay
export async function searchMulti(query: string): Promise<MovieOrShow[]> {
  const res = await tmdbFetch('/search/multi', {
    query,
    include_adult: false,
    language: 'en-US',
  });

  const items = (res.results || [])
    .filter((x: any) => x.media_type === 'movie' || x.media_type === 'tv')
    .map((m: any) => ({ raw: m, item: normalizeItem(m) }))
    .filter(({ item }: any) => item.poster && isYearAllowed(item));

  // رجّح: تطابق العنوان أولاً (الأهم) — نقارن بعنوان العرض وبعنوان TMDB الإنجليزي
  // (original_title ممكن يكون بلغة غير اللي يبحث بيها المستخدم)، وبعدين الشعبية كفاصل
  items.sort((a: any, b: any) => {
    const altA = a.raw.title || a.raw.name || '';
    const altB = b.raw.title || b.raw.name || '';
    const scoreA = Math.max(relevanceScore(query, a.item.title), relevanceScore(query, altA));
    const scoreB = Math.max(relevanceScore(query, b.item.title), relevanceScore(query, altB));
    if (scoreA !== scoreB) return scoreB - scoreA;
    return (b.raw.popularity || 0) - (a.raw.popularity || 0);
  });

  return items.map(({ item }: any) => item);
}
