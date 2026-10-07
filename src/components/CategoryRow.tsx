/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ArrowUpLeft } from 'lucide-react';
import { CATEGORIES } from '../lib/categories';

interface CategoryRowProps {
  title?: string;
  onSelect: (key: string) => void;
}

export default function CategoryRow({ title = 'التصنيفات', onSelect }: CategoryRowProps) {
  return (
    <section className="relative mb-9 md:mb-12" aria-labelledby="category-row-title">
      <div className="mb-3.5 px-4 sm:px-6 lg:px-8 xl:px-10">
        <h2 id="category-row-title" className="text-lg font-bold tracking-[-0.02em] text-white md:text-xl">
          {title}
        </h2>
      </div>

      <div
        dir="rtl"
        className="no-scrollbar flex touch-pan-y gap-2.5 overflow-x-auto px-4 pb-2 sm:px-6 lg:px-8 xl:px-10"
      >
        {CATEGORIES.map((category) => (
          <button
            key={category.key}
            type="button"
            onClick={() => onSelect(category.key)}
            className="group flex h-[74px] w-[148px] flex-none items-center justify-between overflow-hidden rounded-[16px] border border-white/[0.07] bg-[#111217] px-4 text-right transition-all hover:-translate-y-0.5 hover:border-white/[0.13] hover:bg-[#16171d] sm:w-[164px]"
            aria-label={`فتح تصنيف ${category.title}`}
          >
            <span className="flex items-center gap-2.5">
              <span
                className="h-2 w-2 rounded-full shadow-[0_0_18px_currentColor]"
                style={{ color: category.overlay, backgroundColor: category.overlay.replace(/0\.\d+\)$/, '1)') }}
              />
              <span className="text-sm font-semibold text-white/88">{category.title}</span>
            </span>
            <ArrowUpLeft className="h-4 w-4 text-white/22 transition-colors group-hover:text-white/60" />
          </button>
        ))}
      </div>
    </section>
  );
}
