/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { STUDIOS } from '../lib/studios';

interface StudiosRowProps {
  title?: string;
  onSelect: (key: string) => void;
}

const PLATFORM_LOGOS: Record<string, string> = {
  netflix: '/studios/netflix.svg',
  amazon: '/studios/prime-video.svg',
  hbo: '/studios/hbo.svg',
  apple: '/studios/apple-tv.svg',
  paramount: '/studios/paramount.svg',
  hulu: '/studios/hulu.svg',
};

const PLATFORM_ORDER = ['netflix', 'amazon', 'hbo', 'apple', 'paramount', 'hulu'];

export default function StudiosRow({ title = 'حسب منصة العرض', onSelect }: StudiosRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const platforms = PLATFORM_ORDER
    .map((key) => STUDIOS.find((studio) => studio.key === key))
    .filter((studio): studio is NonNullable<typeof studio> => Boolean(studio));

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
  }, []);

  const handleScroll = (direction: 'left' | 'right') => {
    if (!rowRef.current) return;
    const amount = rowRef.current.clientWidth * 0.75;
    rowRef.current.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
    window.setTimeout(checkScroll, 350);
  };

  return (
    <section className="noir-platforms-row relative flex flex-col group/row" aria-labelledby="studios-row-title">
      <div className="px-4 sm:px-6 lg:px-12 mb-2.5">
        <h2 id="studios-row-title" className="text-lg md:text-xl font-bold text-white">{title}</h2>
        <p>أشهر العناوين على منصات البث</p>
      </div>

      <div className="relative px-4 sm:px-6 lg:px-12">
        {showRightArrow && (
          <button onClick={() => handleScroll('right')} className="hidden md:flex absolute right-12 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full glass-strong items-center justify-center text-white opacity-0 group-hover/row:opacity-100 transition-all cursor-pointer" aria-label="السابق">
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
        {showLeftArrow && (
          <button onClick={() => handleScroll('left')} className="hidden md:flex absolute left-12 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full glass-strong items-center justify-center text-white opacity-0 group-hover/row:opacity-100 transition-all cursor-pointer" aria-label="التالي">
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        <div ref={rowRef} onScroll={checkScroll} dir="rtl" className="flex flex-row gap-2 overflow-x-auto overflow-y-visible no-scrollbar py-2 scroll-smooth select-none">
          {platforms.map((studio) => (
            <button key={studio.key} type="button" onClick={() => onSelect(studio.key)} aria-label={`فتح أعمال ${studio.title}`} className="noir-platform-card group/st card-cinematic flex-none cursor-pointer">
              <span className="noir-platform-card-surface">
                <span
                  className="noir-platform-logo"
                  role="img"
                  aria-label={studio.title}
                  style={{ WebkitMaskImage: `url(${PLATFORM_LOGOS[studio.key]})`, maskImage: `url(${PLATFORM_LOGOS[studio.key]})` }}
                />
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
