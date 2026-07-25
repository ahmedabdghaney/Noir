import { useEffect, useRef, useState } from 'react';
import { Loader, Search, Star, Trash2, X } from 'lucide-react';
import { MovieOrShow } from '../types';
import { searchMulti } from '../lib/tmdb';
import { CATEGORIES } from '../lib/categories';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTitle: (type: 'movie' | 'tv', id: number) => void;
  onBrowseCategory?: (key: string) => void;
}

type RecentTitle = MovieOrShow & { openedAt: number };

export default function SearchOverlay({
  isOpen,
  onClose,
  onSelectTitle,
  onBrowseCategory,
}: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MovieOrShow[]>([]);
  const [recentTitles, setRecentTitles] = useState<RecentTitle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 60);

    try {
      const saved = localStorage.getItem('noir_recent_titles');
      setRecentTitles(saved ? JSON.parse(saved) : []);
    } catch {
      setRecentTitles([]);
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const matches = await searchMulti(cleanQuery);
        if (!cancelled) setResults(matches.slice(0, 12));
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const openTitle = (item: MovieOrShow) => {
    const next: RecentTitle[] = [
      { ...item, openedAt: Date.now() },
      ...recentTitles.filter((title) => !(title.id === item.id && title.type === item.type)),
    ].slice(0, 8);
    setRecentTitles(next);
    localStorage.setItem('noir_recent_titles', JSON.stringify(next));
    onSelectTitle(item.type, item.id);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[500] bg-[#09090b]/96 backdrop-blur-2xl overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-title"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-5 sm:pt-10 pb-24">
        <div className="flex items-center justify-between gap-4 mb-7">
          <div>
            <span className="noir-eyebrow block mb-1">نوار سينما</span>
            <h1 id="search-title" className="font-display text-2xl sm:text-3xl font-bold text-white">
              البحث
            </h1>
          </div>
          <button onClick={onClose} className="noir-icon-button" aria-label="إغلاق البحث">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="glass-strong min-h-14 flex items-center gap-3 px-4 sm:px-5 rounded-[18px] mb-8">
          <Search className="w-5 h-5 text-white/45 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث عن فيلم أو مسلسل"
            aria-label="ابحث عن فيلم أو مسلسل"
            autoComplete="off"
            className="flex-1 min-w-0 bg-transparent border-0 outline-none text-white text-base sm:text-lg placeholder:text-white/30"
          />
          {isLoading ? (
            <Loader className="w-5 h-5 text-white/55 animate-spin" />
          ) : query ? (
            <button onClick={() => setQuery('')} className="w-9 h-9 rounded-full bg-white/[0.07] flex items-center justify-center text-white/55 hover:text-white" aria-label="مسح البحث">
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>

        {query.trim() ? (
          <section aria-live="polite">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">النتائج</h2>
              {!isLoading && <span className="text-xs text-white/40">{results.length} عنوان</span>}
            </div>

            {!isLoading && results.length === 0 ? (
              <div className="noir-surface py-14 px-6 text-center">
                <h3 className="text-white font-semibold mb-2">ما لكينا نتيجة مطابقة</h3>
                <p className="text-sm text-white/45">جرّب اسم أقصر أو تأكد من الكتابة.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {results.map((item) => (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() => openTitle(item)}
                    className="min-h-[82px] flex items-center gap-4 p-3 rounded-[16px] text-right hover:bg-white/[0.07] border border-transparent hover:border-white/[0.08]"
                  >
                    <div className="w-11 h-16 rounded-[10px] overflow-hidden bg-white/[0.06] shrink-0">
                      {item.poster && <img src={item.poster} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white truncate">{item.title}</h3>
                      <p className="text-xs text-white/45 mt-1">
                        {item.type === 'movie' ? 'فيلم' : 'مسلسل'} {item.year ? `· ${item.year}` : ''}
                      </p>
                    </div>
                    {item.rating > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-[#ffd60a] font-semibold">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        {item.rating.toFixed(1)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : (
          <div className="space-y-9">
            {recentTitles.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white">شاهدتها مؤخراً</h2>
                  <button
                    onClick={() => {
                      setRecentTitles([]);
                      localStorage.removeItem('noir_recent_titles');
                    }}
                    className="min-h-10 px-3 inline-flex items-center gap-1.5 text-xs text-white/45 hover:text-white"
                  >
                    <Trash2 className="w-4 h-4" />
                    مسح
                  </button>
                </div>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                  {recentTitles.map((item) => (
                    <button key={`${item.type}-${item.id}`} onClick={() => openTitle(item)} className="flex-none w-[108px] text-right">
                      <div className="noir-card aspect-[2/3]">
                        {item.poster && <img src={item.poster} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                      </div>
                      <span className="block text-[13px] text-white font-medium truncate mt-2">{item.title}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-lg font-bold text-white mb-4">تصفح حسب التصنيف</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {CATEGORIES.slice(0, 12).map((category) => (
                  <button
                    key={category.key}
                    onClick={() => onBrowseCategory?.(category.key)}
                    className="relative min-h-24 rounded-[18px] overflow-hidden border border-white/[0.08] text-right p-4 flex items-end hover:-translate-y-0.5 transition-transform"
                    style={{ background: `linear-gradient(145deg, ${category.overlay}, #19191d)` }}
                  >
                    <span className="text-white text-base font-bold">{category.title}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
