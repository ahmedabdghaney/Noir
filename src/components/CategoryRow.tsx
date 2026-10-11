/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CATEGORIES } from '../lib/categories';

interface CategoryRowProps {
  title?: string;
  subtitle?: string;
  onSelect: (key: string) => void;
}

export default function CategoryRow({ title = 'Popular Genres', subtitle = 'Find something by mood', onSelect }: CategoryRowProps) {
  return (
    <section className="noir-catalog-row noir-genre-row relative" aria-labelledby="category-row-title">
      <div className="noir-catalog-heading">
        <h2 id="category-row-title" className="noir-catalog-title text-white">
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-xs text-white/38 sm:text-[13px]">{subtitle}</p>}
      </div>

      <div
        dir="ltr"
        className="noir-genre-chips flex flex-wrap gap-2.5"
      >
        {CATEGORIES.map((category) => (
          <button
            key={category.key}
            type="button"
            onClick={() => onSelect(category.key)}
            className="noir-genre-chip"
            aria-label={`Open ${category.title} genre`}
          >
            {category.title}
          </button>
        ))}
      </div>
    </section>
  );
}
