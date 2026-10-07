/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef, useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Play, X } from 'lucide-react';
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
      <div className={`mb-10 flex flex-col gap-4 ${flush ? "" : "px-4 sm:px-6 lg:px-8 xl:px-10"}`}>
        <div className="space-y-1">
          <div className="w-48 h-6 bg-white/[0.07] rounded animate-pulse" />
          <div className="w-32 h-4 bg-white/[0.05] rounded animate-pulse" />
        </div>
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex-none w-[220px] sm:w-[260px] md:w-[300px] xl:w-[330px] animate-pulse">
              <div className="aspect-video w-full rounded-[18px] bg-[#121318] shimmer-bg" />
              <div className="mt-3 h-4 w-28 rounded bg-[#15161b]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="relative mb-9 flex flex-col md:mb-12 group/row" aria-labelledby={`row-${title.replace(/\s+/g, '-')}`}>
      {/* Category Header */}
      <div className={`mb-3.5 flex flex-col text-right ${flush ? "" : "px-4 sm:px-6 lg:px-8 xl:px-10"}`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex flex-col text-right">
            {viewAllHash ? (
              <a
                href={viewAllHash}
                id={`row-${title.replace(/\s+/g, '-')}`}
                className="group/title flex cursor-pointer items-center gap-1.5 text-lg font-bold text-white transition-colors hover:text-white/75 md:text-xl"
              >
                <span>{title}</span>
                <ChevronLeft className="w-5 h-5 text-white/40 group-hover/title:text-white group-hover/title:-translate-x-0.5 transition-all" />
              </a>
            ) : (
              <>
                <h2 id={`row-${title.replace(/\s+/g, '-')}`} className="flex items-center text-lg font-bold tracking-[-0.02em] text-white md:text-xl">
                  <span>{title}</span>
                </h2>
                {subtitle && <p className="mt-1 text-xs text-white/38 sm:text-[13px]">{subtitle}</p>}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Row Shell with Overlay Arrows */}
      <div className={`relative ${flush ? "" : "px-4 sm:px-6 lg:px-8 xl:px-10"}`}>
        {/* Edge fade gradients (only when scrollable in that direction) */}
        {showRightArrow && (
          <div className="hidden md:block absolute right-0 top-0 bottom-3 w-24 z-30 pointer-events-none bg-gradient-to-l from-[#08090c] to-transparent" />
        )}
        {showLeftArrow && (
          <div className="hidden md:block absolute left-0 top-0 bottom-3 w-24 z-30 pointer-events-none bg-gradient-to-r from-[#08090c] to-transparent" />
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
          data-tv-focus-row
          dir="rtl"
          className="noir-movie-row-track flex flex-row gap-3.5 overflow-x-auto no-scrollbar py-2 scroll-smooth select-none md:gap-4"
        >
          {items.map((item, idx) => {
            const saved = isSaved?.(item) ?? false;
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
                data-tv-card
                aria-label={`فتح ${item.title}`}
                style={{ animationDelay: `${idx * 45}ms` }}
                className="group/card card-pop card-cinematic relative flex-none w-[220px] cursor-pointer select-none sm:w-[260px] md:w-[300px] xl:w-[330px]"
              >
                <div data-tv-card-artwork className="relative aspect-video overflow-hidden rounded-[16px] border border-white/[0.065] bg-[#101116] shadow-[0_18px_44px_-30px_rgba(0,0,0,1)] md:rounded-[18px]">
                  {onToggleSave && (
                    <WatchlistButton
                      saved={saved}
                      onToggle={() => onToggleSave(item)}
                      compact={compactSaveButton}
                      className={`absolute top-2.5 z-30 transition-opacity ${saved ? '' : 'md:opacity-0 md:group-hover/card:opacity-100'} ${ranked ? 'left-2.5' : 'right-2.5'}`}
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
                  {item.backdrop || item.poster ? (
                    <img
                      src={item.backdrop || item.poster || undefined}
                      alt={item.title}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="h-full w-full select-none object-cover transition-transform duration-500 md:group-hover/card:scale-[1.025]"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-3 text-stone-600 bg-stone-950">
                      <span className="text-[10px] sm:text-xs font-semibold text-center leading-normal break-all line-clamp-2">
                        {item.title}
                      </span>
                    </div>
                  )}
                  {ranked && (
                    <span className="pointer-events-none absolute right-2.5 top-2.5 z-20 rounded-[10px] border border-white/10 bg-black/45 px-2 py-1 text-[11px] font-bold text-white/85 backdrop-blur-md">
                      #{idx + 1}
                    </span>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 md:group-hover/card:bg-black/25 md:group-hover/card:opacity-100">
                    <span className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/15 bg-black/45 text-white backdrop-blur-lg">
                      <Play className="h-4 w-4 fill-current" />
                    </span>
                  </div>

                  {/* Watch progression indicator */}
                  {progress > 0 && (
                    <div className="absolute bottom-0 left-3 right-3 h-0.5 overflow-hidden rounded-full bg-white/20">
                      <div 
                        className="h-full bg-red-600 transition-all duration-300" 
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="px-1 pt-3 text-right">
                  <p className="truncate text-sm font-semibold text-white/92">{item.title}</p>
                  <p className="mt-1 text-[11px] font-medium text-white/38">
                    {item.year || '—'} · {item.type === 'movie' ? 'فيلم' : 'مسلسل'}
                  </p>
                </div>

              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
