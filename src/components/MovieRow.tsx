/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef, useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Star } from 'lucide-react';
import { MovieOrShow } from '../types';

interface MovieRowProps {
  title: string;
  subtitle?: string;
  items: MovieOrShow[];
  onItemClick: (item: MovieOrShow) => void;
  viewAllHash?: string;
}

export default function MovieRow({ title, subtitle, items, onItemClick, viewAllHash }: MovieRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  // Check scroll positions to toggling arrows
  const checkScroll = () => {
    if (rowRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
      
      // Since RTL scrollLeft is either negative or standard depending on browser representation,
      // we check mathematically standard indicators
      const absScroll = Math.abs(scrollLeft);
      
      // Can scroll left (to previous items in RTL) -> scrollLeft is negative closer to 0
      setShowRightArrow(absScroll > 10);
      setShowLeftArrow(absScroll + clientWidth < scrollWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [items]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const { clientWidth } = rowRef.current;
      // Scroll amount (75% of view width)
      const scrollAmount = clientWidth * 0.75;
      
      rowRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
      
      // Delay check scroll as layout shifts smoothly
      setTimeout(checkScroll, 350);
    }
  };

  if (!items.length) {
    // Skeletons
    return (
      <div className="mb-14 px-6 md:px-12 flex flex-col gap-4">
        <div className="space-y-1">
          <div className="w-48 h-6 bg-stone-800 rounded animate-pulse" />
          <div className="w-32 h-4 bg-stone-800 rounded animate-pulse" />
        </div>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex-none w-[160px] sm:w-[220px] aspect-[16/9] bg-stone-950 border border-white/5 rounded-2xl p-2 flex flex-col justify-end gap-3 animate-pulse">
              <div className="w-full h-full bg-stone-900 rounded-xl shimmer-bg" />
              <div className="w-24 h-4 bg-stone-900 rounded" />
              <div className="w-12 h-3 bg-stone-900 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-10 relative group/row flex flex-col">
      {/* Category Header */}
      <div className="px-6 md:px-12 mb-3 flex flex-col text-right">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex flex-col text-right">
            {viewAllHash ? (
              <a
                href={viewAllHash}
                className="group/title font-display text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-1.5 hover:text-white/80 transition-colors cursor-pointer"
              >
                <span>{title}</span>
                <ChevronLeft className="w-5 h-5 text-stone-500 group-hover/title:text-white group-hover/title:-translate-x-0.5 transition-all" />
              </a>
            ) : (
              <h2 className="font-display text-xl md:text-2xl font-black tracking-tight text-white flex items-center">
                <span>{title}</span>
              </h2>
            )}
          </div>
          {viewAllHash && (
            <a
              href={viewAllHash}
              className="group/all flex items-center gap-1 text-red-500 hover:text-red-400 text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap"
            >
              <span>عرض الكل</span>
              <ChevronLeft className="w-3.5 h-3.5 transition-transform group-hover/all:-translate-x-1" />
            </a>
          )}
        </div>
      </div>

      {/* Row Shell with Overlay Arrows */}
      <div className="relative px-6 md:px-12">
         {/* Navigation Arrows for desktop hover */}
        {showRightArrow && (
          <button
            onClick={() => handleScroll('right')}
            className="absolute right-8 top-[41%] z-45 w-10 h-10 rounded-full bg-black/80 hover:bg-stone-900 border border-white/5 text-white flex items-center justify-center cursor-pointer pointer-events-auto transition-all shadow-xl hover:scale-110 hidden md:flex"
            aria-label="قناة سابقة"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {showLeftArrow && (
          <button
            onClick={() => handleScroll('left')}
            className="absolute left-8 top-[41%] z-45 w-10 h-10 rounded-full bg-black/80 hover:bg-stone-900 border border-white/5 text-white flex items-center justify-center cursor-pointer pointer-events-auto transition-all shadow-xl hover:scale-110 hidden md:flex"
            aria-label="قناة لاحقة"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* Dynamic Carousel Area */}
        <div
          ref={rowRef}
          onScroll={checkScroll}
          dir="rtl"
          className="flex flex-row gap-4 md:gap-6 overflow-x-auto no-scrollbar pb-3 scroll-smooth select-none snap-x snap-mandatory"
        >
          {items.map((item, idx) => {
            const hasScore = item.rating > 0;
            const progressKey = `noir_progress_${item.type}_${item.id}`;
            const storedProgress = localStorage.getItem(progressKey);
            const progress = storedProgress ? Number(storedProgress) : 0;

            return (
              <div
                key={`${item.type}-${item.id}`}
                onClick={() => onItemClick(item)}
                style={{ animationDelay: `${idx * 45}ms` }}
                className="group/card card-transition flex-none w-[125px] sm:w-[185px] md:w-[225px] lg:w-[255px] snap-start cursor-pointer rounded-2xl p-2 pb-3.5 select-none"
              >
                {/* Poster Artwork container */}
                <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-stone-900 border border-white/8 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]">
                  {item.poster || item.backdrop ? (
                    <img
                      src={item.poster || item.backdrop || undefined}
                      alt={item.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover select-none transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-3 text-stone-600 bg-stone-950">
                      <span className="text-[10px] sm:text-xs font-semibold text-center leading-normal break-all line-clamp-2">
                        {item.title}
                      </span>
                    </div>
                  )}

                  {/* Subtle gradient at bottom of poster for depth */}
                  <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 pointer-events-none" />

                  {/* Rating stamp */}
                  {hasScore && (
                    <div className="absolute bottom-2 right-2 glass text-[#f5c518] text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-lg flex items-center gap-0.5">
                      <Star className="w-2.5 h-2.5 fill-current" />
                      <span>{item.rating.toFixed(1)}</span>
                    </div>
                  )}

                  {/* Watch progression indicator */}
                  {progress > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                      <div 
                        className="h-full bg-red-600 transition-all duration-300" 
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Meta details */}
                <div className="mt-2.5 px-1 text-right flex flex-col">
                  <span className="text-white font-bold text-xs sm:text-sm line-clamp-1 leading-tight transition-colors">
                    {item.title}
                  </span>
                  <span className="text-stone-500 font-semibold text-[10px] sm:text-xs mt-1 flex items-center gap-1 justify-start">
                    <span>{item.year || '—'}</span>
                    <span className="w-1 h-1 bg-stone-800 rounded-full" />
                    <span>{item.type === 'movie' ? 'فيلم' : 'مسلسل'}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
