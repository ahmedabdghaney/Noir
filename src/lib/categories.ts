/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Site categories shown as colored cards under "الرائج هذا الأسبوع".
// Each maps to a primary TMDB genre + sub-genre combinations for the
// category page (e.g. Crime -> Crime+Drama, Crime+Comedy, Crime+Docs...).

export interface SubSection {
  title: string;
  genreIds: string;       // comma-separated TMDB genre ids (AND filter)
  type?: 'movie' | 'tv' | 'both';
}

export interface Category {
  key: string;
  title: string;          // Arabic display name
  gradient: string;       // tailwind gradient classes for the colored card
  primaryGenre: number;   // main TMDB genre id
  subsections: SubSection[];
}

// TMDB genre ids reference:
// Action 28, Adventure 12, Animation 16, Comedy 35, Crime 80, Documentary 99,
// Drama 18, Family 10751, Fantasy 14, History 36, Horror 27, Music 10402,
// Mystery 9648, Romance 10749, SciFi 878, Thriller 53, War 10752, Western 37

export const CATEGORIES: Category[] = [
  {
    key: 'crime',
    title: 'جريمة',
    gradient: 'from-green-700 via-emerald-800 to-green-950',
    primaryGenre: 80,
    subsections: [
      { title: 'جريمة ودراما', genreIds: '80,18' },
      { title: 'جريمة وكوميديا', genreIds: '80,35' },
      { title: 'جريمة وإثارة', genreIds: '80,53' },
      { title: 'جرائم وثائقية', genreIds: '80,99' },
      { title: 'جريمة وغموض', genreIds: '80,9648' },
    ],
  },
  {
    key: 'scifi',
    title: 'خيال علمي',
    gradient: 'from-cyan-600 via-blue-800 to-indigo-950',
    primaryGenre: 878,
    subsections: [
      { title: 'خيال علمي ومغامرة', genreIds: '878,12' },
      { title: 'خيال علمي وأكشن', genreIds: '878,28' },
      { title: 'خيال علمي ودراما', genreIds: '878,18' },
      { title: 'خيال علمي ورعب', genreIds: '878,27' },
      { title: 'خيال علمي وفانتازيا', genreIds: '878,14' },
    ],
  },
  {
    key: 'action',
    title: 'أكشن ومغامرة',
    gradient: 'from-orange-600 via-red-700 to-rose-950',
    primaryGenre: 28,
    subsections: [
      { title: 'أكشن ومغامرة', genreIds: '28,12' },
      { title: 'أكشن وإثارة', genreIds: '28,53' },
      { title: 'أكشن وجريمة', genreIds: '28,80' },
      { title: 'أكشن وخيال علمي', genreIds: '28,878' },
      { title: 'أكشن وحرب', genreIds: '28,10752' },
    ],
  },
  {
    key: 'family',
    title: 'عائلي وأطفال',
    gradient: 'from-pink-500 via-rose-600 to-fuchsia-900',
    primaryGenre: 10751,
    subsections: [
      { title: 'رسوم متحركة', genreIds: '16' },
      { title: 'عائلي ومغامرة', genreIds: '10751,12' },
      { title: 'عائلي وكوميديا', genreIds: '10751,35' },
      { title: 'عائلي وفانتازيا', genreIds: '10751,14' },
    ],
  },
  {
    key: 'thriller',
    title: 'إثارة وتشويق',
    gradient: 'from-violet-700 via-purple-800 to-slate-950',
    primaryGenre: 53,
    subsections: [
      { title: 'إثارة وغموض', genreIds: '53,9648' },
      { title: 'إثارة ودراما', genreIds: '53,18' },
      { title: 'إثارة ورعب', genreIds: '53,27' },
      { title: 'إثارة وجريمة', genreIds: '53,80' },
    ],
  },
  {
    key: 'drama',
    title: 'دراما',
    gradient: 'from-amber-600 via-orange-800 to-stone-950',
    primaryGenre: 18,
    subsections: [
      { title: 'دراما ورومانسي', genreIds: '18,10749' },
      { title: 'دراما وتاريخي', genreIds: '18,36' },
      { title: 'دراما وجريمة', genreIds: '18,80' },
      { title: 'دراما وحرب', genreIds: '18,10752' },
    ],
  },
  {
    key: 'comedy',
    title: 'كوميديا',
    gradient: 'from-yellow-500 via-amber-600 to-orange-900',
    primaryGenre: 35,
    subsections: [
      { title: 'كوميديا ورومانسي', genreIds: '35,10749' },
      { title: 'كوميديا وعائلي', genreIds: '35,10751' },
      { title: 'كوميديا وجريمة', genreIds: '35,80' },
      { title: 'كوميديا ومغامرة', genreIds: '35,12' },
    ],
  },
  {
    key: 'horror',
    title: 'رعب',
    gradient: 'from-red-800 via-rose-950 to-black',
    primaryGenre: 27,
    subsections: [
      { title: 'رعب وغموض', genreIds: '27,9648' },
      { title: 'رعب وإثارة', genreIds: '27,53' },
      { title: 'رعب وخيال علمي', genreIds: '27,878' },
      { title: 'رعب وفانتازيا', genreIds: '27,14' },
    ],
  },
];

export const getCategoryByKey = (key: string): Category | undefined =>
  CATEGORIES.find((c) => c.key === key);
