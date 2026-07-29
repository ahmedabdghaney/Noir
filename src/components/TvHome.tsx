import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import type { ContinueWatchingItem, MovieOrShow } from '../types';

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
  onDetails: (item: MovieOrShow) => void;
  onSelect: (item: MovieOrShow) => void;
  onContinue: (item: ContinueWatchingItem) => void;
}

export default function TvHome({
  heroItems,
  continueWatching,
  sections,
  onDetails,
  onSelect,
  onContinue,
}: TvHomeProps) {
  const heroes = heroItems.slice(0, 5);
  const [activeHero, setActiveHero] = useState(0);
  const hero = heroes[activeHero];
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (activeHero >= heroes.length) setActiveHero(0);
  }, [activeHero, heroes.length]);

  useEffect(() => {
    if (!hero) return;
    const frame = window.requestAnimationFrame(() => {
      if (
        document.activeElement instanceof HTMLElement &&
        document.activeElement.closest('[data-tv-navigation]')
      ) {
        return;
      }
      heroRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeHero, hero?.id, hero?.type]);

  if (!hero) {
    return <div className="mx-[3.5vw] mt-5 h-[55vh] animate-pulse rounded-[2rem] bg-white/5" />;
  }

  const heroImage = hero.backdrop || hero.poster || '';
  return (
    <div className="noir-tv-home pb-24 pt-5">
      <section
        ref={heroRef}
        tabIndex={0}
        data-tv-hero
        data-tv-autofocus
        className="relative mx-[2vw] h-[59vh] min-h-[31rem] max-h-[44rem] overflow-hidden rounded-[2rem] bg-black"
        aria-label={`${hero.title}، استخدم السهمين للتبديل واضغط موافق لفتح التفاصيل`}
        role="button"
        onClick={() => onDetails(hero)}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            event.stopPropagation();
            setActiveHero((current) => (current + 1) % heroes.length);
          } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            event.stopPropagation();
            setActiveHero((current) => (current - 1 + heroes.length) % heroes.length);
          } else if (
            (event.key === 'Enter' || event.key === ' ') &&
            event.target === event.currentTarget
          ) {
            event.preventDefault();
            onDetails(hero);
          }
        }}
      >
        <div
          key={`media-${hero.type}-${hero.id}`}
          className="noir-tv-hero-media absolute inset-0"
        >
          {heroImage && <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" referrerPolicy="no-referrer" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-black/10" />
          <div className="absolute inset-0 bg-gradient-to-l from-black/90 via-black/25 to-transparent" />
          <div className="noir-tv-hero-focus-gradient pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-black via-black/55 to-transparent" />
        </div>

        <div
          key={`content-${hero.type}-${hero.id}`}
          className="noir-tv-hero-content absolute inset-y-0 right-[4vw] flex max-w-[42rem] flex-col justify-end pb-[4.5rem] text-right"
          dir="rtl"
        >
          <div className="mb-3 flex items-center gap-3 text-sm font-semibold text-white/70">
            <span>{hero.type === 'movie' ? 'فيلم مميز' : 'مسلسل مميز'}</span>
            {hero.year && <><span className="h-1 w-1 rounded-full bg-white/40" /><span>{hero.year}</span></>}
            {hero.rating > 0 && <span className="flex items-center gap-1.5 text-yellow-400"><Star className="h-4 w-4 fill-current" />{hero.rating.toFixed(1)}</span>}
          </div>
          <h1 className="font-display text-[clamp(2.8rem,4.2vw,5rem)] font-bold leading-[1.05] text-white drop-shadow-2xl">{hero.title}</h1>
          {hero.overview && <p className="mt-4 max-w-[40rem] text-[clamp(.95rem,1.15vw,1.2rem)] leading-7 text-white/68 line-clamp-2">{hero.overview}</p>}
        </div>

        {heroes.length > 1 && (
          <>
            <span aria-hidden="true" className="pointer-events-none absolute right-6 top-1/2 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white/85 backdrop-blur-xl">
              <ChevronRight className="h-8 w-8" strokeWidth={2.3} />
            </span>
            <span aria-hidden="true" className="pointer-events-none absolute left-6 top-1/2 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white/85 backdrop-blur-xl">
              <ChevronLeft className="h-8 w-8" strokeWidth={2.3} />
            </span>
            <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2" dir="ltr">
              <div className="flex gap-2">
                {heroes.map((item, index) => (
                  <span key={`${item.type}_${item.id}`} className={`h-1.5 rounded-full ${index === activeHero ? 'w-8 bg-white' : 'w-1.5 bg-white/35'}`} />
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      <div className="relative z-10 mt-6 space-y-5">
        {continueWatching.length > 0 && (
          <TvRow
            title="أكمل المشاهدة"
            items={continueWatching}
            onSelect={(item) => onContinue(item as ContinueWatchingItem)}
            progress
          />
        )}

        {sections.filter((section) => section.items.length > 0).slice(0, 9).map((section) => (
          <div key={section.key}>
            <TvRow
              title={section.title}
              subtitle={section.subtitle}
              items={section.items}
              onSelect={onSelect}
              portrait={section.key === 'upcoming'}
            />
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
  portrait = false,
}: {
  title: string;
  subtitle?: string;
  items: MovieOrShow[];
  onSelect: (item: MovieOrShow) => void;
  progress?: boolean;
  portrait?: boolean;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const visibleItems = useMemo(() => items.slice(0, 20), [items]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px 12% 0px', threshold: 0.08 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className={`noir-tv-row noir-tv-row-reveal ${isVisible ? 'is-visible' : ''}`}
      aria-label={title}
    >
      <div className="mb-4 flex items-end justify-between px-[3.5vw]">
        <div>
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-white/45">{subtitle}</p>}
        </div>
      </div>
      <div
        ref={rowRef}
        data-tv-focus-row
        className="noir-tv-card-track flex gap-4 overflow-x-auto px-[3.5vw] py-3 pb-6 no-scrollbar scroll-smooth"
        dir="rtl"
      >
        {visibleItems.map((item, index) => {
          const continueItem = item as ContinueWatchingItem;
          const image = portrait
            ? (item.poster || item.backdrop)
            : (item.backdrop || item.poster);
          return (
            <button
              key={`${item.type}_${item.id}`}
              type="button"
              data-tv-card
              data-tv-card-artwork
              onClick={() => onSelect(item)}
              className={`group relative shrink-0 overflow-hidden rounded-2xl bg-[#19191d] text-right ${
                portrait
                  ? 'aspect-[2/3] w-[clamp(12rem,14vw,16rem)]'
                  : 'aspect-video w-[clamp(17rem,20vw,24rem)]'
              }`}
              aria-label={`فتح ${item.title}`}
            >
              {image && <img src={image} alt="" loading={index < 5 ? 'eager' : 'lazy'} className="absolute inset-0 h-full w-full object-cover" referrerPolicy="no-referrer" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/5 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 z-10 p-4" dir="rtl">
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
