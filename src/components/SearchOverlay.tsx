/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Search, X, Star, ChevronLeft, Loader } from 'lucide-react';
import { MovieOrShow } from '../types';
import { searchMulti, discoverTitles } from '../lib/tmdb';
import { CATEGORIES } from '../lib/categories';
import { NoirPlayer } from '../lib/noirPlayer';
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
  const [filter, setFilter] = useState<'all' | 'movie' | 'tv' | 'anime'>('all');
  const [recent, setRecent] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('noir_recent_searches') || '[]'); } catch { return []; }
  });
  const [results, setResults] = useState<MovieOrShow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [catImages, setCatImages] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const focusResultsAfterSearchRef = useRef(false);
  const isTvApp = document.documentElement.classList.contains('noir-tv-app');

  useEffect(() => {
    if (!isOpen || isTvApp) return;
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
  }, [isOpen, isTvApp]);

  // Focus on entry and remove data left by the deleted search-history feature.
  useEffect(() => {
    if (isOpen) {
      const focusTimer = window.setTimeout(() => {
        inputRef.current?.focus();
        if (isTvApp) {
          void NoirPlayer.showKeyboard().catch(() => {});
        }
      }, 120);
      return () => window.clearTimeout(focusTimer);
    }
  }, [isOpen, isTvApp]);

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

  useEffect(() => {
    if (!isTvApp || isLoading || !focusResultsAfterSearchRef.current) return;
    focusResultsAfterSearchRef.current = false;
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>('.noir-tv-search-overlay [data-tv-search-result]')
        ?.focus({ preventScroll: true });
    });
  }, [isLoading, isTvApp, results]);

  const submitTvSearch = () => {
    if (!isTvApp) return;
    focusResultsAfterSearchRef.current = true;
    inputRef.current?.blur();
    void NoirPlayer.hideKeyboard().catch(() => {});
    if (!isLoading && results.length > 0) {
      window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>('.noir-tv-search-overlay [data-tv-search-result]')
          ?.focus({ preventScroll: true });
      });
    }
  };

  if (!isOpen) return null;

  const visibleResults = results.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'anime') return item.genres.some((genre) => /anime|animation|رسوم/i.test(genre));
    return item.type === filter;
  });

  const rememberQuery = () => {
    const value = query.trim();
    if (!value) return;
    const next = [value, ...recent.filter((entry) => entry !== value)].slice(0, 5);
    setRecent(next);
    localStorage.setItem('noir_recent_searches', JSON.stringify(next));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-overlay-title"
      className={`noir-web-search-overlay fixed inset-y-0 left-0 right-0 selection:bg-red-500/30 overflow-y-auto ${
        isTvApp
          ? 'noir-tv-search-overlay right-0 z-[200] px-[4vw] pt-24'
          : 'z-[190] pt-16 lg:z-[230] lg:pt-24 px-4 sm:px-6 lg:px-12'
      }`}
    >
      <button type="button" className="noir-search-backdrop" onClick={onClose} aria-label="Close search" />
      <div className="noir-search-panel w-full max-w-7xl mx-auto">
        <div className={`flex items-center justify-between gap-4 ${isTvApp ? 'mb-7' : 'mb-4'}`}>
          <div>
            <h1 id="search-overlay-title" className={`${isTvApp ? 'text-4xl' : 'text-xl sm:text-2xl'} font-bold text-white`}>Search</h1>
            <p className={`${isTvApp ? 'text-lg' : 'text-sm'} text-stone-400 mt-1`}>Search for a movie, show, or browse by genre.</p>
          </div>
          {!isTvApp && (
            <button
              type="button"
              onClick={onClose}
              className="noir-icon-button hidden shrink-0 lg:inline-flex"
              aria-label="Close search"
              title="Close search"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Input area — bar بحث كبير */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitTvSearch();
          }}
          dir={isTvApp ? undefined : 'ltr'}
          className={`flex items-center gap-3 px-4 sm:px-5 noir-surface mb-7 backdrop-blur-xl ${isTvApp ? 'min-h-20 rounded-2xl' : 'min-h-14'}`}
        >
          <Search className={`${isTvApp ? 'w-7 h-7' : 'w-5 h-5'} text-gray-400 shrink-0`} />
          <input
            ref={inputRef}
            data-tv-autofocus={isTvApp ? '' : undefined}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(event) => {
              if (isTvApp && event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation();
                submitTvSearch();
                return;
              }
              if (
                isTvApp &&
                event.key === 'ArrowUp'
              ) {
                event.preventDefault();
                event.stopPropagation();
                document
                  .querySelector<HTMLElement>('[data-tv-navigation] [data-tv-nav-item="search"]')
                  ?.focus({ preventScroll: true });
              }
            }}
            placeholder="Search movies, shows, and anime"
            aria-label="Search movies and shows"
            enterKeyHint="search"
            className={`flex-1 bg-transparent border-0 outline-none text-white font-medium placeholder-gray-500 font-sans ${isTvApp ? 'text-2xl text-right' : 'text-sm text-left'}`}
            autoComplete="off"
          />
          {isLoading && <Loader className="w-4 h-4 text-[#A0C9CB] animate-spin shrink-0" />}
          {!isTvApp && (
            <button type="button" onClick={onClose} className="noir-search-close-button" aria-label="Close search">
              <X className="w-4 h-4" />
            </button>
          )}
        </form>

        {!isTvApp && (
          <div className="noir-search-quick-panel">
            <div className="noir-search-tabs">
              {([['all', 'All'], ['movie', 'Movies'], ['tv', 'Shows'], ['anime', 'Anime']] as const).map(([value, label]) => (
                <button key={value} type="button" className={filter === value ? 'is-active' : ''} onClick={() => setFilter(value)}>{label}</button>
              ))}
            </div>
            {!query.trim() && recent.length > 0 && (
              <div className="noir-recent-searches">
                <div><strong>RECENT</strong><button type="button" onClick={() => { setRecent([]); localStorage.removeItem('noir_recent_searches'); }}>Clear</button></div>
                {recent.map((entry) => <button type="button" key={entry} onClick={() => setQuery(entry)}>{entry}</button>)}
              </div>
            )}
          </div>
        )}

        {/* Body */}
        <div className="pb-20">
          {/* قسم التصفح بالتصنيفات — يظهر لما ماكو بحث */}
          {!query.trim() && !isTvApp && (
            <div className="mb-10">
              <h2 className="font-display text-xl sm:text-2xl font-bold text-white mb-4 text-right">Browse by genre</h2>
              <div className={`grid gap-3 ${isTvApp ? 'grid-cols-5' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3'}`} dir="rtl">
                {CATEGORIES.map((cat) => (
                  <button
                    type="button"
                    key={cat.key}
                    data-tv-card
                    onClick={() => onBrowseCategory?.(cat.key)}
                    className={`group relative aspect-video rounded-md overflow-hidden cursor-pointer border border-white/[0.08] hover:border-white/20 transition-all ${isTvApp ? '' : 'hover:scale-[1.025]'}`}
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
            visibleResults.length > 0 ? (
              <div className={isTvApp ? 'grid grid-cols-3 gap-4' : 'space-y-0.5'}>
                <div className={`font-bold text-gray-500 px-5 py-1.5 text-right select-none uppercase ${isTvApp ? 'col-span-3 text-sm' : 'text-[10px]'}`}>
                   Search results ({visibleResults.length})
                </div>
                {visibleResults.slice(0, isTvApp ? 18 : 8).map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    onClick={() => {
                      rememberQuery();
                      onSelectTitle(item.type, item.id);
                      onClose();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        rememberQuery();
                        onSelectTitle(item.type, item.id);
                        onClose();
                      }
                    }}
                    role="button"
                    data-tv-card
                    data-tv-search-result
                    tabIndex={0}
                    aria-label={`Open ${item.title}`}
                    className={`flex items-center gap-4 rounded-xl hover:bg-white/5 cursor-pointer transition-colors text-right ${
                      isTvApp ? 'border border-white/8 bg-white/[0.03] p-4' : 'px-4 sm:px-5 py-3'
                    }`}
                  >
                    <div data-tv-card-artwork={isTvApp ? '' : undefined} className="relative w-10 h-14 bg-stone-800 rounded-lg overflow-hidden shrink-0 select-none">
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
                        <span>{item.type === 'movie' ? 'Movie' : 'TV Show'}</span>
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
                No results found for “{query}”. Check the spelling and try again.
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
