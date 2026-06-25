/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowRight, Star, ChevronDown } from 'lucide-react';
import { MovieOrShow } from '../types';
import { Category, SubSection } from '../lib/categories';
import { discoverTitles } from '../lib/tmdb';
import MovieRow from './MovieRow';

interface CategoryPageProps {
  category: Category;
  onItemClick: (item: MovieOrShow) => void;
  onBack: () => void;
}

type SortKey = 'popularity' | 'rating' | 'year' | 'az';

const SORT_LABELS: Record<SortKey, string> = {
  popularity: 'الأكثر رواجاً',
  rating: 'الأعلى تقييماً',
  year: 'الأحدث',
  az: 'أبجدياً',
};

// One subsection row: fetches its own titles (movies, fallback covered by genre combo)
function SubsectionRow(props: { sub: SubSection; onItemClick: (i: MovieOrShow) => void }) {
  const { sub, onItemClick } = props;
  const [items, setItems] = useState<MovieOrShow[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      discoverTitles('movie', { genreIds: sub.genreIds, sortBy: 'popularity', page: 1 }),
      discoverTitles('tv', { genreIds: sub.genreIds, sortBy: 'popularity', page: 1 }),
    ])
      .then(([mv, tv]) => {
        if (cancelled) return;
        // interleave movies + tv, dedupe by id
        const merged = [...mv.results, ...tv.results];
        const seen = new Set<string>();
        const unique = merged.filter((x) => {
          const k = `${x.type}-${x.id}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        setItems(unique);
      })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, [sub.genreIds]);

  if (items.length === 0) return null;
  return <MovieRow title={sub.title} items={items} onItemClick={onItemClick} />;
}

export default function CategoryPage({ category, onItemClick, onBack }: CategoryPageProps) {
  const [allItems, setAllItems] = useState<MovieOrShow[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>('popularity');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);

  // Fetch "All" grid (primary genre), reset on sort change
  const loadAll = useCallback(async (pg: number, sort: SortKey, replace: boolean) => {
    setLoading(true);
    try {
      const genreStr = String(category.primaryGenre);
      const [mv, tv] = await Promise.all([
        discoverTitles('movie', { genreIds: genreStr, sortBy: sort, page: pg }),
        discoverTitles('tv', { genreIds: genreStr, sortBy: sort, page: pg }),
      ]);
      const merged = [...mv.results, ...tv.results];
      setTotalPages(Math.max(mv.totalPages, tv.totalPages));
      setAllItems((prev) => {
        const base = replace ? [] : prev;
        const seen = new Set(base.map((x) => `${x.type}-${x.id}`));
        const next = [...base];
        for (const it of merged) {
          const k = `${it.type}-${it.id}`;
          if (!seen.has(k)) { seen.add(k); next.push(it); }
        }
        return next;
      });
    } catch {
      if (replace) setAllItems([]);
    } finally {
      setLoading(false);
    }
  }, [category.primaryGenre]);

  // On category or sort change -> reset to page 1
  useEffect(() => {
    setPage(1);
    loadAll(1, sortBy, true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [category.key, sortBy, loadAll]);

  // Infinite scroll for the All grid
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loading && page < totalPages) {
        const next = page + 1;
        setPage(next);
        loadAll(next, sortBy, false);
      }
    }, { rootMargin: '400px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [page, totalPages, loading, sortBy, loadAll]);

  return (
    <div className="min-h-screen animate-fade-in">
      {/* Header band with category color */}
      <div className={`relative bg-gradient-to-br ${category.gradient}`}>
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-10 sm:pt-10 sm:pb-14">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-white/90 hover:text-white text-sm font-semibold mb-5 cursor-pointer transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>الرئيسية</span>
          </button>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white drop-shadow-lg text-right">{category.title}</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Subsection rows */}
        <div className="space-y-2 mb-12">
          {category.subsections.map((sub) => (
            <div key={sub.genreIds}>
              <SubsectionRow sub={sub} onItemClick={onItemClick} />
            </div>
          ))}
        </div>

        {/* All section with sorting */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl sm:text-2xl font-bold text-white">الكل</h2>
          <div className="relative">
            <button
              onClick={() => setSortOpen((o) => !o)}
              className="flex items-center gap-2 glass hover:bg-white/15 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-full transition-all cursor-pointer"
            >
              <span>{SORT_LABELS[sortBy]}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
            </button>
            {sortOpen && (
              <div className="absolute left-0 mt-2 w-44 glass-strong rounded-2xl overflow-hidden z-30 shadow-2xl py-1">
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => { setSortBy(k); setSortOpen(false); }}
                    className={`w-full text-right px-4 py-2.5 text-xs sm:text-sm transition-colors cursor-pointer ${sortBy === k ? 'text-white bg-white/10 font-bold' : 'text-stone-300 hover:bg-white/5'}`}
                  >
                    {SORT_LABELS[k]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* All grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4">
          {allItems.map((item) => (
            <button
              key={`${item.type}-${item.id}`}
              onClick={() => onItemClick(item)}
              className="group/card relative rounded-xl overflow-hidden bg-stone-900 hover:scale-[1.04] transition-all cursor-pointer text-right"
            >
              <div className="aspect-[2/3] w-full overflow-hidden">
                {item.poster ? (
                  <img src={item.poster} alt={item.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-600 text-xs">بدون صورة</div>
                )}
              </div>
              {item.rating > 0 && (
                <div className="absolute top-2 right-2 glass flex items-center gap-1 px-2 py-0.5 rounded-full">
                  <span className="text-[10px] font-bold text-[#f5c518]">{item.rating.toFixed(1)}</span>
                  <Star className="w-2.5 h-2.5 fill-[#f5c518] text-[#f5c518]" />
                </div>
              )}
              <div className="p-2">
                <h3 className="text-white text-[11px] sm:text-xs font-semibold line-clamp-1">{item.title}</h3>
                <p className="text-stone-500 text-[9px] sm:text-[10px] mt-0.5">{item.type === 'movie' ? 'فيلم' : 'مسلسل'} · {item.year || '—'}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Loader sentinel */}
        <div ref={loaderRef} className="h-16 flex items-center justify-center mt-4">
          {loading && <div className="w-6 h-6 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />}
        </div>
      </div>
    </div>
  );
}
