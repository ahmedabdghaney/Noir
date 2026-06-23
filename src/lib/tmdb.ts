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
export const getPosterUrl = (path: string | null) => path ? `${IMG_BASE}/w500${path}` : null;
export const getBackdropUrl = (path: string | null) => path ? `${IMG_BASE}/w1280${path}` : null;
export const getProfileUrl = (path: string | null) => path ? `${IMG_BASE}/w185${path}` : null;
export const getStillUrl = (path: string | null) => path ? `${IMG_BASE}/w454_and_h254_bestv2${path}` : null;

// Normalize utility
export function normalizeItem(item: any, customType?: 'movie' | 'tv'): MovieOrShow {
  const isTV = customType === 'tv' || item.media_type === 'tv' || (!item.title && item.name);
  const ids: number[] = item.genre_ids || (item.genres ? item.genres.map((g: any) => g.id) : []);
  
  let itemTitle = 'غير معروف';
  if (!isTV) {
    // Movies always in English/Original title
    itemTitle = item.original_title || item.title || 'غير معروف';
  } else {
    // TV Series: Arabic shows remain Arabic, foreign shows can keep their original script or translation
    const isArabicSeries = item.original_language === 'ar' || (item.origin_country && item.origin_country.includes('AR'));
    if (isArabicSeries) {
      itemTitle = item.name || item.original_name || 'غير معروف';
    } else {
      itemTitle = item.original_name || item.name || 'غير معروف';
    }
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
    overview: item.overview || 'لا يوجد وصف متاح حالياً لهذا العنوان.',
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
  return (res.results || []).map((m: any) => normalizeItem(m)).filter((item: MovieOrShow) => item.poster);
}

export async function fetchNowPlaying(): Promise<MovieOrShow[]> {
  const res = await tmdbFetch('/movie/now_playing', { region: 'US', language: 'en-US' });
  return (res.results || []).map((m: any) => normalizeItem(m, 'movie')).filter((item: MovieOrShow) => item.poster);
}

export async function fetchPopularTV(): Promise<MovieOrShow[]> {
  const res = await tmdbFetch('/tv/popular', { language: 'en-US' });
  return (res.results || []).map((m: any) => normalizeItem(m, 'tv')).filter((item: MovieOrShow) => item.poster);
}

export async function fetchPopularMovies(): Promise<MovieOrShow[]> {
  const res = await tmdbFetch('/movie/popular', { language: 'en-US' });
  return (res.results || []).map((m: any) => normalizeItem(m, 'movie')).filter((item: MovieOrShow) => item.poster);
}

// Detailed queries
export async function fetchDetailedTitle(type: 'movie' | 'tv', id: number): Promise<DetailedInfo> {
  return await tmdbFetch(`/${type}/${id}`, {
    append_to_response: 'videos,credits,similar',
    language: 'en-US',
  });
}

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
    const res = await tmdbFetch(`/tv/${tvId}/season/${seasonNumber}`, {
      language: 'en-US',
    });
    return (res.episodes || []).map((e: any) => ({
      episode_number: e.episode_number,
      name: e.name || `الحلقة ${e.episode_number}`,
      overview: e.overview || '',
      still_path: e.still_path || null,
      runtime: e.runtime || null,
      air_date: e.air_date || null,
      vote_average: e.vote_average || 0,
    }));
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
}

export async function searchTitles(type: 'movie' | 'tv', query: string, page = 1): Promise<{ results: MovieOrShow[]; totalPages: number }> {
  const res = await tmdbFetch(`/search/${type}`, {
    query,
    page,
    include_adult: false,
    language: 'en-US',
  });
  
  return {
    results: (res.results || []).map((m: any) => normalizeItem(m, type)).filter((item: MovieOrShow) => item.poster),
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
  };

  if (options.genreIds) params.with_genres = options.genreIds;
  if (options.year) params[type === 'tv' ? 'first_air_date_year' : 'primary_release_year'] = options.year;
  if (options.ratingGte) params['vote_average.gte'] = options.ratingGte;
  if (options.originCountry) params.with_origin_country = options.originCountry;
  if (options.originalLanguage) params.with_original_language = options.originalLanguage;
  if (options.runtimeLte) params['with_runtime.lte'] = options.runtimeLte;
  if (options.runtimeGte) params['with_runtime.gte'] = options.runtimeGte;

  const res = await tmdbFetch(`/discover/${type}`, params);

  return {
    results: (res.results || []).map((m: any) => normalizeItem(m, type)).filter((item: MovieOrShow) => item.poster),
    totalPages: Math.min(res.total_pages || 1, 500),
  };
}

// Multi search query for quick predictions overlay
export async function searchMulti(query: string): Promise<MovieOrShow[]> {
  const res = await tmdbFetch('/search/multi', {
    query,
    include_adult: false,
    language: 'en-US',
  });

  return (res.results || [])
    .filter((x: any) => x.media_type === 'movie' || x.media_type === 'tv')
    .map((m: any) => normalizeItem(m))
    .filter((item: MovieOrShow) => item.poster);
}
