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
  const [currentIndex, setCurrentIndex] = useState(1);
  const [logoCache, setLogoCache] = useState<Record<string, string | null>>({});

  const activePool = trendingItems.slice(0, 12);

  useEffect(() => {
    if (activePool.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activePool.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [activePool.length]);

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
    setCurrentIndex((prev) => (prev + dir + activePool.length) % activePool.length);
  };

  const wideImg = (it: MovieOrShow) =>
    getOriginalBackdropUrl((it as any).backdrop_path) ||
    (it.backdrop || it.poster || '').replace('/w1280', '/original').replace('/w500', '/original');

  const contentContainer = {
    hidden: {},
    show: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } },
  };
  const contentItem = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  };

  const activeLogo = logoCache[`${activeItem.type}-${activeItem.id}`];
  const saved = isSaved ? isSaved(activeItem) : false;

  return (
    <div className="relative w-full mb-12 sm:mb-16 select-none overflow-hidden">
      {/* Full-bleed stack — البطاقة النشطة تظهر بـ fade (بدون انزلاق عبر البقية) */}
      <div className="relative overflow-hidden group/hero">
        <div dir="rtl" className="relative">
          {activePool.map((item, i) => {
            const isActive = i === currentIndex;
            return (
              <div
                key={`${item.type}-${item.id}`}
                className={isActive ? 'relative z-10' : 'absolute inset-0 z-0 pointer-events-none'}
              >
                <motion.div
                  animate={{ opacity: isActive ? 1 : 0 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="relative overflow-hidden"
                >
                  <div className="relative aspect-[4/5] sm:aspect-[16/9] lg:aspect-[2.4/1] min-h-[420px] sm:min-h-0">
                    <img
                      src={wideImg(item)}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover object-top"
                    />

                    {/* Gradients — full-bleed زي Apple TV (تعتيم قوي من الأسفل) */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-l from-black/70 via-transparent to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0a0a0a] to-transparent" />

                    {/* Details only on active card */}
                    {isActive && (
                      <motion.div
                        key={`content-${item.id}`}
                        variants={contentContainer}
                        initial="hidden"
                        animate="show"
                        dir="rtl"
                        className="absolute inset-x-0 bottom-0 flex flex-col items-start justify-end text-right px-6 sm:px-12 md:px-16 lg:px-20 pb-10 sm:pb-12 md:pb-16 max-w-2xl"
                      >
                        {/* Logo or title */}
                        <motion.div variants={contentItem} className="flex justify-start w-full mb-3 sm:mb-4">
                          {activeLogo ? (
                            <img src={activeLogo} alt={item.title} referrerPolicy="no-referrer" className="max-h-16 sm:max-h-24 md:max-h-32 max-w-[80%] sm:max-w-[70%] object-contain object-right drop-shadow-2xl" />
                          ) : (
                            <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-black text-white leading-tight line-clamp-2 drop-shadow-2xl">{item.title}</h1>
                          )}
                        </motion.div>

                        {/* Meta */}
                        <motion.div variants={contentItem} className="flex items-center justify-start gap-2.5 text-[10px] sm:text-xs text-gray-200 font-semibold mb-2">
                          <span className="text-stone-300">{item.type === 'movie' ? 'فيلم' : 'مسلسل'}</span>
                          <span className="text-stone-400">{item.year || ''}</span>
                          <span className="flex items-center gap-1 text-[#f5c518]">
                            {item.rating > 0 ? item.rating.toFixed(1) : 'جديد'}
                            <Star className="w-3 h-3 fill-current" />
                          </span>
                        </motion.div>

                        {/* Genre chips */}
                        {item.genres.length > 0 && (
                          <motion.div variants={contentItem} className="flex items-center justify-start gap-1.5 mb-3">
                            {item.genres.slice(0, 3).map((g, idx) => (
                              <span key={idx} className="text-[9px] sm:text-[10px] font-semibold text-stone-200 glass px-2.5 py-1 rounded-lg">{g}</span>
                            ))}
                          </motion.div>
                        )}

                        {/* Overview — مخفي بالموبايل، يظهر بالأجهزة الأكبر */}
                        {item.overview && (
                          <motion.p variants={contentItem} className="hidden sm:block text-gray-300 text-[11px] sm:text-xs leading-relaxed line-clamp-3 mb-5 max-w-md">
                            {item.overview}
                          </motion.p>
                        )}

                        {/* Actions — Play rightmost */}
                        <motion.div variants={contentItem} className="flex items-center justify-start gap-2 flex-wrap">
                          <button
                            onClick={() => onPlayClick(item)}
                            className="flex items-center gap-1.5 sm:gap-2 bg-white text-black hover:bg-white/90 font-bold px-3.5 sm:px-7 py-1.5 sm:py-3 rounded-full transition-all cursor-pointer text-xs sm:text-sm shadow-lg"
                          >
                            <Play className="w-3 h-3 sm:w-4 sm:h-4 fill-black text-black" />
                            <span>تشغيل</span>
                          </button>

                          {onTrailerClick && (
                            <button
                              onClick={() => onTrailerClick(item)}
                              className="flex items-center gap-1.5 sm:gap-2 glass text-white hover:bg-white/15 font-bold px-3 sm:px-5 py-1.5 sm:py-3 rounded-full transition-all cursor-pointer text-xs sm:text-sm"
                              title="الإعلان الرسمي"
                            >
                              <svg viewBox="0 0 28 20" className="w-4 h-[11px] sm:w-5 sm:h-[14px] shrink-0" xmlns="http://www.w3.org/2000/svg">
                                <rect width="28" height="20" rx="5" fill="#FF0000" />
                                <path d="M11 6 L19 10 L11 14 Z" fill="white" />
                              </svg>
                              <span>الإعلان الرسمي</span>
                            </button>
                          )}

                          {onToggleSave && (
                            <button
                              onClick={() => onToggleSave(item)}
                              className={`w-8 h-8 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${saved ? 'bg-white text-black' : 'glass text-white hover:bg-white/15'}`}
                              title={saved ? 'محفوظ في قائمتي' : 'إضافة لقائمتي'}
                            >
                              {saved ? <Check className="w-4 h-4 sm:w-5 sm:h-5 text-black" strokeWidth={3} /> : <Plus className="w-4 h-4 sm:w-5 sm:h-5" />}
                            </button>
                          )}
                        </motion.div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              </div>
            );
          })}
        </div>

        {/* Nav arrows — تظهر فقط عند hover على الهيرو */}
        <button
          onClick={() => goTo(-1)}
          className="hidden sm:flex absolute right-4 md:right-6 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/35 hover:bg-black/55 backdrop-blur-md text-white/90 hover:text-white items-center justify-center cursor-pointer transition-all z-30 opacity-0 group-hover/hero:opacity-100"
          aria-label="السابق"
        >
          <ChevronRight className="w-5 h-5" strokeWidth={2.5} />
        </button>
        <button
          onClick={() => goTo(1)}
          className="hidden sm:flex absolute left-4 md:left-6 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/35 hover:bg-black/55 backdrop-blur-md text-white/90 hover:text-white items-center justify-center cursor-pointer transition-all z-30 opacity-0 group-hover/hero:opacity-100"
          aria-label="التالي"
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
        </button>
      </div>

      {/* Dots */}
      <div className="relative z-10 flex justify-center gap-2 mt-6">
        {activePool.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${i === currentIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/30 hover:bg-white/50'}`}
            aria-label={`شريحة ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
