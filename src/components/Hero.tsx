/**
 * Featured hero — calm Apple TV inspired presentation.
 */

import { useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Info, Play, Plus, Star } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { MovieOrShow } from '../types';
import { getBackdropUrl } from '../lib/tmdb';

interface HeroProps {
  trendingItems: MovieOrShow[];
  onPlayClick: (item: MovieOrShow) => void;
  onInfoClick: (item: MovieOrShow) => void;
  onTrailerClick?: (item: MovieOrShow) => void;
  isSaved?: (item: MovieOrShow) => boolean;
  onToggleSave?: (item: MovieOrShow) => void;
}

export default function Hero({
  trendingItems,
  onPlayClick,
  onInfoClick,
  isSaved,
  onToggleSave,
}: HeroProps) {
  const items = trendingItems.slice(0, 5);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      setCurrentIndex((index) => (index + 1) % items.length);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [items.length]);

  useEffect(() => {
    if (currentIndex >= items.length) setCurrentIndex(0);
  }, [currentIndex, items.length]);

  if (!items.length) {
    return (
      <div className="mb-8 sm:mb-10">
        <div className="w-full h-[72svh] min-h-[520px] max-h-[820px] bg-white/[0.04] animate-pulse" />
      </div>
    );
  }

  const activeItem = items[currentIndex];
  const saved = isSaved?.(activeItem) ?? false;
  const image =
    getBackdropUrl((activeItem as any).backdrop_path) ||
    activeItem.backdrop ||
    activeItem.poster ||
    '';

  const goTo = (direction: number) => {
    setCurrentIndex((index) => (index + direction + items.length) % items.length);
  };

  return (
    <section className="select-none px-3 pb-9 pt-[76px] sm:px-5 lg:px-8 lg:pb-12 lg:pt-[92px] xl:px-10" aria-label="العرض المميز">
      <div className="group/hero relative mx-auto max-w-[1800px] overflow-hidden rounded-[24px] border border-white/[0.075] bg-[#0b0c0f] shadow-[0_30px_90px_-48px_rgba(0,0,0,1)] sm:rounded-[30px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeItem.type}-${activeItem.id}`}
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="noir-hero-frame relative h-[64svh] min-h-[500px] max-h-[700px] sm:h-[66svh]"
          >
            <img
              src={image}
              alt=""
              referrerPolicy="no-referrer"
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover object-center"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-[#08090c] via-black/10 to-black/5" />
            <div className="absolute inset-0 bg-gradient-to-l from-black/90 via-black/38 to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_58%,transparent_0,rgba(0,0,0,.16)_44%,rgba(0,0,0,.45)_100%)]" />

            <div
              dir="rtl"
              className="absolute inset-x-0 bottom-0 max-w-3xl px-6 pb-8 text-right sm:px-10 sm:pb-10 lg:px-14 lg:pb-14"
            >
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.38, delay: 0.08 }}
              >
                <span className="mb-3 inline-flex items-center gap-2.5 text-[11px] font-semibold text-white/60 sm:text-xs">
                  <span className="inline-flex items-center gap-1.5 text-white/80">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#00BDC2] shadow-[0_0_14px_rgba(239,68,68,.9)]" />
                    اختيار نوار
                  </span>
                  {activeItem.year && <span>{activeItem.year}</span>}
                  {activeItem.rating > 0 && (
                    <span className="inline-flex items-center gap-1 text-white/72">
                      <Star className="h-3 w-3 fill-current text-amber-300" />
                      {activeItem.rating.toFixed(1)}
                    </span>
                  )}
                </span>

                <h1 className="font-display max-w-2xl text-4xl font-extrabold leading-[1.08] tracking-[-0.035em] text-white drop-shadow-2xl sm:text-5xl lg:text-[58px]">
                  {activeItem.title}
                </h1>

                {activeItem.overview && (
                  <p className="mt-4 hidden max-w-xl text-sm leading-7 text-white/62 drop-shadow-lg sm:block lg:text-[15px] line-clamp-2">
                    {activeItem.overview}
                  </p>
                )}

                <div className="mt-6 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onPlayClick(activeItem)}
                    className="noir-button-primary inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    تشغيل
                  </button>

                  <button
                    type="button"
                    onClick={() => onInfoClick(activeItem)}
                    className="noir-button-secondary inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Info className="h-4 w-4" />
                    التفاصيل
                  </button>

                  {onToggleSave && (
                    <button
                      type="button"
                      onClick={() => onToggleSave(activeItem)}
                      className={`noir-icon-button noir-icon-button--mobile-compact cursor-pointer ${saved ? '!border-[#22CDD0]/40 !bg-[#009FA5] !text-white' : ''}`}
                      aria-label={saved ? 'إزالة من قائمتي' : 'إضافة إلى قائمتي'}
                      title={saved ? 'محفوظ في قائمتي' : 'إضافة إلى قائمتي'}
                    >
                      {saved ? <Check className="w-5 h-5" strokeWidth={3} /> : <Plus className="w-5 h-5" />}
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>

        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => goTo(-1)}
              className="noir-icon-button noir-hero-arrow absolute right-4 top-1/2 z-20 hidden -translate-y-1/2 cursor-pointer opacity-0 group-hover/hero:opacity-100 sm:flex"
              aria-label="العرض السابق"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => goTo(1)}
              className="noir-icon-button noir-hero-arrow absolute left-4 top-1/2 z-20 hidden -translate-y-1/2 cursor-pointer opacity-0 group-hover/hero:opacity-100 sm:flex"
              aria-label="العرض التالي"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="absolute bottom-5 left-6 z-20 flex gap-1.5 rounded-full border border-white/[0.06] bg-black/25 p-2 backdrop-blur-md sm:bottom-8 sm:left-10">
              {items.map((item, index) => (
                <button
                  type="button"
                  key={`${item.type}-${item.id}`}
                  onClick={() => setCurrentIndex(index)}
                  className={`h-1.5 rounded-full cursor-pointer transition-[width,background-color] ${
                    index === currentIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/35 hover:bg-white/65'
                  }`}
                  aria-label={`الانتقال إلى العرض ${index + 1}`}
                  aria-current={index === currentIndex ? 'true' : undefined}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
