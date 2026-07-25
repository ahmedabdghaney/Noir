import { CATEGORIES } from '../lib/categories';

interface CategoryRowProps {
  title?: string;
  onSelect: (key: string) => void;
}

export default function CategoryRow({ title = 'التصنيفات', onSelect }: CategoryRowProps) {
  return (
    <section className="mb-10 md:mb-12">
      <div className="px-6 md:px-12 mb-4">
        <span className="noir-eyebrow block mb-1">استكشف حسب مزاجك</span>
        <h2 className="text-xl md:text-2xl font-bold text-white">{title}</h2>
      </div>

      <div
        dir="rtl"
        className="flex gap-3 overflow-x-auto no-scrollbar px-6 md:px-12 pb-3 scroll-smooth"
      >
        {CATEGORIES.map((category) => (
          <button
            key={category.key}
            onClick={() => onSelect(category.key)}
            className="group relative flex-none w-[150px] sm:w-[180px] md:w-[210px] aspect-[16/10] rounded-[18px] overflow-hidden border border-white/[0.09] text-right transition-transform duration-300 hover:-translate-y-1"
            style={{
              background: `linear-gradient(145deg, ${category.overlay.replace(/0\.\d+\)/, '0.92)')}, #1c1c1f`,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
            <span className="absolute inset-x-0 bottom-0 p-4 text-white text-lg md:text-xl font-bold">
              {category.title}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
