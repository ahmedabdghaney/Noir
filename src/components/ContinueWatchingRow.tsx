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
    <section className="mb-8 md:mb-10 relative flex flex-col group/row" aria-labelledby="continue-watching-title">
      <div className="px-4 sm:px-6 lg:px-8 mb-3 md:mb-4">
        <h2 id="continue-watching-title" className="text-xl md:text-2xl font-bold text-white">{title}</h2>
      </div>

      <div className="relative px-4 sm:px-6 lg:px-8">
        {showRightArrow && (
          <button
            onClick={() => handleScroll('right')}
            className="hidden md:flex absolute right-12 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/35 hover:bg-black/55 backdrop-blur-md text-white/90 hover:text-white items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all cursor-pointer"
            aria-label="السابق"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
        {showLeftArrow && (
          <button
            onClick={() => handleScroll('left')}
            className="hidden md:flex absolute left-12 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/35 hover:bg-black/55 backdrop-blur-md text-white/90 hover:text-white items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all cursor-pointer"
            aria-label="التالي"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        <div
          ref={rowRef}
          onScroll={handleRowScroll}
          className="flex flex-row gap-2.5 md:gap-3 overflow-x-auto no-scrollbar pb-3 scroll-smooth select-none"
        >
          {items.map((item) => {
            const progress = Math.max(0, Math.min(100, Number(item.progress || 0)));
            const img = item.backdrop || item.poster;

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
                aria-label={`متابعة مشاهدة ${item.title}`}
                className="group/cw flex-none w-[240px] sm:w-[300px] md:w-[330px] cursor-pointer"
              >
                <div className="relative aspect-video rounded-2xl overflow-hidden bg-stone-900 border border-white/[0.08]">
                  {img ? (
                    <img
                      src={img}
                      alt={item.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-700">
                      <Play className="w-8 h-8" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                  {onToggleSave && (
                    <WatchlistButton
                      saved={isSaved?.(item) ?? false}
                      onToggle={() => onToggleSave(item)}
                      compact={compactSaveButton}
                      className="absolute top-2.5 right-2.5 z-20"
                    />
                  )}

                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cw:opacity-100 transition-opacity">
                    <div className="w-14 h-14 rounded-full glass-strong flex items-center justify-center">
                      <Play className="w-6 h-6 fill-white text-white" />
                    </div>
                  </div>

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
                          title="المشاهدة من البداية"
                          aria-label={`مشاهدة ${item.title} من البداية`}
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
                          title="إزالة من المتابعة"
                          aria-label={`إزالة ${item.title} من أكمل المشاهدة`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="absolute inset-x-0 bottom-0 p-3.5">
                    <h3 className="text-white font-semibold text-base leading-tight line-clamp-1 mb-2">{item.title || (item as any).name || 'بدون عنوان'}</h3>
                    {item.type === 'tv' && item.season > 0 && item.episode > 0 && (
                      <p className="text-white/65 text-xs font-medium mb-2">
                        الموسم {item.season} • الحلقة {item.episode}
                      </p>
                    )}
                    {item.durationSeconds > item.positionSeconds && (
                      <p className="text-white/55 text-[11px] font-medium mb-2">
                        متبقي {Math.max(1, Math.ceil((item.durationSeconds - item.positionSeconds) / 60))} دقيقة
                      </p>
                    )}
                    <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full"
                        style={{ width: `${Math.max(progress, 3)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
