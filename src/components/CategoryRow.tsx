/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef, useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { CATEGORIES } from '../lib/categories';
import { discoverTitles } from '../lib/tmdb';

interface CategoryRowProps {
  title?: string;
  onSelect: (key: string) => void;
}

export default function CategoryRow({ title = 'تصفّح حسب التصنيف', onSelect }: CategoryRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const [images, setImages] = useState<Record<string, string>>({});

  // Fetch a representative poster (most popular title) for each category
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries: [string, string][] = [];
      let cursor = 0;
      // A small worker pool avoids firing every genre request at once when the
      // home screen mounts, which previously competed with hero and poster data.
      const workers = Array.from({ length: Math.min(4, CATEGORIES.length) }, async () => {
        while (cursor < CATEGORIES.length && !cancelled) {
          const cat = CATEGORIES[cursor++];
          try {
            const res = await discoverTitles('movie', { genreIds: String(cat.primaryGenre), sortBy: 'popularity', page: 1 });
            const withPoster = res.results.find((r) => r.poster);
            entries.push([cat.key, withPoster?.poster || '']);
          } catch {
            entries.push([cat.key, '']);
          }
        }
      });
      await Promise.all(workers);
      if (!cancelled) {
        const map: Record<string, string> = {};
        entries.forEach(([k, v]) => { if (v) map[k] = v; });
        setImages(map);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const checkScroll = () => {
    if (!rowRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
    const abs = Math.abs(scrollLeft);
    setShowRightArrow(abs > 10);
    setShowLeftArrow(abs + clientWidth < scrollWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [images]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (!rowRef.current) return;
    const amount = rowRef.current.clientWidth * 0.75;
    rowRef.current.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
    setTimeout(checkScroll, 350);
  };

  return (
    <section className="relative group/row mb-6 md:mb-8 flex flex-col gap-2.5" aria-labelledby="category-row-title">
      <h2 id="category-row-title" className="text-lg md:text-xl font-bold text-white px-4 sm:px-6 lg:px-12 text-right">{title}</h2>

      <div className="relative px-4 sm:px-6 lg:px-12">
        {/* Right arrow (previous in RTL) */}
        {showRightArrow && (
          <button
            onClick={() => handleScroll('right')}
            className="absolute right-8 top-[42%] z-40 w-9 h-9 rounded-full bg-black/35 hover:bg-black/55 backdrop-blur-md text-white/90 hover:text-white items-center justify-center cursor-pointer pointer-events-auto transition-all opacity-0 group-hover/row:opacity-100 hidden md:flex"
            aria-label="السابق"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
        {showLeftArrow && (
          <button
            onClick={() => handleScroll('left')}
            className="absolute left-8 top-[42%] z-40 w-9 h-9 rounded-full bg-black/35 hover:bg-black/55 backdrop-blur-md text-white/90 hover:text-white items-center justify-center cursor-pointer pointer-events-auto transition-all opacity-0 group-hover/row:opacity-100 hidden md:flex"
            aria-label="التالي"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        <div
          ref={rowRef}
          onScroll={checkScroll}
          dir="rtl"
          className="flex flex-row gap-1.5 md:gap-2 overflow-x-auto no-scrollbar py-2 scroll-smooth select-none"
        >
          {CATEGORIES.map((cat) => (
            <div
              key={cat.key}
              onClick={() => onSelect(cat.key)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(cat.key);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`فتح تصنيف ${cat.title}`}
              className="group/cat card-cinematic flex-none w-[170px] sm:w-[220px] md:w-[248px] xl:w-[278px] cursor-pointer rounded-sm select-none"
            >
              <div className="relative aspect-video overflow-hidden rounded-sm bg-[#101010] border border-white/[0.055]">
                {images[cat.key] && (
                  <img
                    src={images[cat.key]}
                    alt={cat.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-500"
                  />
                )}
                {/* Color overlay (genre identity) */}
                <div className="absolute inset-0" style={{ backgroundColor: cat.overlay }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                {/* Title */}
                <div className="absolute inset-x-0 bottom-0 p-3 flex items-end justify-center">
                  <span className="text-white font-bold text-base sm:text-lg drop-shadow-lg text-center leading-tight">{cat.title}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
