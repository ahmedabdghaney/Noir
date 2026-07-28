import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Info, Play, Plus, Star } from 'lucide-react';
import type { ContinueWatchingItem, MovieOrShow } from '../types';
import { CATEGORIES } from '../lib/categories';

interface TvSection {
  key: string;
  title: string;
  subtitle?: string;
  items: MovieOrShow[];
}

interface TvHomeProps {
  heroItems: MovieOrShow[];
  continueWatching: ContinueWatchingItem[];
  sections: TvSection[];
  isSaved: (item: MovieOrShow) => boolean;
  onToggleSave: (item: MovieOrShow) => void;
  onPlay: (item: MovieOrShow) => void;
  onDetails: (item: MovieOrShow) => void;
  onSelect: (item: MovieOrShow) => void;
  onContinue: (item: ContinueWatchingItem) => void;
  onCategory: (key: string) => void;
}

export default function TvHome({
  heroItems,
  continueWatching,
  sections,
  isSaved,
  onToggleSave,
  onPlay,
  onDetails,
  onSelect,
  onContinue,
  onCategory,
}: TvHomeProps) {
  const heroes = heroItems.slice(0, 5);
  const [activeHero, setActiveHero] = useState(0);
  const hero = heroes[activeHero];

  useEffect(() => {
    if (activeHero >= heroes.length) setActiveHero(0);
  }, [activeHero, heroes.length]);

  if (!hero) {
    return <div className="mx-[3.5vw] mt-5 h-[55vh] animate-pulse rounded-[2rem] bg-white/5" />;
  }

  const heroImage = hero.backdrop || hero.poster || '';
  const saved = isSaved(hero);

  return (
    <div className="noir-tv-home pb-24">
      <section className="relative min-h-[36rem] h-[62vh] max-h-[50rem] overflow-hidden bg-black" aria-label="العرض المميز">
        {heroImage && <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" referrerPolicy="no-referrer" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0d] via-black/15 to-black/35" />
        <div className="absolute inset-0 bg-gradient-to-l from-black/95 via-black/45 to-transparent" />

        <div className="absolute inset-y-0 right-[4vw] flex max-w-[44rem] flex-col justify-center pt-16 text-right" dir="rtl">
          <div className="mb-4 flex items-center gap-3 text-base font-semibold text-white/70">
            <span>{hero.type === 'movie' ? 'فيلم مميز' : 'مسلسل مميز'}</span>
            {hero.year && <><span className="h-1 w-1 rounded-full bg-white/40" /><span>{hero.year}</span></>}
            {hero.rating > 0 && <span className="flex items-center gap-1.5 text-yellow-400"><Star className="h-4 w-4 fill-current" />{hero.rating.toFixed(1)}</span>}
          </div>
          <h1 className="font-display text-[clamp(3rem,5vw,5.8rem)] font-bold leading-[1.05] text-white drop-shadow-2xl">{hero.title}</h1>
          {hero.overview && <p className="mt-5 max-w-[42rem] text-[clamp(1rem,1.35vw,1.35rem)] leading-8 text-white/70 line-clamp-3">{hero.overview}</p>}
          <div className="mt-8 flex items-center gap-3">
            <button type="button" onClick={() => onPlay(hero)} className="flex min-h-14 items-center gap-3 rounded-2xl bg-white px-7 text-lg font-bold text-black">
              <Play className="h-5 w-5 fill-current" /> المشاهدة الآن
            </button>
            <button type="button" onClick={() => onDetails(hero)} className="flex min-h-14 items-center gap-3 rounded-2xl bg-white/15 px-7 text-lg font-bold text-white backdrop-blur-xl">
              <Info className="h-5 w-5" /> التفاصيل
            </button>
            <button
              type="button"
              onClick={() => onToggleSave(hero)}
              className={`flex h-14 w-14 items-center justify-center rounded-2xl ${saved ? 'bg-white text-black' : 'bg-white/15 text-white backdrop-blur-xl'}`}
              aria-label={saved ? 'إزالة من قائمتي' : 'إضافة إلى قائمتي'}
            >
              {saved ? <Check className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {heroes.length > 1 && (
          <div className="absolute bottom-10 left-[4vw] flex items-center gap-3" dir="ltr">
            <button type="button" onClick={() => setActiveHero((activeHero - 1 + heroes.length) % heroes.length)} className="flex h-12 w-12 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-xl" aria-label="السابق"><ChevronLeft /></button>
            <div className="flex gap-2">
              {heroes.map((item, index) => (
                <button key={`${item.type}_${item.id}`} type="button" onClick={() => setActiveHero(index)} className={`h-2 rounded-full ${index === activeHero ? 'w-10 bg-white' : 'w-2 bg-white/35'}`} aria-label={`العرض ${index + 1}`} />
              ))}
            </div>
            <button type="button" onClick={() => setActiveHero((activeHero + 1) % heroes.length)} className="flex h-12 w-12 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-xl" aria-label="التالي"><ChevronRight /></button>
          </div>
        )}
      </section>

      <div className="relative z-10 -mt-4 space-y-10">
        {continueWatching.length > 0 && (
          <TvRow
            title="أكمل المشاهدة"
            items={continueWatching}
            onSelect={(item) => onContinue(item as ContinueWatchingItem)}
            progress
          />
        )}

        <section className="px-[3.5vw]" aria-labelledby="tv-categories-title">
          <h2 id="tv-categories-title" className="mb-4 text-2xl font-bold text-white">تصفّح حسب النوع</h2>
          <div className="flex gap-3 overflow-x-auto pb-3 no-scrollbar" dir="rtl">
            {CATEGORIES.slice(0, 10).map((category) => (
              <button
                key={category.key}
                type="button"
                onClick={() => onCategory(category.key)}
                className="min-h-16 min-w-[11rem] rounded-2xl border border-white/10 px-6 text-lg font-bold text-white"
                style={{ background: category.overlay }}
              >
                {category.title}
              </button>
            ))}
          </div>
        </section>

        {sections.filter((section) => section.items.length > 0).slice(0, 9).map((section) => (
          <div key={section.key}>
            <TvRow title={section.title} subtitle={section.subtitle} items={section.items} onSelect={onSelect} />
          </div>
        ))}
      </div>
    </div>
  );
}

function TvRow({
  title,
  subtitle,
  items,
  onSelect,
  progress = false,
}: {
  title: string;
  subtitle?: string;
  items: MovieOrShow[];
  onSelect: (item: MovieOrShow) => void;
  progress?: boolean;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const visibleItems = useMemo(() => items.slice(0, 20), [items]);

  return (
    <section className="noir-tv-row" aria-label={title}>
      <div className="mb-4 flex items-end justify-between px-[3.5vw]">
        <div>
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-white/45">{subtitle}</p>}
        </div>
      </div>
      <div ref={rowRef} className="flex gap-4 overflow-x-auto px-[3.5vw] pb-6 no-scrollbar scroll-smooth" dir="rtl">
        {visibleItems.map((item, index) => {
          const continueItem = item as ContinueWatchingItem;
          const image = item.backdrop || item.poster;
          return (
            <button
              key={`${item.type}_${item.id}`}
              type="button"
              onClick={() => onSelect(item)}
              className="group relative aspect-video w-[clamp(17rem,20vw,24rem)] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#19191d] text-right"
              aria-label={`فتح ${item.title}`}
            >
              {image && <img src={image} alt="" loading={index < 5 ? 'eager' : 'lazy'} className="absolute inset-0 h-full w-full object-cover" referrerPolicy="no-referrer" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/5 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4" dir="rtl">
                <h3 className="truncate text-lg font-bold text-white">{item.title}</h3>
                <div className="mt-1 flex items-center gap-2 text-sm text-white/55">
                  <span>{item.type === 'movie' ? 'فيلم' : 'مسلسل'}</span>
                  {item.year && <><span>•</span><span>{item.year}</span></>}
                  {item.rating > 0 && <><span>•</span><span className="text-yellow-400">{item.rating.toFixed(1)}</span></>}
                </div>
                {progress && (
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/20">
                    <div className="h-full rounded-full bg-red-500" style={{ width: `${Math.max(3, Math.min(100, Number(continueItem.progress || 0)))}%` }} />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
