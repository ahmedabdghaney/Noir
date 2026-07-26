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
    <section className="relative group/row mb-8 md:mb-10 flex flex-col gap-3 md:gap-4" aria-labelledby="category-row-title">
      <h2 id="category-row-title" className="text-xl md:text-2xl font-bold text-white px-4 sm:px-6 lg:px-8 text-right">{title}</h2>

      <div className="relative px-4 sm:px-6 lg:px-8">
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
          className="flex flex-row gap-2.5 md:gap-3 overflow-x-auto no-scrollbar pb-3 scroll-smooth select-none"
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
              className="group/cat flex-none w-[112px] sm:w-[140px] md:w-[156px] lg:w-[168px] cursor-pointer rounded-2xl p-1.5 pb-3 select-none"
            >
              <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-stone-900 border border-white/[0.08]">
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                {/* Title */}
                <div className="absolute inset-x-0 bottom-0 p-3 flex items-end justify-center">
                  <span className="text-white font-bold text-base sm:text-lg md:text-xl drop-shadow-lg text-center leading-tight">{cat.title}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
