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
    <section className="noir-catalog-row noir-genre-row relative" aria-labelledby="category-row-title">
      <div className="noir-catalog-heading px-4 sm:px-6 lg:px-8 xl:px-10">
        <h2 id="category-row-title" className="noir-catalog-title text-white">
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
            className="noir-genre-card group flex h-[86px] w-[178px] flex-none items-center justify-between overflow-hidden px-4 text-right sm:w-[198px]"
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
