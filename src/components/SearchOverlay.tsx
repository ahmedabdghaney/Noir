/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Search, X, Star, ChevronLeft, Loader, Trash2, Clock } from 'lucide-react';
import { MovieOrShow } from '../types';
import { searchMulti, fetchTrendingWeek, discoverTitles } from '../lib/tmdb';
import { CATEGORIES } from '../lib/categories';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTitle: (type: 'movie' | 'tv', id: number) => void;
  onBrowseCategory?: (key: string) => void;
}

// A recently opened title from search, with the time it was opened.
type RecentTitle = MovieOrShow & { openedAt: number };

// Format a timestamp into a short relative Arabic label.
function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'الآن';
  if (min < 60) return `قبل ${min} دقيقة`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `قبل ${hr} ساعة`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'أمس';
  if (day < 7) return `قبل ${day} أيام`;
  const wk = Math.floor(day / 7);
  if (wk < 4) return `قبل ${wk} أسبوع`;
  return `قبل ${Math.floor(day / 30)} شهر`;
}

export default function SearchOverlay({ isOpen, onClose, onSelectTitle, onBrowseCategory }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MovieOrShow[]>([]);
  const [trending, setTrending] = useState<MovieOrShow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentTitles, setRecentTitles] = useState<RecentTitle[]>([]);
  const [catImages, setCatImages] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  // جلب صورة ممثّلة لكل تصنيف (أشهر فلم) — زي CategoryRow
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        CATEGORIES.map(async (cat) => {
          try {
            const res = await discoverTitles('movie', { genreIds: String(cat.primaryGenre), sortBy: 'popularity', page: 1 });
            const withPoster = res.results.find((r) => r.poster);
            return [cat.key, withPoster?.poster || ''] as [string, string];
          } catch {
            return [cat.key, ''] as [string, string];
          }
        })
      );
      if (!cancelled) {
        const map: Record<string, string> = {};
        entries.forEach(([k, v]) => { if (v) map[k] = v; });
        setCatImages(map);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  // Focus on entry & load history/trending
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);

      // Load recently opened titles from Local Storage
      try {
        const saved = localStorage.getItem('noir_recent_titles');
        if (saved) {
          setRecentTitles(JSON.parse(saved));
        }
      } catch (err) {
        console.error("Error loading recent titles: ", err);
      }

      // Load trending queries list if empty
      if (trending.length === 0) {
        fetchTrendingWeek().then(setTrending).catch(() => {});
      }
    }
  }, [isOpen]);

  // Query Debounce effect
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const delayDebounceRaw = setTimeout(async () => {
      try {
        const matching = await searchMulti(query);
        setResults(matching);
      } catch (err) {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceRaw);
  }, [query]);

  // Save an opened title into recent history (most recent first, max 8)
  const addToRecentTitles = (item: MovieOrShow) => {
    if (!item) return;
    try {
      const saved = localStorage.getItem('noir_recent_titles');
      let list: RecentTitle[] = saved ? JSON.parse(saved) : [];
      list = list.filter((t) => !(t.id === item.id && t.type === item.type));
      list = [{ ...item, openedAt: Date.now() }, ...list].slice(0, 8);
      setRecentTitles(list);
      localStorage.setItem('noir_recent_titles', JSON.stringify(list));
    } catch (err) {
      console.error(err);
    }
  };

  const clearRecentTitles = () => {
    setRecentTitles([]);
    localStorage.removeItem('noir_recent_titles');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-[#0a0a0a] z-[500] pt-20 md:pt-24 px-4 sm:px-6 md:px-10 selection:bg-red-500/30 overflow-y-auto"
    >
      {/* زر إغلاق أعلى */}
      <button
        onClick={onClose}
        className="fixed top-5 left-5 z-[510] w-9 h-9 rounded-full bg-white/8 hover:bg-white/15 text-white flex items-center justify-center cursor-pointer transition-all"
        aria-label="إغلاق"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="max-w-4xl mx-auto">

        {/* Input area — bar بحث كبير */}
        <div className="flex items-center gap-3 px-5 py-4 bg-stone-900/80 border border-white/8 rounded-2xl mb-8 sticky top-4 z-10 backdrop-blur-xl">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن أفلام، مسلسلات، ممثلين..."
            className="flex-1 bg-transparent border-0 outline-none text-white text-base md:text-lg font-medium placeholder-gray-500 text-right font-sans"
            autoComplete="off"
          />
          {isLoading ? (
            <Loader className="w-4 h-4 text-red-500 animate-spin shrink-0" />
          ) : (
            query && (
              <button
                onClick={() => setQuery('')}
                className="w-5 h-5 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )
          )}
        </div>

        {/* Body */}
        <div className="pb-20">
          {/* قسم التصفح بالتصنيفات — يظهر لما ماكو بحث */}
          {!query.trim() && (
            <div className="mb-10">
              <h2 className="font-display text-xl sm:text-2xl font-black text-white mb-5 text-right">تصفّح حسب التصنيف</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4" dir="rtl">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => onBrowseCategory?.(cat.key)}
                    className="group relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer border border-white/8 hover:border-white/20 transition-all hover:scale-[1.03]"
                  >
                    {catImages[cat.key] && (
                      <img
                        src={catImages[cat.key]}
                        alt={cat.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0" style={{ background: cat.overlay }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center p-3">
                      <span className="font-display text-lg sm:text-xl font-black text-white text-center drop-shadow-lg leading-tight">{cat.title}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

        {/* Suggestion Lists Body */}
        <div className="overflow-y-auto py-2">
          {query.trim() ? (
            results.length > 0 ? (
              <div className="space-y-0.5">
                <div className="text-[10px] font-bold text-gray-500 px-5 py-1.5 text-right select-none uppercase">
                   نتائج البحث ({results.length})
                </div>
                {results.slice(0, 8).map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    onClick={() => {
                      addToRecentTitles(item);
                      onSelectTitle(item.type, item.id);
                      onClose();
                    }}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-white/5 cursor-pointer transition-colors text-right"
                  >
                    <div className="w-10 h-14 bg-stone-800 rounded-lg overflow-hidden shrink-0 select-none">
                      {item.poster ? (
                        <img src={item.poster} alt={item.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-stone-600">
                          {item.title.slice(0, 2)}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0 pr-1">
                      <h5 className="text-white font-semibold text-sm truncate">{item.title}</h5>
                      <p className="text-gray-400 text-xs mt-1 font-medium flex items-center gap-1.5">
                        <span>{item.year || '—'}</span>
                        <span className="w-1 h-1 bg-stone-700 rounded-full" />
                        <span>{item.type === 'movie' ? 'فيلم' : 'مسلسل'}</span>
                        {item.genres.length > 0 && (
                          <>
                            <span className="w-1 h-1 bg-stone-700 rounded-full" />
                            <span className="truncate">{item.genres[0]}</span>
                          </>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      {item.rating > 0 && (
                        <div className="flex items-center gap-1 text-[#f5c518] text-xs font-bold">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          <span>{item.rating.toFixed(1)}</span>
                        </div>
                      )}
                      <ChevronLeft className="w-4 h-4 text-gray-500" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-gray-500 text-xs">
                لا توجد نتائج مطابقة لـ "{query}"، تأكد من صحة الكلمة.
              </div>
            )
          ) : (
            <div className="space-y-4">
              {/* Recently opened titles from search */}
              {recentTitles.length > 0 && (
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between px-5 py-1.5 select-none">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">آخر ما شاهدته من البحث</span>
                    <button
                      onClick={clearRecentTitles}
                      className="text-red-500 hover:text-red-400 flex items-center gap-1 transition-colors text-[10px] font-bold"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>مسح السجل</span>
                    </button>
                  </div>
                  {recentTitles.map((item) => (
                    <div
                      key={`recent-${item.type}-${item.id}`}
                      onClick={() => {
                        addToRecentTitles(item);
                        onSelectTitle(item.type, item.id);
                        onClose();
                      }}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-white/5 cursor-pointer transition-colors text-right"
                    >
                      <div className="w-10 h-14 bg-stone-800 rounded-lg overflow-hidden shrink-0 select-none">
                        {item.poster ? (
                          <img src={item.poster} alt={item.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-stone-600">
                            {item.title.slice(0, 2)}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 pr-1">
                        <h5 className="text-white font-semibold text-sm truncate">{item.title}</h5>
                        <p className="text-gray-400 text-xs mt-1 font-medium flex items-center gap-1.5">
                          <span>{item.year || '—'}</span>
                          <span className="w-1 h-1 bg-stone-700 rounded-full" />
                          <span>{item.type === 'movie' ? 'فيلم' : 'مسلسل'}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="flex items-center gap-1 text-[10px] text-stone-500 font-medium whitespace-nowrap">
                          <Clock className="w-3 h-3" />
                          <span>{timeAgo(item.openedAt)}</span>
                        </span>
                        <ChevronLeft className="w-4 h-4 text-gray-500" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Suggestions / Trending List */}
              {trending.length > 0 && (
                <div className={`space-y-0.5 ${recentTitles.length > 0 ? 'border-t border-white/5 pt-3' : ''}`}>
                  <div className="text-[10px] font-bold text-gray-500 px-5 py-1.5 text-right select-none uppercase">
                    أبحر في العناوين الرائجة اليوم
                  </div>
                  {trending.slice(0, 6).map((item) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      onClick={() => {
                        addToRecentTitles(item);
                        onSelectTitle(item.type, item.id);
                        onClose();
                      }}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-white/5 cursor-pointer transition-colors text-right"
                    >
                      <div className="w-10 h-14 bg-stone-800 rounded-lg overflow-hidden shrink-0 select-none">
                        {item.poster ? (
                          <img src={item.poster} alt={item.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-stone-600">
                            {item.title.slice(0, 2)}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0 pr-1">
                        <h5 className="text-white font-semibold text-sm truncate">{item.title}</h5>
                        <p className="text-gray-400 text-xs mt-1 font-medium flex items-center gap-1.5">
                          <span>{item.year || '—'}</span>
                          <span className="w-1 h-1 bg-stone-700 rounded-full" />
                          <span>{item.type === 'movie' ? 'فيلم' : 'مسلسل'}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        {item.rating > 0 && (
                          <div className="flex items-center gap-1 text-[#f5c518] text-xs font-bold">
                            <Star className="w-3.5 h-3.5 fill-current" />
                            <span>{item.rating.toFixed(1)}</span>
                          </div>
                        )}
                        <ChevronLeft className="w-4 h-4 text-gray-500" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
