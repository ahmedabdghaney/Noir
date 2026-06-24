/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Play, Plus, Check, ChevronRight, ChevronLeft, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MovieOrShow } from '../types';
import { fetchDetailedTitle, getTitleLogoUrl, getOriginalBackdropUrl } from '../lib/tmdb';

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
  onTrailerClick,
  isSaved,
  onToggleSave,
}: HeroProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [logoCache, setLogoCache] = useState<Record<string, string | null>>({});

  const activePool = trendingItems.slice(0, 12);

  // Auto-rotate
  useEffect(() => {
    if (activePool.length <= 1) return;
    const timer = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % activePool.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [activePool.length]);

  // Lazy-load logo for active item
  const activeItem = activePool[currentIndex];
  useEffect(() => {
    if (!activeItem || !activeItem.id || !activeItem.type) return;
    const key = `${activeItem.type}-${activeItem.id}`;
    if (key in logoCache) return;
    let cancelled = false;
    fetchDetailedTitle(activeItem.type, activeItem.id)
      .then((d) => { if (!cancelled) setLogoCache((c) => ({ ...c, [key]: getTitleLogoUrl(d) })); })
      .catch(() => { if (!cancelled) setLogoCache((c) => ({ ...c, [key]: null })); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItem?.id, activeItem?.type]);

  if (!activePool.length) {
    return (
      <div className="relative w-full mb-12 px-4 sm:px-8 pt-6">
        <div className="w-full aspect-[16/10] sm:aspect-[2.2/1] rounded-[28px] bg-stone-900 animate-pulse" />
      </div>
    );
  }

  const goTo = (dir: number) => {
    setDirection(dir);
    setCurrentIndex((prev) => (prev + dir + activePool.length) % activePool.length);
  };

  const prevIndex = (currentIndex - 1 + activePool.length) % activePool.length;
  const nextIndex = (currentIndex + 1) % activePool.length;
  const prevItem = activePool[prevIndex];
  const nextItem = activePool[nextIndex];
  const activeLogo = logoCache[`${activeItem.type}-${activeItem.id}`];
  const saved = isSaved ? isSaved(activeItem) : false;

  const wideImg = (it: MovieOrShow) =>
    getOriginalBackdropUrl((it as any).backdrop_path) ||
    (it.backdrop || it.poster || '').replace('/w1280', '/original').replace('/w500', '/original');

  // Smooth slide+fade for the whole card content
  const cardVariants = {
    enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 80 : -80, scale: 0.98 }),
    center: { opacity: 1, x: 0, scale: 1 },
    exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -80 : 80, scale: 0.98 }),
  };

  // Stagger children (logo, meta, chips, overview, buttons) for a smooth Apple feel
  const contentContainer = {
    hidden: {},
    show: { transition: { staggerChildren: 0.07, delayChildren: 0.12 } },
  };
  const contentItem = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <div dir="rtl" className="relative w-full mb-12 sm:mb-16 pt-4 sm:pt-8 select-none overflow-hidden">
      <div className="relative flex items-stretch justify-center gap-3 sm:gap-4 px-2 sm:px-4">
        {/* Side peek — next (left in RTL) */}
        <button
          onClick={() => goTo(1)}
          className="hidden lg:block flex-none w-[11%] rounded-[24px] overflow-hidden opacity-40 hover:opacity-70 transition-opacity cursor-pointer aspect-[2.15/1]"
          aria-label="التالي"
        >
          <img src={wideImg(nextItem)} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" style={{ objectPosition: 'right center' }} />
        </button>

        {/* Center wide card */}
        <div className="flex-1 max-w-[1500px]">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={`card-${activeItem.type}-${activeItem.id}`}
              custom={direction}
              variants={cardVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="relative rounded-[28px] overflow-hidden border border-white/12 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10"
            >
              <div className="relative aspect-[16/10] sm:aspect-[16/7] lg:aspect-[2.15/1]">
                {/* Backdrop with subtle ken-burns */}
                <motion.img
                  key={`img-${activeItem.id}`}
                  src={wideImg(activeItem)}
                  alt={activeItem.title}
                  referrerPolicy="no-referrer"
                  initial={{ scale: 1.08 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 8, ease: 'easeOut' }}
                  className="w-full h-full object-cover"
                />

                {/* Gradients — darken right side for readability (RTL) */}
                <div className="absolute inset-0 bg-gradient-to-l from-black/95 via-black/45 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />

                {/* Details — pinned to the right, all RTL */}
                <motion.div
                  key={`content-${activeItem.id}`}
                  variants={contentContainer}
                  initial="hidden"
                  animate="show"
                  className="absolute inset-y-0 right-0 w-full sm:w-[55%] md:w-[50%] flex flex-col items-end justify-center text-right p-6 sm:p-9 md:p-12"
                >
                  {/* Logo or title */}
                  <motion.div variants={contentItem} className="flex justify-end w-full mb-3">
                    {activeLogo ? (
                      <img src={activeLogo} alt={activeItem.title} referrerPolicy="no-referrer" className="max-h-14 sm:max-h-20 md:max-h-24 max-w-[90%] object-contain object-right drop-shadow-2xl" />
                    ) : (
                      <h1 className="font-display text-3xl sm:text-5xl font-black text-white leading-tight line-clamp-2 drop-shadow-2xl">{activeItem.title}</h1>
                    )}
                  </motion.div>

                  {/* Meta row */}
                  <motion.div variants={contentItem} className="flex items-center justify-end gap-2.5 text-[11px] sm:text-xs text-gray-200 font-semibold mb-2.5">
                    <span className="text-stone-300">{activeItem.type === 'movie' ? 'فيلم' : 'مسلسل'}</span>
                    <span className="text-stone-400">{activeItem.year || ''}</span>
                    <span className="flex items-center gap-1 text-[#f5c518]">
                      {activeItem.rating > 0 ? activeItem.rating.toFixed(1) : 'جديد'}
                      <Star className="w-3 h-3 fill-current" />
                    </span>
                  </motion.div>

                  {/* Genre chips */}
                  {activeItem.genres.length > 0 && (
                    <motion.div variants={contentItem} className="flex items-center justify-end gap-1.5 mb-3">
                      {activeItem.genres.slice(0, 3).map((g, i) => (
                        <span key={i} className="text-[9px] sm:text-[10px] font-semibold text-stone-200 glass px-2.5 py-1 rounded-lg">{g}</span>
                      ))}
                    </motion.div>
                  )}

                  {/* Overview */}
                  {activeItem.overview && (
                    <motion.p variants={contentItem} className="hidden sm:block text-gray-300 text-[11px] sm:text-xs leading-relaxed line-clamp-3 mb-5 max-w-md">
                      {activeItem.overview}
                    </motion.p>
                  )}

                  {/* Actions — RTL: Play is rightmost */}
                  <motion.div variants={contentItem} className="flex items-center justify-end gap-2.5 flex-row-reverse">
                    <button
                      onClick={() => onPlayClick(activeItem)}
                      className="flex items-center gap-2 bg-white text-black hover:bg-white/90 font-bold px-7 py-2.5 sm:py-3 rounded-full transition-all hover:scale-[1.04] active:scale-95 cursor-pointer text-sm shadow-lg"
                    >
                      <Play className="w-4 h-4 fill-black text-black" />
                      <span>Play</span>
                    </button>

                    {onToggleSave && (
                      <button
                        onClick={() => onToggleSave(activeItem)}
                        className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${saved ? 'bg-white text-black' : 'glass text-white hover:bg-white/15'}`}
                        title={saved ? 'محفوظ في قائمتي' : 'إضافة لقائمتي'}
                      >
                        {saved ? <Check className="w-5 h-5 text-black" strokeWidth={3} /> : <Plus className="w-5 h-5" />}
                      </button>
                    )}

                    {onTrailerClick && (
                      <button
                        onClick={() => onTrailerClick(activeItem)}
                        className="w-11 h-11 rounded-full glass flex items-center justify-center text-white hover:bg-white/15 transition-all cursor-pointer"
                        title="الإعلان"
                      >
                        <svg viewBox="0 0 28 20" className="w-5 h-[14px]" xmlns="http://www.w3.org/2000/svg">
                          <rect width="28" height="20" rx="5" fill="#FF0000" />
                          <path d="M11 6 L19 10 L11 14 Z" fill="white" />
                        </svg>
                      </button>
                    )}
                  </motion.div>
                </motion.div>

                {/* In-card nav arrows */}
                <button
                  onClick={() => goTo(-1)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-black flex items-center justify-center cursor-pointer transition-all hover:scale-110 shadow-lg z-20"
                  aria-label="السابق"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button
                  onClick={() => goTo(1)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-black flex items-center justify-center cursor-pointer transition-all hover:scale-110 shadow-lg z-20"
                  aria-label="التالي"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Side peek — previous (right in RTL) */}
        <button
          onClick={() => goTo(-1)}
          className="hidden lg:block flex-none w-[11%] rounded-[24px] overflow-hidden opacity-40 hover:opacity-70 transition-opacity cursor-pointer aspect-[2.15/1]"
          aria-label="السابق"
        >
          <img src={wideImg(prevItem)} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" style={{ objectPosition: 'left center' }} />
        </button>
      </div>

      {/* Dots */}
      <div className="relative z-10 flex justify-center gap-2 mt-6">
        {activePool.map((_, i) => (
          <button
            key={i}
            onClick={() => { setDirection(i > currentIndex ? 1 : -1); setCurrentIndex(i); }}
            className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${i === currentIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/30 hover:bg-white/50'}`}
            aria-label={`شريحة ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
