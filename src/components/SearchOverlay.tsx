/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Search, X, Star, ChevronLeft, Loader } from 'lucide-react';
import { MovieOrShow } from '../types';
import { searchMulti, discoverTitles } from '../lib/tmdb';
import { CATEGORIES } from '../lib/categories';
import WatchlistButton from './WatchlistButton';

const LANGUAGE_SEARCH_TERMS: Record<string, string> = {
  عربي: 'ar',
  عربية: 'ar',
  العربية: 'ar',
  انكليزي: 'en',
  انجليزي: 'en',
  إنجليزي: 'en',
  كوري: 'ko',
  كورية: 'ko',
  ياباني: 'ja',
  يابانية: 'ja',
  هندي: 'hi',
  هندية: 'hi',
  فرنسي: 'fr',
  فرنسية: 'fr',
  اسباني: 'es',
  إسباني: 'es',
  تركي: 'tr',
  تركية: 'tr',
};

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTitle: (type: 'movie' | 'tv', id: number) => void;
  onBrowseCategory?: (key: string) => void;
  isSaved?: (item: MovieOrShow) => boolean;
  onToggleSave?: (item: MovieOrShow) => void;
}

export default function SearchOverlay({
  isOpen,
  onClose,
  onSelectTitle,
  onBrowseCategory,
  isSaved,
  onToggleSave,
}: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MovieOrShow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [catImages, setCatImages] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // جلب صورة ممثّلة لكل تصنيف (أشهر فلم) — بدون تكرار نفس الصورة بين التصنيفات
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        CATEGORIES.map(async (cat) => {
          try {
            const res = await discoverTitles('movie', { genreIds: String(cat.primaryGenre), sortBy: 'popularity', page: 1 });
            const posters = res.results.filter((r) => r.poster).map((r) => r.poster as string);
            return [cat.key, posters] as [string, string[]];
          } catch {
            return [cat.key, []] as [string, string[]];
          }
        })
      );
      if (!cancelled) {
        // كل تصنيف ياخذ أول صورة غير مستعملة من قائمته — يمنع التكرار
        const used = new Set<string>();
        const map: Record<string, string> = {};
        entries.forEach(([k, posters]) => {
          const pick = posters.find((p) => !used.has(p)) || posters[0] || '';
          if (pick) { map[k] = pick; used.add(pick); }
        });
        setCatImages(map);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  // Focus on entry and remove data left by the deleted search-history feature.
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
      localStorage.removeItem('noir_recent_titles');
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
        const normalizedQuery = query.trim();
        const language = LANGUAGE_SEARCH_TERMS[normalizedQuery];
        const [matching, languageMovies, languageShows] = await Promise.all([
          searchMulti(normalizedQuery),
          language
            ? discoverTitles('movie', { originalLanguage: language, sortBy: 'popularity', page: 1 })
            : Promise.resolve({ results: [], totalPages: 1 }),
          language
            ? discoverTitles('tv', { originalLanguage: language, sortBy: 'popularity', page: 1 })
            : Promise.resolve({ results: [], totalPages: 1 }),
        ]);
        const unique = new Map<string, MovieOrShow>();
        [...languageMovies.results, ...languageShows.results, ...matching].forEach((item) => {
          unique.set(`${item.type}_${item.id}`, item);
        });
        setResults([...unique.values()].slice(0, 24));
      } catch (err) {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceRaw);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-overlay-title"
      className="fixed inset-y-0 left-0 right-0 lg:right-52 bg-[#111113] z-[170] pt-16 lg:pt-8 px-4 sm:px-6 lg:px-8 selection:bg-red-500/30 overflow-y-auto"
    >
      <div className="w-full max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h1 id="search-overlay-title" className="text-xl sm:text-2xl font-bold text-white">البحث</h1>
            <p className="text-sm text-stone-400 mt-1">ابحث عن فيلم أو مسلسل، أو تصفّح حسب التصنيف.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="noir-icon-button shrink-0"
            aria-label="إغلاق البحث"
            title="إغلاق البحث"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input area — bar بحث كبير */}
        <div className="flex items-center gap-3 px-4 sm:px-5 min-h-14 noir-surface mb-7 backdrop-blur-xl">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن فيلم أو مسلسل..."
            aria-label="ابحث عن فيلم أو مسلسل"
            className="flex-1 bg-transparent border-0 outline-none text-white text-base md:text-lg font-medium placeholder-gray-500 text-right font-sans"
            autoComplete="off"
          />
          {isLoading ? (
            <Loader className="w-4 h-4 text-red-500 animate-spin shrink-0" />
          ) : (
            query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center cursor-pointer"
                aria-label="مسح البحث"
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
              <h2 className="font-display text-xl sm:text-2xl font-bold text-white mb-4 text-right">تصفّح حسب التصنيف</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3" dir="rtl">
                {CATEGORIES.map((cat) => (
                  <button
                    type="button"
                    key={cat.key}
                    onClick={() => onBrowseCategory?.(cat.key)}
                    className="group relative aspect-[16/10] rounded-2xl overflow-hidden cursor-pointer border border-white/[0.08] hover:border-white/20 transition-all hover:scale-[1.03]"
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
                    <div className="absolute inset-0 flex items-center justify-center p-2">
                      <span className="font-display text-base sm:text-lg font-bold text-white text-center drop-shadow-lg leading-tight">{cat.title}</span>
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
                      onSelectTitle(item.type, item.id);
                      onClose();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelectTitle(item.type, item.id);
                        onClose();
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`فتح ${item.title}`}
                    className="flex items-center gap-4 px-4 sm:px-5 py-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors text-right"
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

                    <div className="flex items-center gap-3">
                      {onToggleSave && (
                        <WatchlistButton
                          saved={isSaved?.(item) ?? false}
                          onToggle={() => onToggleSave(item)}
                          compact
                        />
                      )}
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
            null
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
