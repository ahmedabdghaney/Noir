/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef, useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { CATEGORIES } from '../lib/categories';

interface CategoryRowProps {
  title?: string;
  onSelect: (key: string) => void;
}

export default function CategoryRow({ title = 'تصفّح حسب التصنيف', onSelect }: CategoryRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const checkScroll = () => {
    if (!rowRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
    const abs = Math.abs(scrollLeft);
    setShowRight(abs > 10);
    setShowLeft(abs + clientWidth < scrollWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  const scroll = (dir: 'left' | 'right') => {
    if (!rowRef.current) return;
    const amount = rowRef.current.clientWidth * 0.75;
    rowRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
    setTimeout(checkScroll, 350);
  };

  return (
    <div className="relative group/row mb-8 sm:mb-10">
      <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-3 sm:mb-4 px-1">{title}</h2>

      {/* Right arrow (prev in RTL) */}
      {showRight && (
        <button
          onClick={() => scroll('right')}
          className="hidden md:flex absolute right-0 top-1/2 mt-4 -translate-y-1/2 z-20 w-10 h-10 rounded-full glass-strong items-center justify-center text-white opacity-0 group-hover/row:opacity-100 transition-all hover:scale-105 cursor-pointer"
          aria-label="السابق"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
      {showLeft && (
        <button
          onClick={() => scroll('left')}
          className="hidden md:flex absolute left-0 top-1/2 mt-4 -translate-y-1/2 z-20 w-10 h-10 rounded-full glass-strong items-center justify-center text-white opacity-0 group-hover/row:opacity-100 transition-all hover:scale-105 cursor-pointer"
          aria-label="التالي"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      <div
        ref={rowRef}
        onScroll={checkScroll}
        className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar pb-2"
        style={{ scrollbarWidth: 'none' }}
      >
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => onSelect(cat.key)}
            className={`relative flex-none w-40 sm:w-48 md:w-56 aspect-[3/4] rounded-2xl overflow-hidden bg-gradient-to-br ${cat.gradient} shadow-lg hover:scale-[1.03] active:scale-[0.98] transition-all cursor-pointer group/cat`}
          >
            {/* subtle texture overlay */}
            <div className="absolute inset-0 bg-black/10 group-hover/cat:bg-black/0 transition-colors" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            {/* title bottom-right */}
            <div className="absolute inset-x-0 bottom-0 p-4 text-right">
              <span className="text-white font-black text-lg sm:text-xl md:text-2xl drop-shadow-lg leading-tight">{cat.title}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
