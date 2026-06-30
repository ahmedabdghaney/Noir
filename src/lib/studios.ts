/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// شركات/منصات الإنتاج — نفرّق بين نوعين بتصنيف TMDB:
// - company: شركة إنتاج أفلام (with_companies على /discover/movie)
// - network: شبكة/منصة بث مسلسلات (with_networks على /discover/tv)
// بعض الأسماء (نتفلكس، HBO) إلها id ثنائي مختلف بين الاثنين، فنخزن الاثنين إذا توفر.

export interface Studio {
  key: string;
  title: string;            // الاسم المعروض
  companyId?: number;       // TMDB company id (يُستخدم بـ with_companies لاكتشاف الأفلام)
  networkId?: number;       // TMDB network id (يُستخدم بـ with_networks لاكتشاف المسلسلات)
  color: string;            // لون الخلفية (هوية الشركة)
}

export const STUDIOS: Studio[] = [
  { key: 'disney',    title: 'ديزني',         companyId: 2,     color: '#0b3d91' },
  { key: 'pixar',     title: 'بيكسار',        companyId: 3,     color: '#1452a3' },
  { key: 'marvel',    title: 'مارفل',         companyId: 420,   color: '#7a0c0c' },
  { key: 'lucasfilm', title: 'لوكاس فيلم',    companyId: 1,     color: '#1c1c1c' },
  { key: 'warner',    title: 'وارنر براذرز',  companyId: 174,   color: '#003a70' },
  { key: 'universal',  title: 'يونيفرسال',    companyId: 33,    color: '#0e1a33' },
  { key: 'paramount', title: 'باراماونت',     companyId: 4,     color: '#003a8c' },
  { key: 'sony',      title: 'سوني',          companyId: 34,    color: '#1c1c1c' },
  { key: 'a24',       title: 'A24',           companyId: 41077, color: '#202020' },
  { key: 'netflix',   title: 'نتفلكس',        companyId: 178464, networkId: 213,  color: '#8c0a0a' },
  { key: 'hbo',       title: 'HBO',           companyId: 3268,  networkId: 49,   color: '#1a1a2e' },
  { key: 'apple',     title: 'آبل TV+',       companyId: 420521, networkId: 2552, color: '#1d1d1f' },
  { key: 'amazon',    title: 'أمازون برايم',  companyId: 1024,  networkId: 1024, color: '#0d2538' },
  { key: 'fx',        title: 'FX',            networkId: 88,    color: '#3a0a0a' },
  { key: 'bbc',       title: 'BBC',           networkId: 4,     color: '#2b0d0d' },
];

export const getStudioByKey = (key: string): Studio | undefined =>
  STUDIOS.find((s) => s.key === key);
