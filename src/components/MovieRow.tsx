/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef, useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Play, Star, X } from 'lucide-react';
import { MovieOrShow } from '../types';
import WatchlistButton from './WatchlistButton';
import TitleLogo from './TitleLogo';

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
  portrait?: boolean;
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
  portrait = true,
}: MovieRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const scrollSaveFrameRef = useRef<number | null>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  // Check scroll positions to toggle arrows (LTR)
  const checkScroll = () => {
    if (rowRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
      const absScroll = Math.abs(scrollLeft);
      // Can scroll back toward the start -> left arrow
      setShowLeftArrow(absScroll > 10);
      // Can scroll forward toward the end -> right arrow
      setShowRightArrow(absScroll + clientWidth < scrollWidth - 10);
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
      const scrollAmount = clientWidth * 0.75;
      rowRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
      setTimeout(checkScroll, 350);
    }
  };

  if (!items.length) {
    // Skeletons
    return (
      <div className={`noir-catalog-row mb-10 flex flex-col gap-4 ${flush ? "" : "px-4 sm:px-6 lg:px-8 xl:px-10"}`}>
        <div className="space-y-1">
          <div className="w-48 h-6 bg-white/[0.07] rounded animate-pulse" />
          <div className="w-32 h-4 bg-white/[0.05] rounded animate-pulse" />
        </div>
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex-none w-[150px] sm:w-[165px] animate-pulse">
              <div className="aspect-[2/3] w-full rounded-[8px] bg-[#121318] shimmer-bg" />
              <div className="mt-3 h-4 w-28 rounded bg-[#15161b]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="noir-catalog-row relative group/row" aria-labelledby={`row-${title.replace(/\s+/g, '-')}`}>
      {/* Category Header */}
      <div className={`noir-catalog-heading flex flex-col text-left ${flush ? "" : "px-4 sm:px-6 lg:px-8 xl:px-10"}`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex flex-col text-left">
            {viewAllHash ? (
              <a
                href={viewAllHash}
                id={`row-${title.replace(/\s+/g, '-')}`}
                className="group/title noir-catalog-title flex cursor-pointer items-center gap-1.5 text-white"
              >
                <span>{title}</span>
                <ChevronRight className="w-5 h-5 text-white/40 group-hover/title:text-white group-hover/title:translate-x-0.5 transition-all" />
              </a>
            ) : (
              <>
                <h2 id={`row-${title.replace(/\s+/g, '-')}`} className="noir-catalog-title flex items-center text-white">
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
        {showLeftArrow && (
          <div className="hidden md:block absolute left-0 top-0 bottom-3 w-24 z-30 pointer-events-none bg-gradient-to-r from-[#08090c] to-transparent" />
        )}
        {showRightArrow && (
          <div className="hidden md:block absolute right-0 top-0 bottom-3 w-24 z-30 pointer-events-none bg-gradient-to-l from-[#08090c] to-transparent" />
        )}
        {/* Navigation Arrows for desktop hover */}
        {showLeftArrow && (
          <button
            onClick={() => handleScroll('left')}
            className="absolute left-8 top-[41%] z-45 w-9 h-9 rounded-full bg-black/35 hover:bg-black/55 backdrop-blur-md text-white/90 hover:text-white items-center justify-center cursor-pointer pointer-events-auto transition-all opacity-0 group-hover/row:opacity-100 hidden md:flex"
            aria-label="Previous titles"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {showRightArrow && (
          <button
            onClick={() => handleScroll('right')}
            className="absolute right-8 top-[41%] z-45 w-9 h-9 rounded-full bg-black/35 hover:bg-black/55 backdrop-blur-md text-white/90 hover:text-white items-center justify-center cursor-pointer pointer-events-auto transition-all opacity-0 group-hover/row:opacity-100 hidden md:flex"
            aria-label="Next titles"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* Dynamic Carousel Area */}
        <div
          ref={rowRef}
          onScroll={handleRowScroll}
          data-tv-focus-row
          dir="ltr"
          className="noir-movie-row-track flex flex-row overflow-x-auto no-scrollbar select-none"
        >
          {items.map((item, idx) => {
            const saved = isSaved?.(item) ?? false;
            const progressKey = `noir_progress_${item.type}_${item.id}`;
            const storedProgress = localStorage.getItem(progressKey);
            const progress = storedProgress ? Number(storedProgress) : 0;
            const isPortrait = ranked ? idx > 0 : portrait;

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
                aria-label={`Open ${item.title}`}
                style={{ animationDelay: `${idx * 45}ms` }}
                className={`noir-catalog-card group/card card-pop relative flex-none cursor-pointer select-none ${portrait && !ranked ? 'noir-portrait-card' : ''} ${ranked ? (idx === 0 ? 'noir-top10-featured' : 'noir-top10-poster') : ''}`}
              >
                <div data-tv-card-artwork className={`noir-catalog-artwork relative overflow-hidden bg-[#0d0f14] ${isPortrait ? 'aspect-[2/3]' : 'aspect-video'}`}>
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
                      className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full glass flex items-center justify-center text-white/80 hover:text-white opacity-100 md:opacity-0 md:group-hover/card:opacity-100 transition-all hover:bg-white/20 cursor-pointer"
                      title="Remove from Watchlist"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {(isPortrait ? item.poster : item.backdrop) || item.poster || item.backdrop ? (
                    <img
                      src={(isPortrait ? item.poster : item.backdrop) || item.poster || item.backdrop || undefined}
                      alt={item.title}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="h-full w-full select-none object-cover transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-3 text-stone-600 bg-stone-950">
                      <span className="text-[10px] sm:text-xs font-semibold text-center leading-normal break-all line-clamp-2">
                        {item.title}
                      </span>
                    </div>
                  )}
                  {ranked && idx > 0 && <span className="noir-rank-number"><small>TOP</small>{idx + 1}</span>}
                  {ranked && idx === 0 && (
                    <div className="noir-top10-featured-copy">
                      <span className="noir-top10-badge">TOP 1</span>
                      <h3 className="noir-top10-title-lockup">
                        <TitleLogo
                          type={item.type}
                          id={item.id}
                          title={item.title}
                          className="noir-top10-title-logo"
                          fallbackClassName="noir-top10-title-text"
                        />
                      </h3>
                      <p>{item.overview}</p>
                      <button type="button" onClick={(event) => { event.stopPropagation(); onItemClick(item); }}><Play /> Watch now</button>
                    </div>
                  )}
                  {/* Watch progression indicator */}
                  {progress > 0 && (
                    <div className="absolute bottom-0 left-3 right-3 h-0.5 overflow-hidden rounded-full bg-white/20">
                      <div
                        className="h-full bg-[#A0C9CB] transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className={`noir-catalog-meta text-left ${ranked && idx === 0 ? 'is-featured' : ''}`}>
                  <p className="truncate text-sm font-semibold text-white/92">{item.title}</p>
                  <p className="mt-1 text-[11px] font-medium text-white/38">
                    {item.rating > 0 && <><Star className="inline h-3 w-3 fill-current text-[var(--noir-accent)]" /> {item.rating.toFixed(1)} · </>}{item.year || '—'} · {item.type === 'movie' ? 'Movie' : 'TV Show'}
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
