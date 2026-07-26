/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef, useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Star, X } from 'lucide-react';
import { MovieOrShow } from '../types';
import WatchlistButton from './WatchlistButton';

interface MovieRowProps {
  title: string;
  subtitle?: string;
  items: MovieOrShow[];
  onItemClick: (item: MovieOrShow) => void;
  viewAllHash?: string;
  flush?: boolean;
  onRemove?: (item: MovieOrShow) => void;
  isSaved?: (item: MovieOrShow) => boolean;
  onToggleSave?: (item: MovieOrShow) => void;
  compactSaveButton?: boolean;
  ranked?: boolean;
}

export default function MovieRow({
  title,
  subtitle,
  items,
  onItemClick,
  viewAllHash,
  flush = false,
  onRemove,
  isSaved,
  onToggleSave,
  compactSaveButton = false,
  ranked = false,
}: MovieRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const scrollSaveFrameRef = useRef<number | null>(null);
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
    const saved = Number(localStorage.getItem(`noir_row_scroll_${title}`) || 0);
    const restoreFrame = window.requestAnimationFrame(() => {
      if (rowRef.current && Number.isFinite(saved)) rowRef.current.scrollLeft = saved;
      checkScroll();
    });
    window.addEventListener('resize', checkScroll);
    return () => {
      window.cancelAnimationFrame(restoreFrame);
      window.removeEventListener('resize', checkScroll);
      if (scrollSaveFrameRef.current != null) {
        window.cancelAnimationFrame(scrollSaveFrameRef.current);
        scrollSaveFrameRef.current = null;
      }
    };
  }, [items, title]);

  const handleRowScroll = () => {
    checkScroll();
    if (scrollSaveFrameRef.current != null) return;
    scrollSaveFrameRef.current = window.requestAnimationFrame(() => {
      scrollSaveFrameRef.current = null;
      if (rowRef.current) {
        localStorage.setItem(`noir_row_scroll_${title}`, String(rowRef.current.scrollLeft));
      }
    });
  };

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
      <div className={`mb-10 flex flex-col gap-4 ${flush ? "" : "px-4 sm:px-6 lg:px-8"}`}>
        <div className="space-y-1">
          <div className="w-48 h-6 bg-stone-800 rounded animate-pulse" />
          <div className="w-32 h-4 bg-stone-800 rounded animate-pulse" />
        </div>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex-none w-[120px] sm:w-[160px] aspect-[2/3] bg-stone-950 border border-white/8 rounded-xl flex flex-col justify-end gap-3 animate-pulse">
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
    <section className="mb-8 md:mb-10 relative group/row flex flex-col" aria-labelledby={`row-${title.replace(/\s+/g, '-')}`}>
      {/* Category Header */}
      <div className={`mb-3 md:mb-4 flex flex-col text-right ${flush ? "" : "px-4 sm:px-6 lg:px-8"}`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex flex-col text-right">
            {viewAllHash ? (
              <a
                href={viewAllHash}
                id={`row-${title.replace(/\s+/g, '-')}`}
                className="group/title text-xl md:text-2xl font-bold text-white flex items-center gap-1.5 hover:text-white/80 transition-colors cursor-pointer"
              >
                <span>{title}</span>
                <ChevronLeft className="w-5 h-5 text-white/40 group-hover/title:text-white group-hover/title:-translate-x-0.5 transition-all" />
              </a>
            ) : (
              <>
                <h2 id={`row-${title.replace(/\s+/g, '-')}`} className="text-xl md:text-2xl font-bold text-white flex items-center">
                  <span>{title}</span>
                </h2>
                {subtitle && <p className="mt-1 text-xs sm:text-sm text-white/45">{subtitle}</p>}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Row Shell with Overlay Arrows */}
      <div className={`relative ${flush ? "" : "px-4 sm:px-6 lg:px-8"}`}>
        {/* Edge fade gradients (only when scrollable in that direction) */}
        {showRightArrow && (
          <div className="hidden md:block absolute right-0 top-0 bottom-3 w-24 z-30 pointer-events-none bg-gradient-to-l from-[#17171a] to-transparent" />
        )}
        {showLeftArrow && (
          <div className="hidden md:block absolute left-0 top-0 bottom-3 w-24 z-30 pointer-events-none bg-gradient-to-r from-[#17171a] to-transparent" />
        )}
         {/* Navigation Arrows for desktop hover */}
        {showRightArrow && (
          <button
            onClick={() => handleScroll('right')}
            className="absolute right-8 top-[41%] z-45 w-9 h-9 rounded-full bg-black/35 hover:bg-black/55 backdrop-blur-md text-white/90 hover:text-white items-center justify-center cursor-pointer pointer-events-auto transition-all opacity-0 group-hover/row:opacity-100 hidden md:flex"
            aria-label="قناة سابقة"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {showLeftArrow && (
          <button
            onClick={() => handleScroll('left')}
            className="absolute left-8 top-[41%] z-45 w-9 h-9 rounded-full bg-black/35 hover:bg-black/55 backdrop-blur-md text-white/90 hover:text-white items-center justify-center cursor-pointer pointer-events-auto transition-all opacity-0 group-hover/row:opacity-100 hidden md:flex"
            aria-label="قناة لاحقة"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* Dynamic Carousel Area */}
        <div
          ref={rowRef}
          onScroll={handleRowScroll}
          dir="rtl"
          className="flex flex-row gap-2.5 md:gap-3 overflow-x-auto no-scrollbar pb-3 scroll-smooth select-none"
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
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onItemClick(item);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`فتح ${item.title}`}
                style={{ animationDelay: `${idx * 45}ms` }}
                className="group/card card-pop relative flex-none w-[112px] sm:w-[140px] md:w-[156px] lg:w-[168px] cursor-pointer rounded-2xl p-1.5 pb-3 select-none"
              >
                {/* Poster Artwork container */}
                <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-stone-900 border border-white/[0.08]">
                  {onToggleSave && (
                    <WatchlistButton
                      saved={isSaved?.(item) ?? false}
                      onToggle={() => onToggleSave(item)}
                      compact={compactSaveButton}
                      className={`absolute top-2 z-30 ${ranked ? 'left-2' : 'right-2'}`}
                    />
                  )}
                  {!onToggleSave && onRemove && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onRemove(item);
                      }}
                      className="absolute top-2 left-2 z-10 w-8 h-8 rounded-full glass flex items-center justify-center text-white/80 hover:text-white opacity-100 md:opacity-0 md:group-hover/card:opacity-100 transition-all hover:bg-white/20 cursor-pointer"
                      title="إزالة من قائمتي"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {item.poster || item.backdrop ? (
                    <img
                      src={item.poster || item.backdrop || undefined}
                      alt={item.title}
                      loading={idx < 6 ? 'eager' : 'lazy'}
                      fetchPriority={idx < 4 ? 'high' : 'auto'}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover select-none transition-transform duration-300 md:group-hover/card:scale-[1.04]"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-3 text-stone-600 bg-stone-950">
                      <span className="text-[10px] sm:text-xs font-semibold text-center leading-normal break-all line-clamp-2">
                        {item.title}
                      </span>
                    </div>
                  )}
                  {ranked && (
                    <img
                      src={`/top10/${idx + 1}.svg`}
                      alt={`المرتبة ${idx + 1}`}
                      className="absolute top-2 right-2 z-20 h-8 sm:h-9 w-auto max-w-[52px] object-contain object-right-top pointer-events-none select-none drop-shadow-[0_3px_8px_rgba(0,0,0,.7)]"
                    />
                  )}
                  {/* Subtle gradient at bottom of poster for depth */}
                  <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 pointer-events-none" />

                  {/* Rating stamp — ثابت في الجهة المقابلة لزر الحفظ */}
                  {hasScore && (
                    <div className={`absolute left-2 glass text-[#f5c518] text-[11px] font-bold px-1.5 py-0.5 rounded-lg flex items-center gap-0.5 ${
                      ranked ? 'bottom-2' : 'top-2'
                    }`}>
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
                  <span className="text-white font-semibold text-sm line-clamp-1 leading-tight transition-colors">
                    {item.title}
                  </span>
                  <span className="text-white/60 font-medium text-[11px] sm:text-xs mt-1 flex items-center gap-1 justify-start">
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
    </section>
  );
}
