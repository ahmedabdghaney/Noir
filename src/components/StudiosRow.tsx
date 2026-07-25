import { STUDIOS } from '../lib/studios';

interface StudiosRowProps {
  title?: string;
  onSelect: (key: string) => void;
}

export default function StudiosRow({ title = 'الاستوديوهات والمنصات', onSelect }: StudiosRowProps) {
  return (
    <section className="mb-10 md:mb-14">
      <div className="px-6 md:px-12 mb-4">
        <h2 className="text-xl md:text-2xl font-bold text-white">{title}</h2>
      </div>

      <div
        dir="rtl"
        className="flex gap-3 overflow-x-auto no-scrollbar px-6 md:px-12 pb-3 scroll-smooth"
      >
        {STUDIOS.map((studio) => (
          <button
            key={studio.key}
            onClick={() => onSelect(studio.key)}
            className="group flex-none w-[140px] sm:w-[170px] md:w-[190px] aspect-[16/9] rounded-[18px] border border-white/[0.09] overflow-hidden flex items-center justify-center px-5 text-center bg-white/[0.055] hover:bg-white/[0.11] hover:-translate-y-1 transition-[background-color,transform]"
            style={{
              boxShadow: `inset 0 -44px 60px -60px ${studio.color}`,
            }}
          >
            <span className="font-display text-white text-base md:text-lg font-bold">
              {studio.title}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
