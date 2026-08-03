import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, Play, Plus, Star } from 'lucide-react';
import type { ContinueWatchingItem, MovieOrShow } from '../types';
import { fetchTitleLogo } from '../lib/tmdb';

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
  onSelect: (item: MovieOrShow) => void;
  onContinue: (item: ContinueWatchingItem) => void;
  onPlay: (item: MovieOrShow) => void;
  isSaved: (item: MovieOrShow) => boolean;
  onToggleSave: (item: MovieOrShow) => void;
}

export default function TvHome({
  heroItems,
  continueWatching,
  sections,
  onSelect,
  onContinue,
  onPlay,
  isSaved,
  onToggleSave,
}: TvHomeProps) {
  const heroes = useMemo(() => heroItems.slice(0, 5), [heroItems]);
  const [activeHero, setActiveHero] = useState(() => {
    const saved = Number(sessionStorage.getItem('noir_tv_hero_index') || 0);
    return Number.isFinite(saved) && saved >= 0 ? saved : 0;
  });
  const [heroLogos, setHeroLogos] = useState<Record<string, string | null>>({});
  const [loadedHeroImages, setLoadedHeroImages] = useState<Record<string, boolean>>({});
  const hero = heroes[activeHero];
  const playButtonRef = useRef<HTMLButtonElement>(null);
  const hasAutofocusedRef = useRef(false);

  useEffect(() => {
    if (activeHero >= heroes.length) setActiveHero(0);
  }, [activeHero, heroes.length]);

  useEffect(() => {
    sessionStorage.setItem('noir_tv_hero_index', String(activeHero));
  }, [activeHero]);

  useEffect(() => {
    let cancelled = false;
    if (!heroes.length) return;
    const wanted = [
      heroes[activeHero],
      heroes[(activeHero + 1) % heroes.length],
    ].filter((item): item is MovieOrShow => Boolean(item));
    const missing = wanted.filter(
      (item) => heroLogos[`${item.type}_${item.id}`] === undefined,
    );
    if (!missing.length) return;
    void Promise.all(
      missing.map(async (item) => ({
        key: `${item.type}_${item.id}`,
        logo: await fetchTitleLogo(item.type, item.id),
      })),
    ).then((results) => {
      if (cancelled) return;
      setHeroLogos((current) => {
        const next = { ...current };
        results.forEach(({ key, logo }) => { next[key] = logo; });
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [activeHero, heroes, heroLogos]);

  useEffect(() => {
    if (!heroes.length) return;
    const nextHero = heroes[(activeHero + 1) % heroes.length];
    const nextImage = responsiveArtwork(nextHero?.backdrop || nextHero?.poster || '', 'hero');
    if (!nextImage) return;
    const image = new Image();
    image.decoding = 'async';
    image.src = nextImage;
  }, [activeHero, heroes]);

  useEffect(() => {
    if (!hero || hasAutofocusedRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      hasAutofocusedRef.current = true;
      if (
        document.activeElement instanceof HTMLElement &&
        document.activeElement.closest('[data-tv-navigation]')
      ) {
        return;
      }
      playButtonRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hero]);

  if (!hero) {
    return <div className="mx-[3.5vw] mt-5 h-[55vh] animate-pulse rounded-[2rem] bg-white/5" />;
  }

  const heroImage = responsiveArtwork(hero.backdrop || hero.poster || '', 'hero');
  const heroKey = `${hero.type}_${hero.id}`;
  const heroLogo = heroLogos[`${hero.type}_${hero.id}`];
  const heroGenres = hero.genres.slice(0, 2);
  const saved = isSaved(hero);
  return (
    <div className="noir-tv-home pb-28">
      <section className="noir-tv-hero-stage relative h-[88vh] min-h-[40rem] overflow-visible">
        <div
          key={`media-${hero.type}-${hero.id}`}
          className="noir-tv-hero-media absolute inset-x-0 top-0 bottom-[-13rem]"
        >
          {heroImage && (
            <img
              src={heroImage}
              alt=""
              onLoad={() => setLoadedHeroImages((current) => ({ ...current, [heroKey]: true }))}
              className={`absolute inset-0 h-full w-full object-cover transition-[opacity,filter,transform] duration-700 ${
                loadedHeroImages[heroKey] ? 'scale-100 opacity-100 blur-0' : 'scale-[1.015] opacity-45 blur-md'
              }`}
              referrerPolicy="no-referrer"
            />
          )}
          <div className="absolute inset-0 bg-black/[0.08]" />
          <div className="noir-tv-hero-side-scrim absolute inset-0" />
          <div className="noir-tv-hero-bottom-scrim absolute inset-0" />
        </div>

        <div className="noir-tv-hero-copy absolute bottom-[13.5rem] right-[5vw] z-10 flex w-[min(33rem,36vw)] flex-col items-start text-right" dir="rtl">
          <div key={`content-${hero.type}-${hero.id}`} className="noir-tv-hero-content flex w-full flex-col items-start">
            {heroLogo ? (
              <img
                src={heroLogo}
                alt={hero.title}
                className="noir-tv-hero-logo mb-4 max-h-[5.75rem] w-auto max-w-[20rem] object-contain object-right drop-shadow-2xl"
                referrerPolicy="no-referrer"
              />
            ) : (
              <h1 className="noir-tv-hero-title mb-4 font-display text-[clamp(2.15rem,3vw,3.6rem)] font-bold leading-[1.04] text-white drop-shadow-2xl">
                {hero.title}
              </h1>
            )}

            <div className="flex flex-wrap items-center gap-2.5 text-[1rem] font-semibold text-white/78">
              <span>{hero.type === 'movie' ? 'فيلم' : 'مسلسل'}</span>
              {heroGenres.map((genre) => <span key={genre}>• {genre}</span>)}
              {hero.year && <span>• {hero.year}</span>}
              {hero.rating > 0 && (
                <span className="flex items-center gap-1 text-white">
                  <Star className="h-4 w-4 fill-current" />
                  {hero.rating.toFixed(1)}
                </span>
              )}
            </div>
            {hero.overview && (
              <p className="noir-tv-hero-description mt-3 max-w-[32rem] text-[clamp(.88rem,.94vw,1rem)] leading-[1.7] text-white/68 line-clamp-2">
                {hero.overview}
              </p>
            )}
          </div>

          <div data-tv-focus-row data-tv-top-actions className="noir-tv-hero-actions mt-6 flex items-center gap-4" dir="rtl">
            <button
              ref={playButtonRef}
              type="button"
              data-tv-autofocus
              data-tv-primary-action
              data-tv-focus-key={`home:hero:play:${hero.type}_${hero.id}`}
              onClick={() => onPlay(hero)}
              className="noir-tv-hero-play flex h-14 items-center gap-3 rounded-full bg-white px-8 text-lg font-bold text-black"
              aria-label={`تشغيل ${hero.title}`}
            >
              <Play className="h-6 w-6 fill-current" />
              <span>تشغيل</span>
            </button>
            <button
              type="button"
              data-tv-save
              data-tv-focus-key={`home:hero:save:${hero.type}_${hero.id}`}
              onClick={() => onToggleSave(hero)}
              className="noir-tv-hero-circle flex h-14 w-14 items-center justify-center rounded-full border border-white/18 bg-black/45 text-white backdrop-blur-xl"
              aria-label={saved ? `إزالة ${hero.title} من قائمتي` : `إضافة ${hero.title} إلى قائمتي`}
            >
              {saved ? <Check className="h-7 w-7" /> : <Plus className="h-7 w-7" />}
            </button>
            {heroes.length > 1 && (
              <button
                type="button"
                data-tv-secondary-action
                data-tv-focus-key="home:hero:next"
                onClick={() => setActiveHero((current) => (current - 1 + heroes.length) % heroes.length)}
                className="noir-tv-hero-circle flex h-14 w-14 items-center justify-center rounded-full border border-white/18 bg-black/45 text-white backdrop-blur-xl"
                aria-label="العنوان التالي"
              >
                <ChevronRight className="h-8 w-8" strokeWidth={2.3} />
              </button>
            )}
          </div>
        </div>

        {heroes.length > 1 && (
          <div className="noir-tv-hero-pagination absolute bottom-[10.5rem] left-1/2 z-10 flex -translate-x-1/2 items-center gap-2" dir="ltr">
            <div className="flex gap-2">
              {heroes.map((item, index) => (
                <span key={`${item.type}_${item.id}`} className={`h-1.5 rounded-full transition-all duration-300 ${index === activeHero ? 'w-8 bg-white' : 'w-1.5 bg-white/35'}`} />
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="noir-tv-home-rows relative z-20 -mt-[7rem]">
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
              portrait={section.key === 'upcoming' || section.key === 'top-ten'}
              ranked={section.key === 'top-ten'}
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
  ranked = false,
}: {
  title: string;
  subtitle?: string;
  items: MovieOrShow[];
  onSelect: (item: MovieOrShow) => void;
  progress?: boolean;
  portrait?: boolean;
  ranked?: boolean;
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
      <div className="noir-tv-row-heading mb-0 flex items-end justify-between px-[5vw]">
        <div>
          <h2 className="text-[clamp(1.25rem,1.45vw,1.65rem)] font-bold tracking-[-0.02em] text-white">{title}</h2>
          {subtitle && <p className="mt-1.5 text-sm text-white/42">{subtitle}</p>}
        </div>
      </div>
      <div
        ref={rowRef}
        data-tv-focus-row
        className={`noir-tv-card-track flex overflow-x-auto px-[5vw] no-scrollbar scroll-smooth ${progress ? 'noir-tv-continue-track' : ''}`}
        dir="rtl"
      >
        {visibleItems.map((item, index) => {
          const continueItem = item as ContinueWatchingItem;
          const rawImage = portrait
            ? (item.poster || item.backdrop || '')
            : (item.backdrop || item.poster || '');
          const image = responsiveArtwork(
            rawImage,
            portrait || !item.backdrop ? 'poster' : 'landscape',
          );
          return (
            <button
              key={`${item.type}_${item.id}`}
              type="button"
              data-tv-card
              data-tv-card-artwork
              data-tv-focus-key={`home:${title}:${item.type}_${item.id}`}
              onClick={() => onSelect(item)}
              className={`group relative shrink-0 overflow-hidden bg-[#151518] text-right ${
                portrait
                  ? 'noir-tv-portrait-card aspect-[2/3] w-[clamp(11rem,12vw,14rem)] rounded-[1.1rem]'
                  : progress
                    ? 'noir-tv-continue-card aspect-video w-[clamp(18rem,19vw,22.5rem)] rounded-[1.15rem]'
                    : 'noir-tv-landscape-card aspect-video w-[clamp(17rem,18vw,21.5rem)] rounded-[1.15rem]'
              }`}
              aria-label={`فتح ${item.title}`}
            >
              {image && <img src={image} alt="" loading={index < 5 ? 'eager' : 'lazy'} className="absolute inset-0 h-full w-full object-cover" referrerPolicy="no-referrer" />}
              <div className={`absolute inset-0 ${progress ? 'bg-gradient-to-t from-black/95 via-black/20 to-transparent' : 'bg-gradient-to-t from-black/88 via-black/5 to-transparent'}`} />
              {ranked && (
                <span className="absolute left-3 top-3 z-10 text-[clamp(3.8rem,5vw,6.2rem)] font-black leading-none tracking-[-0.08em] text-white drop-shadow-[0_3px_18px_rgba(0,0,0,.8)]">
                  {index + 1}
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 z-10 p-4" dir="rtl">
                <h3 className={`${progress ? 'noir-tv-continue-title text-[clamp(.82rem,.82vw,.95rem)]' : 'text-lg'} truncate font-bold text-white`}>{item.title}</h3>
                {progress ? (
                  <>
                    <div className="mt-2 flex items-center justify-between gap-3 text-[.9rem] font-semibold text-white">
                      <span className="flex items-center gap-2">
                        <Play className="h-4 w-4 fill-current" />
                        {continueItem.type === 'tv' && continueItem.episode > 0
                          ? `الحلقة ${continueItem.episode}`
                          : formatElapsed(continueItem.positionSeconds)}
                      </span>
                      <span>{formatRemaining(continueItem.durationSeconds, continueItem.positionSeconds)}</span>
                    </div>
                    <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/28">
                      <div className="h-full rounded-full bg-white" style={{ width: `${Math.max(3, Math.min(100, Number(continueItem.progress || 0)))}%` }} />
                    </div>
                  </>
                ) : (
                  <div className="mt-1 flex items-center gap-2 text-sm text-white/70">
                    <span>{item.type === 'movie' ? 'فيلم' : 'مسلسل'}</span>
                    {item.year && <><span>•</span><span>{item.year}</span></>}
                    {item.rating > 0 && <><span>•</span><span>{item.rating.toFixed(1)}</span></>}
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

function formatElapsed(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  return hours > 0 ? `${hours} س ${minutes} د` : `${minutes} د`;
}

function formatRemaining(durationSeconds: number, positionSeconds: number): string {
  const remaining = Math.max(0, (Number(durationSeconds) || 0) - (Number(positionSeconds) || 0));
  if (!remaining) return 'متبقي قليل';
  return `باقي ${formatElapsed(remaining)}`;
}

function responsiveArtwork(url: string, kind: 'hero' | 'poster' | 'landscape'): string {
  if (!url.includes('image.tmdb.org')) return url;
  const displayWidth = Math.max(window.innerWidth, window.screen?.width || 0);
  if (kind === 'hero') {
    return url.replace(/\/t\/p\/(?:w\d+|original)\//, '/t/p/original/');
  }
  if (kind === 'landscape') {
    return url.replace(/\/t\/p\/w\d+\//, '/t/p/w1280/');
  }
  if (displayWidth >= 2400) {
    return url.replace(/\/t\/p\/w\d+\//, '/t/p/original/');
  }
  return url.replace(/\/t\/p\/w\d+\//, '/t/p/w780/');
}
