/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef, useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { STUDIOS } from '../lib/studios';
import { fetchStudioLogo } from '../lib/tmdb';

interface StudiosRowProps {
  title?: string;
  onSelect: (key: string) => void;
}

export default function StudiosRow({ title = 'تصفّح حسب الشركة المنتجة', onSelect }: StudiosRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  // شعار رسمي شفاف لكل شركة من TMDB
  const [logos, setLogos] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        STUDIOS.map(async (s) => {
          const logo = await fetchStudioLogo({ companyId: s.companyId, networkId: s.networkId });
          return [s.key, logo || ''] as [string, string];
        })
      );
      if (!cancelled) {
        const map: Record<string, string> = {};
        entries.forEach(([k, v]) => { if (v) map[k] = v; });
        setLogos(map);
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
  }, [logos]);

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
          className="flex flex-row gap-3 md:gap-4 overflow-x-auto no-scrollbar pb-3 scroll-smooth select-none"
        >
          {STUDIOS.map((s) => (
            <div
              key={s.key}
              onClick={() => onSelect(s.key)}
              className="group/st flex-none w-[150px] sm:w-[190px] md:w-[220px] cursor-pointer"
            >
              <div
                className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-stone-900 transition-transform duration-300 group-hover/st:scale-[1.03]"
              >
                {logos[s.key] ? (
                  <img
                    src={logos[s.key]}
                    alt={s.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain p-6"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
