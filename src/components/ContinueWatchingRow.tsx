/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef } from 'react';
import { Play, X } from 'lucide-react';
import { MovieOrShow } from '../types';

interface ContinueWatchingRowProps {
  title: string;
  items: MovieOrShow[];
  onItemClick: (item: MovieOrShow) => void;
  onRemove?: (item: MovieOrShow) => void;
}

export default function ContinueWatchingRow({ title, items, onItemClick, onRemove }: ContinueWatchingRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  if (!items || items.length === 0) return null;

  return (
    <div className="mb-16 md:mb-20 relative flex flex-col">
      <div className="px-6 md:px-12 mb-4 md:mb-5">
        <h2 className="font-display text-xl md:text-2xl font-black tracking-tight text-white">{title}</h2>
      </div>

      <div className="relative px-6 md:px-12">
        <div
          ref={rowRef}
          className="flex flex-row gap-4 md:gap-5 overflow-x-auto no-scrollbar pb-3 scroll-smooth select-none snap-x snap-mandatory"
        >
          {items.map((item) => {
            const progressKey = `noir_progress_${item.type}_${item.id}`;
            const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(progressKey) : null;
            const progress = stored ? Number(stored) : 0;
            const img = item.backdrop || item.poster;

            return (
              <div
                key={`${item.type}-${item.id}`}
                onClick={() => onItemClick(item)}
                className="group/cw card-transition flex-none w-[280px] sm:w-[340px] md:w-[380px] snap-start cursor-pointer"
              >
                {/* Wide 16:9 artwork */}
                <div className="relative aspect-video rounded-2xl overflow-hidden bg-stone-900 border border-white/8 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7)]">
                  {img ? (
                    <img
                      src={img}
                      alt={item.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover/cw:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-700">
                      <Play className="w-8 h-8" />
                    </div>
                  )}

                  {/* Dark gradient at bottom */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                  {/* Hover play button */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cw:opacity-100 transition-opacity">
                    <div className="w-14 h-14 rounded-full glass-strong flex items-center justify-center">
                      <Play className="w-6 h-6 fill-white text-white" />
                    </div>
                  </div>

                  {/* Remove button */}
                  {onRemove && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(item);
                      }}
                      className="absolute top-2.5 left-2.5 w-8 h-8 rounded-full glass flex items-center justify-center text-white/80 hover:text-white opacity-0 group-hover/cw:opacity-100 transition-all hover:bg-white/20 cursor-pointer"
                      title="إزالة من المتابعة"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}

                  {/* Title overlaid bottom */}
                  <div className="absolute inset-x-0 bottom-0 p-3.5">
                    <h3 className="text-white font-bold text-sm leading-tight line-clamp-1 mb-2">{item.title || (item as any).name || 'بدون عنوان'}</h3>
                    {/* Progress bar */}
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
    </div>
  );
}
