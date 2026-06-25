/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// All TMDB genres as site categories. Each shows as a poster card whose
// background is the most popular title of that genre, with a colored overlay.
// The category page builds sub-sections by combining the primary genre with
// other genres, plus an "All" section with sorting.

export interface Category {
  key: string;
  title: string;          // Arabic display name
  primaryGenre: number;   // main TMDB genre id
  overlay: string;        // rgba overlay color (genre identity)
}

// TMDB genre ids:
// Action 28, Adventure 12, Animation 16, Comedy 35, Crime 80, Documentary 99,
// Drama 18, Family 10751, Fantasy 14, History 36, Horror 27, Music 10402,
// Mystery 9648, Romance 10749, SciFi 878, Thriller 53, War 10752, Western 37

export const CATEGORIES: Category[] = [
  { key: 'action',      title: 'أكشن',          primaryGenre: 28,    overlay: 'rgba(220,38,38,0.55)' },
  { key: 'adventure',   title: 'مغامرة',         primaryGenre: 12,    overlay: 'rgba(217,119,6,0.55)' },
  { key: 'animation',   title: 'رسوم متحركة',    primaryGenre: 16,    overlay: 'rgba(236,72,153,0.55)' },
  { key: 'comedy',      title: 'كوميديا',        primaryGenre: 35,    overlay: 'rgba(202,138,4,0.55)' },
  { key: 'crime',       title: 'جريمة',          primaryGenre: 80,    overlay: 'rgba(5,150,105,0.6)' },
  { key: 'documentary', title: 'وثائقي',         primaryGenre: 99,    overlay: 'rgba(13,148,136,0.55)' },
  { key: 'drama',       title: 'دراما',          primaryGenre: 18,    overlay: 'rgba(234,88,12,0.55)' },
  { key: 'family',      title: 'عائلي',          primaryGenre: 10751, overlay: 'rgba(219,39,119,0.55)' },
  { key: 'fantasy',     title: 'فانتازيا',       primaryGenre: 14,    overlay: 'rgba(124,58,237,0.55)' },
  { key: 'history',     title: 'تاريخي',         primaryGenre: 36,    overlay: 'rgba(120,53,15,0.6)' },
  { key: 'horror',      title: 'رعب',            primaryGenre: 27,    overlay: 'rgba(127,29,29,0.65)' },
  { key: 'music',       title: 'موسيقى',         primaryGenre: 10402, overlay: 'rgba(190,24,93,0.55)' },
  { key: 'mystery',     title: 'غموض',           primaryGenre: 9648,  overlay: 'rgba(67,56,202,0.55)' },
  { key: 'romance',     title: 'رومانسي',        primaryGenre: 10749, overlay: 'rgba(225,29,72,0.55)' },
  { key: 'scifi',       title: 'خيال علمي',      primaryGenre: 878,   overlay: 'rgba(37,99,235,0.55)' },
  { key: 'thriller',    title: 'إثارة وتشويق',   primaryGenre: 53,    overlay: 'rgba(109,40,217,0.55)' },
  { key: 'war',         title: 'حربي',           primaryGenre: 10752, overlay: 'rgba(87,83,78,0.6)' },
  { key: 'western',     title: 'غربي',           primaryGenre: 37,    overlay: 'rgba(146,64,14,0.6)' },
];

// Build sub-sections dynamically: primary genre combined with a set of partners.
const PARTNER_GENRES: { id: number; name: string }[] = [
  { id: 18, name: 'دراما' },
  { id: 35, name: 'كوميديا' },
  { id: 53, name: 'إثارة' },
  { id: 28, name: 'أكشن' },
  { id: 12, name: 'مغامرة' },
  { id: 9648, name: 'غموض' },
  { id: 10749, name: 'رومانسي' },
  { id: 14, name: 'فانتازيا' },
  { id: 878, name: 'خيال علمي' },
  { id: 27, name: 'رعب' },
  { id: 80, name: 'جريمة' },
  { id: 99, name: 'وثائقي' },
];

export interface SubSection {
  title: string;
  genreIds: string;
}

export function buildSubsections(cat: Category): SubSection[] {
  const subs: SubSection[] = [];
  for (const p of PARTNER_GENRES) {
    if (p.id === cat.primaryGenre) continue;
    subs.push({
      title: `${cat.title} و${p.name}`,
      genreIds: `${cat.primaryGenre},${p.id}`,
    });
    if (subs.length >= 5) break;
  }
  return subs;
}

export const getCategoryByKey = (key: string): Category | undefined =>
  CATEGORIES.find((c) => c.key === key);
