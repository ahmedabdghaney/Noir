/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { MovieOrShow } from '../types';
import { Studio } from '../lib/studios';
import { discoverTitles } from '../lib/tmdb';
import WatchlistButton from './WatchlistButton';

interface StudioPageProps {
  studio: Studio;
  onItemClick: (item: MovieOrShow) => void;
  onBack: () => void;
  isSaved?: (item: MovieOrShow) => boolean;
  onToggleSave?: (item: MovieOrShow) => void;
}

type SortKey = 'popularity' | 'rating' | 'year' | 'az';

const SORT_LABELS: Record<SortKey, string> = {
  popularity: 'الأكثر رواجاً',
  rating: 'الأعلى تقييماً',
  year: 'الأحدث',
  az: 'أبجدياً',
};

// بطاقة أفقية مطابقة لصفوف الواجهة الرئيسية
function GridCard({
  item,
  onClick,
  saved,
  onToggleSave,
}: {
  item: MovieOrShow;
  onClick: () => void;
  saved: boolean;
  onToggleSave?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      data-tv-card
      aria-label={`فتح ${item.title}`}
      className="group/card card-transition card-cinematic cursor-pointer select-none"
    >
      <div data-tv-card-artwork className="relative aspect-video overflow-hidden rounded-[18px] bg-black border border-white/[0.06]">
        {onToggleSave && (
          <WatchlistButton
            saved={saved}
            onToggle={onToggleSave}
            className="absolute top-2 right-2 z-20"
          />
        )}
        {item.backdrop || item.poster ? (
          <img src={item.backdrop || item.poster || undefined} alt={item.title} loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-600 text-xs">بدون صورة</div>
        )}
      </div>
      <div className="px-1 pt-3 text-right">
        <h3 className="text-white text-sm font-bold line-clamp-1">{item.title}</h3>
        <p className="mt-1 text-white/40 text-[11px] font-medium">{item.type === 'movie' ? 'فيلم' : 'مسلسل'} · {item.year || '—'}</p>
      </div>
    </div>
  );
}

export default function StudioPage({
  studio,
  onItemClick,
  onBack,
  isSaved,
  onToggleSave,
}: StudioPageProps) {
  const isTvApp = document.documentElement.classList.contains('noir-tv-app');
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
        <div dir="rtl" className="relative w-full px-4 sm:px-6 lg:px-8 pt-8 pb-10 sm:pt-10 sm:pb-14">
          {!isTvApp && <button onClick={onBack} className="flex items-center gap-2 text-white/90 hover:text-white text-sm font-semibold mb-5 cursor-pointer transition-colors">
            <ArrowRight className="w-4 h-4" />
            <span>الرئيسية</span>
          </button>}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white drop-shadow-lg text-right">
            {studio.title}
          </h1>
        </div>
      </div>

      <div className="w-full py-8 sm:py-10 px-4 sm:px-6 lg:px-8">
        {/* Sort control */}
        <div dir="rtl" className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white">كل أعمال {studio.title}</h2>
          {!isTvApp && <div className="relative">
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
          </div>}
        </div>

        {/* Grid */}
        <div dir="rtl" className="grid grid-cols-1 gap-x-4 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {allItems.map((item) => (
            <div key={`${item.type}-${item.id}`}>
              <GridCard
                item={item}
                onClick={() => onItemClick(item)}
                saved={isSaved?.(item) ?? false}
                onToggleSave={onToggleSave ? () => onToggleSave(item) : undefined}
              />
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
