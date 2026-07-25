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
      <div className="px-4 sm:px-6 lg:px-8 pt-3 sm:pt-6 mb-10">
        <div className="w-full aspect-[4/5] sm:aspect-[16/9] lg:aspect-[2.25/1] min-h-[420px] sm:min-h-0 rounded-[24px] bg-white/[0.05] animate-pulse" />
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
    <section className="px-3 sm:px-5 lg:px-8 pt-2 sm:pt-5 mb-10 sm:mb-14 select-none" aria-label="العرض المميز">
      <div className="group/hero relative overflow-hidden rounded-[24px] sm:rounded-[28px] border border-white/[0.08] bg-[#101013] shadow-[0_32px_90px_-45px_rgba(0,0,0,0.95)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeItem.type}-${activeItem.id}`}
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="relative aspect-[4/5] sm:aspect-[16/9] lg:aspect-[2.25/1] min-h-[440px] sm:min-h-0"
          >
            <img
              src={image}
              alt=""
              referrerPolicy="no-referrer"
              fetchPriority="high"
              className="absolute inset-0 w-full h-full object-cover object-top"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/5" />
            <div className="absolute inset-0 bg-gradient-to-l from-black/80 via-black/20 to-transparent" />

            <div
              dir="rtl"
              className="absolute inset-x-0 bottom-0 max-w-3xl px-6 sm:px-10 lg:px-14 pb-8 sm:pb-10 lg:pb-12 text-right"
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

                <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.08] tracking-tight max-w-2xl line-clamp-2 drop-shadow-xl">
                  {activeItem.title}
                </h1>

                {activeItem.overview && (
                  <p className="hidden sm:block mt-4 text-sm lg:text-base text-white/68 leading-7 max-w-xl line-clamp-2">
                    {activeItem.overview}
                  </p>
                )}

                <div className="mt-5 sm:mt-6 flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => onPlayClick(activeItem)}
                    className="noir-button-primary inline-flex items-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    المشاهدة الآن
                  </button>

                  <button
                    onClick={() => onInfoClick(activeItem)}
                    className="noir-button-secondary inline-flex items-center gap-2"
                  >
                    <Info className="w-4 h-4" />
                    التفاصيل
                  </button>

                  {onToggleSave && (
                    <button
                      onClick={() => onToggleSave(activeItem)}
                      className={`noir-icon-button ${saved ? '!bg-white !text-black' : ''}`}
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
              onClick={() => goTo(-1)}
              className="hidden sm:flex noir-icon-button absolute right-4 top-1/2 -translate-y-1/2 z-20 opacity-0 group-hover/hero:opacity-100"
              aria-label="العرض السابق"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => goTo(1)}
              className="hidden sm:flex noir-icon-button absolute left-4 top-1/2 -translate-y-1/2 z-20 opacity-0 group-hover/hero:opacity-100"
              aria-label="العرض التالي"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-1.5 rounded-full bg-black/25 backdrop-blur-md p-2">
              {items.map((item, index) => (
                <button
                  key={`${item.type}-${item.id}`}
                  onClick={() => setCurrentIndex(index)}
                  className={`h-1.5 rounded-full transition-[width,background-color] ${
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
