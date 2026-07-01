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
    <div className="relative group/row mb-14 flex flex-col gap-4">
      <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white px-6 md:px-12 text-right">{title}</h2>

      <div className="relative px-6 md:px-12">
        {/* Right arrow (previous in RTL) */}
        {showRightArrow && (
          <button
            onClick={() => handleScroll('right')}
            className="absolute right-8 top-[42%] z-40 w-10 h-10 rounded-full bg-black/80 hover:bg-stone-900 border border-white/5 text-white items-center justify-center cursor-pointer transition-all shadow-xl hidden md:flex"
            aria-label="السابق"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
        {showLeftArrow && (
          <button
            onClick={() => handleScroll('left')}
            className="absolute left-8 top-[42%] z-40 w-10 h-10 rounded-full bg-black/80 hover:bg-stone-900 border border-white/5 text-white items-center justify-center cursor-pointer transition-all shadow-xl hidden md:flex"
            aria-label="التالي"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        <div
          ref={rowRef}
          onScroll={checkScroll}
          dir="rtl"
          className="flex flex-row gap-4 md:gap-6 overflow-x-auto no-scrollbar pb-3 scroll-smooth select-none"
        >
          {CATEGORIES.map((cat) => (
            <div
              key={cat.key}
              onClick={() => onSelect(cat.key)}
              className="group/cat flex-none w-[125px] sm:w-[185px] md:w-[225px] lg:w-[255px] cursor-pointer rounded-2xl p-2 pb-3.5 select-none"
            >
              <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-stone-900 border border-white/8 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]">
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
                  <span className="text-white font-black text-base sm:text-xl md:text-2xl drop-shadow-lg text-center leading-tight">{cat.title}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
