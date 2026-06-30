/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowRight, Star, ChevronDown } from 'lucide-react';
import { MovieOrShow } from '../types';
import { Studio } from '../lib/studios';
import { discoverTitles } from '../lib/tmdb';

interface StudioPageProps {
  studio: Studio;
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

// بطاقة بوستر مطابقة لقياس بطاقات الصفحة الرئيسية
function GridCard({ item, onClick }: { item: MovieOrShow; onClick: () => void }) {
  const hasScore = item.rating > 0;
  return (
    <div
      onClick={onClick}
      className="group/card card-transition cursor-pointer rounded-2xl p-2 pb-3.5 select-none"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-stone-900 border border-white/8 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]">
        {item.poster ? (
          <img src={item.poster} alt={item.title} referrerPolicy="no-referrer" className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-600 text-xs">بدون صورة</div>
        )}
        {hasScore && (
          <div className="absolute top-2 right-2 glass flex items-center gap-1 px-2 py-0.5 rounded-full">
            <Star className="w-3 h-3 fill-[#f5c518] text-[#f5c518]" />
            <span className="text-[10px] font-bold text-white">{item.rating.toFixed(1)}</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 pointer-events-none" />
      </div>
      <div className="px-1 pt-2 text-right">
        <h3 className="text-white text-xs sm:text-sm font-semibold line-clamp-1">{item.title}</h3>
        <p className="text-stone-500 text-[10px] sm:text-xs mt-0.5">{item.type === 'movie' ? 'فيلم' : 'مسلسل'} · {item.year || '—'}</p>
      </div>
    </div>
  );
}

export default function StudioPage({ studio, onItemClick, onBack }: StudioPageProps) {
  const [allItems, setAllItems] = useState<MovieOrShow[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>('popularity');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);

  // شركة إنتاج تجيب أفلام فقط، شبكة بث تجيب مسلسلات فقط — حسب المتوفر بسجل الشركة
  const fetchTypes: ('movie' | 'tv')[] = [
    ...(studio.companyId ? ['movie' as const] : []),
    ...(studio.networkId ? ['tv' as const] : []),
  ];

  const loadAll = useCallback(async (pg: number, sort: SortKey, replace: boolean) => {
    setLoading(true);
    try {
      const calls = fetchTypes.map((type) =>
        discoverTitles(type, {
          sortBy: sort,
          page: pg,
          withCompanies: type === 'movie' ? studio.companyId : undefined,
          withNetworks: type === 'tv' ? studio.networkId : undefined,
        })
      );
      const results = await Promise.all(calls);
      const merged = results.flatMap((r) => r.results);
      setTotalPages(Math.max(1, ...results.map((r) => r.totalPages)));
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
  }, [studio.key]);

  useEffect(() => {
    setPage(1);
    loadAll(1, sortBy, true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [studio.key, sortBy, loadAll]);

  // Infinite scroll
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loading && page < totalPages) {
        const next = page + 1;
        setPage(next);
        loadAll(next, sortBy, false);
      }
    }, { rootMargin: '600px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [page, totalPages, loading, sortBy, loadAll]);

  return (
    <div className="min-h-screen animate-fade-in w-full">
      {/* Full-width colored header (لون هوية الشركة) */}
      <div className="relative w-full" style={{ backgroundColor: studio.color }}>
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
        <div dir="rtl" className="relative w-full px-6 md:px-12 pt-8 pb-10 sm:pt-10 sm:pb-14">
          <button onClick={onBack} className="flex items-center gap-2 text-white/90 hover:text-white text-sm font-semibold mb-5 cursor-pointer transition-colors">
            <ArrowRight className="w-4 h-4" />
            <span>الرئيسية</span>
          </button>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white drop-shadow-lg text-right">
            {studio.title}
          </h1>
        </div>
      </div>

      <div className="w-full py-8 sm:py-10 px-6 md:px-12">
        {/* Sort control */}
        <div dir="rtl" className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white">كل أعمال {studio.title}</h2>
          <div className="relative">
            <button
              onClick={() => setSortOpen((o) => !o)}
              className="flex items-center gap-2 glass hover:bg-white/15 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-full transition-all cursor-pointer"
            >
              <span>{SORT_LABELS[sortBy]}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
            </button>
            {sortOpen && (
              <div className="absolute right-0 mt-2 w-44 glass-strong rounded-2xl overflow-hidden z-30 shadow-2xl py-1">
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

        {/* Grid */}
        <div dir="rtl" className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1 sm:gap-2">
          {allItems.map((item) => (
            <div key={`${item.type}-${item.id}`}>
              <GridCard item={item} onClick={() => onItemClick(item)} />
            </div>
          ))}
        </div>

        {allItems.length === 0 && !loading && (
          <div className="py-16 text-center text-stone-500 text-sm">لا توجد نتائج لهذه الشركة حالياً.</div>
        )}

        <div ref={loaderRef} className="h-16 flex items-center justify-center mt-4">
          {loading && <div className="w-6 h-6 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />}
        </div>
      </div>
    </div>
  );
}
