/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MovieOrShow {
  id: number;
  type: 'movie' | 'tv';
  title: string;
  overview: string;
  poster: string | null;
  backdrop: string | null;
  rating: number;
  year: string;
  date: string;
  genres: string[];
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
}

export interface SeasonInfo {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
  poster_path: string | null;
}

export interface VideoResult {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
}

export interface DetailedInfo {
  id: number;
  type: 'movie' | 'tv';
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  tagline?: string;
  runtime?: number;
  episode_run_time?: number[];
  spoken_languages?: { english_name: string; name: string }[];
  production_countries?: { iso_3166_1: string; name: string }[];
  origin_country?: string[];
  created_by?: { name: string }[];
  credits?: {
    cast: CastMember[];
    crew: CrewMember[];
  };
  genres?: { id: number; name: string }[];
  seasons?: SeasonInfo[];
  videos?: {
    results: VideoResult[];
  };
  similar?: {
    results: any[];
  };
}
