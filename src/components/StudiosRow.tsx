/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef, useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { STUDIOS } from '../lib/studios';
import { discoverTitles } from '../lib/tmdb';

interface StudiosRowProps {
  title?: string;
  onSelect: (key: string) => void;
}

export default function StudiosRow({ title = 'تصفّح حسب الشركة المنتجة', onSelect }: StudiosRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  // خلفية تمثيلية (أشهر عمل) لكل شركة — backdrop عريض يناسب شكل البطاقة
  const [images, setImages] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        STUDIOS.map(async (s) => {
          try {
            const opts = s.companyId
              ? { withCompanies: s.companyId, sortBy: 'popularity', page: 1 }
              : { withNetworks: s.networkId, sortBy: 'popularity', page: 1 };
            const type: 'movie' | 'tv' = s.companyId ? 'movie' : 'tv';
            const res = await discoverTitles(type, opts);
            const withImg = res.results.find((r) => r.backdrop || r.poster);
            return [s.key, withImg?.backdrop || withImg?.poster || ''] as [string, string];
          } catch {
            return [s.key, ''] as [string, string];
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
    <div className="mb-16 md:mb-20 relative flex flex-col group/row">
      <div className="px-6 md:px-12 mb-4 md:mb-5">
        <h2 className="font-display text-xl md:text-2xl font-black tracking-tight text-white">{title}</h2>
      </div>

      <div className="relative px-6 md:px-12">
        {showRightArrow && (
          <button
            onClick={() => handleScroll('right')}
            className="hidden md:flex absolute right-12 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full glass-strong items-center justify-center text-white opacity-0 group-hover/row:opacity-100 transition-all hover:scale-105 cursor-pointer"
            aria-label="السابق"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
        {showLeftArrow && (
          <button
            onClick={() => handleScroll('left')}
            className="hidden md:flex absolute left-12 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full glass-strong items-center justify-center text-white opacity-0 group-hover/row:opacity-100 transition-all hover:scale-105 cursor-pointer"
            aria-label="التالي"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        <div
          ref={rowRef}
          onScroll={checkScroll}
          dir="rtl"
          className="flex flex-row gap-4 md:gap-5 overflow-x-auto no-scrollbar pb-3 scroll-smooth select-none"
        >
          {STUDIOS.map((s) => (
            <div
              key={s.key}
              onClick={() => onSelect(s.key)}
              className="group/st flex-none w-[280px] sm:w-[340px] md:w-[380px] cursor-pointer"
            >
              <div
                className="relative aspect-video rounded-2xl overflow-hidden bg-stone-900 border border-white/8 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7)]"
                style={{ backgroundColor: s.color }}
              >
                {images[s.key] && (
                  <img
                    src={images[s.key]}
                    alt={s.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover opacity-40 transition-transform duration-500 group-hover/st:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/40" />
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <span className="text-white font-black text-2xl sm:text-3xl drop-shadow-lg text-center tracking-tight">
                    {s.title}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
