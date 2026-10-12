/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef, useState, useEffect } from 'react';
import { Play, X, RotateCcw, ChevronRight, ChevronLeft } from 'lucide-react';
import { ContinueWatchingItem, MovieOrShow } from '../types';
import WatchlistButton from './WatchlistButton';

interface ContinueWatchingRowProps {
  title: string;
  items: ContinueWatchingItem[];
  onItemClick: (item: ContinueWatchingItem) => void;
  onRemove?: (item: ContinueWatchingItem) => void;
  onRestart?: (item: ContinueWatchingItem) => void;
  isSaved?: (item: MovieOrShow) => boolean;
  onToggleSave?: (item: MovieOrShow) => void;
  compactSaveButton?: boolean;
}

export default function ContinueWatchingRow({
  title,
  items,
  onItemClick,
  onRemove,
  onRestart,
  isSaved,
  onToggleSave,
  compactSaveButton = false,
}: ContinueWatchingRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const scrollSaveFrameRef = useRef<number | null>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const checkScroll = () => {
    if (rowRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
      const absScroll = Math.abs(scrollLeft);
      setShowRightArrow(absScroll > 10);
      setShowLeftArrow(absScroll + clientWidth < scrollWidth - 10);
    }
  };

  useEffect(() => {
    const saved = Number(localStorage.getItem('noir_row_scroll_continue_watching') || 0);
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
  }, [items]);

  const handleRowScroll = () => {
    checkScroll();
    if (scrollSaveFrameRef.current != null) return;
    scrollSaveFrameRef.current = window.requestAnimationFrame(() => {
      scrollSaveFrameRef.current = null;
      if (rowRef.current) {
        localStorage.setItem(
          'noir_row_scroll_continue_watching',
          String(rowRef.current.scrollLeft),
        );
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

  if (!items || items.length === 0) return null;

  return (
    <section className="noir-catalog-row noir-continue-row relative flex flex-col group/row" aria-labelledby="continue-watching-title">
      <div className="noir-catalog-heading px-4 sm:px-6 lg:px-8 xl:px-10">
        <h2 id="continue-watching-title" className="noir-catalog-title text-white">{title}</h2>
      </div>

      <div className={`noir-row-viewport relative px-4 sm:px-6 lg:px-8 xl:px-10 ${showLeftArrow ? 'has-left-shadow' : ''} ${showRightArrow ? 'has-right-shadow' : ''}`}>
        {showRightArrow && (
          <button
            onClick={() => handleScroll('right')}
            className="hidden md:flex absolute right-12 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/35 hover:bg-black/55 backdrop-blur-md text-white/90 hover:text-white items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all cursor-pointer"
            aria-label="Previous"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
        {showLeftArrow && (
          <button
            onClick={() => handleScroll('left')}
            className="hidden md:flex absolute left-12 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/35 hover:bg-black/55 backdrop-blur-md text-white/90 hover:text-white items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all cursor-pointer"
            aria-label="Next"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        <div
          ref={rowRef}
          onScroll={handleRowScroll}
          className="noir-movie-row-track flex flex-row overflow-x-auto no-scrollbar select-none"
        >
          {items.map((item) => {
            const progress = Math.max(0, Math.min(100, Number(item.progress || 0)));
            const img = item.backdrop || item.poster;
            const saved = isSaved?.(item) ?? false;

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
                aria-label={`Continue watching ${item.title}`}
                className="noir-catalog-card noir-continue-card group/cw flex-none cursor-pointer"
              >
                <div data-tv-card-artwork className="noir-catalog-artwork relative aspect-video overflow-hidden bg-[#101116]">
                  {img ? (
                    <picture className="contents">
                      <source media="(max-width: 1023px)" srcSet={item.poster || img} />
                      <img
                        src={img}
                        alt={item.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover transition-transform duration-500"
                      />
                    </picture>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-700">
                      <Play className="w-8 h-8" />
                    </div>
                  )}

                  {onToggleSave && (
                    <WatchlistButton
                      saved={saved}
                      onToggle={() => onToggleSave(item)}
                      compact={compactSaveButton}
                      className={`absolute top-2.5 right-2.5 z-20 transition-opacity ${saved ? '' : 'md:opacity-0 md:group-hover/cw:opacity-100'}`}
                    />
                  )}

                  {(onRemove || onRestart) && (
                    <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 opacity-100 md:opacity-0 md:group-hover/cw:opacity-100 transition-opacity">
                      {onRestart && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onRestart(item);
                          }}
                          className="w-8 h-8 rounded-full glass flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 cursor-pointer"
                          title="Watch from the beginning"
                          aria-label={`Watch ${item.title} from the beginning`}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onRemove && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onRemove(item);
                          }}
                          className="w-8 h-8 rounded-full glass flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 cursor-pointer"
                          title="Remove from Continue Watching"
                          aria-label={`Remove ${item.title} from Continue Watching`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="absolute inset-x-3 bottom-0">
                    <div className="h-0.5 w-full overflow-hidden rounded-full bg-white/20">
                      <div
                        className="h-full bg-[#A0C9CB] rounded-full"
                        style={{ width: `${Math.max(progress, 3)}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="noir-catalog-meta text-left">
                  <h3 className="truncate text-sm font-semibold text-white/92">{item.title || (item as any).name || 'Untitled'}</h3>
                  <p className="mt-1 text-[11px] font-medium text-white/38">
                    {item.type === 'tv' && item.season > 0 && item.episode > 0
                      ? `Season ${item.season} · Episode ${item.episode}`
                      : `${Math.max(1, Math.ceil((item.durationSeconds - item.positionSeconds) / 60))} min left`}
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
