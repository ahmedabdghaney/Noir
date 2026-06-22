/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Search, X, Star, ChevronLeft, Loader, Trash2 } from 'lucide-react';
import { MovieOrShow } from '../types';
import { searchMulti, fetchTrendingWeek } from '../lib/tmdb';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTitle: (type: 'movie' | 'tv', id: number) => void;
}

export default function SearchOverlay({ isOpen, onClose, onSelectTitle }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MovieOrShow[]>([]);
  const [trending, setTrending] = useState<MovieOrShow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus on entry & load history/trending
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
      
      // Load recent searches from Local Storage
      try {
        const saved = localStorage.getItem('noir_recent_searches');
        if (saved) {
          setRecentSearches(JSON.parse(saved));
        }
      } catch (err) {
        console.error("Error loading recent searches: ", err);
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

  // Helper to append a search term to recent history
  const addToRecentSearches = (term: string) => {
    if (!term || !term.trim()) return;
    const cleanTerm = term.trim();
    try {
      const saved = localStorage.getItem('noir_recent_searches');
      let currentList: string[] = saved ? JSON.parse(saved) : [];
      currentList = [cleanTerm, ...currentList.filter(t => t !== cleanTerm)].slice(0, 5);
      setRecentSearches(currentList);
      localStorage.setItem('noir_recent_searches', JSON.stringify(currentList));
    } catch (err) {
      console.error(err);
    }
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('noir_recent_searches');
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[500] pt-24 md:pt-32 px-4 selection:bg-red-500/30 overflow-y-auto"
    >
      <div className="max-w-2xl mx-auto bg-neutral-900/95 border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-pop-in">
        
        {/* Input area */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن أفلام، مسلسلات، ممثلين..."
            className="flex-1 bg-transparent border-0 outline-none text-white text-base font-medium placeholder-gray-500 text-right font-sans"
            autoComplete="off"
          />
          {isLoading ? (
            <Loader className="w-4 h-4 text-red-500 animate-spin shrink-0" />
          ) : (
            query && (
              <button
                onClick={() => setQuery('')}
                className="hidden md:flex w-5 h-5 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )
          )}
          <span
            onClick={onClose}
            className="hidden md:inline text-[10px] font-bold text-gray-400 border border-white/10 rounded px-1.5 py-0.5 cursor-pointer hover:bg-white/5 select-none"
          >
            ESC
          </span>
        </div>

        {/* Suggestion Lists Body */}
        <div className="max-h-[60vh] overflow-y-auto py-2">
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
                      addToRecentSearches(query || item.title);
                      onSelectTitle(item.type, item.id);
                      onClose();
                    }}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-white/5 cursor-pointer transition-colors text-right"
                  >
                    <div className="w-10 h-14 bg-neutral-800 rounded-lg overflow-hidden shrink-0 select-none">
                      {item.poster ? (
                        <img src={item.poster} alt={item.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-neutral-600">
                          {item.title.slice(0, 2)}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0 pr-1">
                      <h5 className="text-white font-semibold text-sm truncate">{item.title}</h5>
                      <p className="text-gray-400 text-xs mt-1 font-medium flex items-center gap-1.5">
                        <span>{item.year || '—'}</span>
                        <span className="w-1 h-1 bg-neutral-700 rounded-full" />
                        <span>{item.type === 'movie' ? 'فيلم' : 'مسلسل'}</span>
                        {item.genres.length > 0 && (
                          <>
                            <span className="w-1 h-1 bg-neutral-700 rounded-full" />
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
              {/* Recent Searches Section */}
              {recentSearches.length > 0 && (
                <div className="px-5 py-2.5 text-right font-sans">
                  <div className="flex items-center justify-between text-[11px] font-extrabold text-neutral-400 select-none mb-2">
                    <span>آخر عمليات البحث لك</span>
                    <button
                      onClick={clearRecentSearches}
                      className="text-red-500 hover:text-red-400 flex items-center gap-1 transition-colors text-[10px]"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>مسح السجل</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-start [direction:rtl]">
                    {recentSearches.map((term, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setQuery(term);
                          inputRef.current?.focus();
                        }}
                        className="bg-neutral-800 hover:bg-neutral-700/80 text-gray-200 rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all border border-white/5 active:scale-95"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions / Trending List */}
              {trending.length > 0 && (
                <div className={`space-y-0.5 ${recentSearches.length > 0 ? 'border-t border-white/5 pt-3' : ''}`}>
                  <div className="text-[10px] font-bold text-gray-500 px-5 py-1.5 text-right select-none uppercase">
                    أبحر في العناوين الرائجة اليوم
                  </div>
                  {trending.slice(0, 6).map((item) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      onClick={() => {
                        addToRecentSearches(item.title);
                        onSelectTitle(item.type, item.id);
                        onClose();
                      }}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-white/5 cursor-pointer transition-colors text-right"
                    >
                      <div className="w-10 h-14 bg-neutral-800 rounded-lg overflow-hidden shrink-0 select-none">
                        {item.poster ? (
                          <img src={item.poster} alt={item.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-neutral-600">
                            {item.title.slice(0, 2)}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0 pr-1">
                        <h5 className="text-white font-semibold text-sm truncate">{item.title}</h5>
                        <p className="text-gray-400 text-xs mt-1 font-medium flex items-center gap-1.5">
                          <span>{item.year || '—'}</span>
                          <span className="w-1 h-1 bg-neutral-700 rounded-full" />
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
  );
}
