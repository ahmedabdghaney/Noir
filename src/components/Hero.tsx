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
    <section className="-mb-8 sm:-mb-14 select-none" aria-label="العرض المميز">
      <div className="group/hero relative overflow-hidden bg-[#080808] shadow-[0_28px_80px_-52px_rgba(0,0,0,1)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeItem.type}-${activeItem.id}`}
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="noir-hero-frame relative h-[72svh] min-h-[520px] max-h-[820px] sm:h-[70svh]"
          >
            <img
              src={image}
              alt=""
              referrerPolicy="no-referrer"
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover object-center scale-[1.01]"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-[#070707] via-black/20 to-black/10" />
            <div className="absolute inset-0 bg-gradient-to-l from-black/90 via-black/32 to-transparent" />

            <div
              dir="rtl"
              className="absolute inset-x-0 bottom-[8%] max-w-3xl px-5 sm:px-9 lg:px-12 text-right"
            >
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.38, delay: 0.08 }}
              >
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-white/65 mb-3">
                  <span>{activeItem.type === 'movie' ? 'فيلم مميز' : 'مسلسل مميز'}</span>
                  {activeItem.year && <span>{activeItem.year}</span>}
                  {activeItem.rating > 0 && (
                    <span className="inline-flex items-center gap-1 text-[#ffd60a]">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      {activeItem.rating.toFixed(1)}
                    </span>
                  )}
                </span>

                <h1 className="font-display text-4xl sm:text-5xl lg:text-7xl font-extrabold text-white leading-[1.03] tracking-tight max-w-2xl line-clamp-2 drop-shadow-2xl">
                  {activeItem.title}
                </h1>

                {activeItem.overview && (
                  <p className="hidden sm:block mt-4 text-sm lg:text-base text-white/72 leading-7 max-w-xl line-clamp-3 drop-shadow-lg">
                    {activeItem.overview}
                  </p>
                )}

                <div className="mt-5 sm:mt-6 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onPlayClick(activeItem)}
                    className="noir-button-primary inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    المشاهدة الآن
                  </button>

                  <button
                    type="button"
                    onClick={() => onInfoClick(activeItem)}
                    className="noir-button-secondary inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Info className="w-4 h-4" />
                    التفاصيل
                  </button>

                  {onToggleSave && (
                    <button
                      type="button"
                      onClick={() => onToggleSave(activeItem)}
                      className={`noir-icon-button noir-icon-button--mobile-compact cursor-pointer ${saved ? '!bg-white !text-black' : ''}`}
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
              className="hidden sm:flex noir-icon-button noir-hero-arrow cursor-pointer absolute right-4 top-1/2 -translate-y-1/2 z-20 opacity-0 group-hover/hero:opacity-100"
              aria-label="العرض السابق"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => goTo(1)}
              className="hidden sm:flex noir-icon-button noir-hero-arrow cursor-pointer absolute left-4 top-1/2 -translate-y-1/2 z-20 opacity-0 group-hover/hero:opacity-100"
              aria-label="العرض التالي"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="absolute bottom-4 left-5 sm:left-9 lg:left-12 z-20 flex gap-1.5 rounded-full bg-black/30 backdrop-blur-md p-2">
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
