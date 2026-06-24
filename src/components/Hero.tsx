/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Play, Info, Flame, ChevronRight, ChevronLeft, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MovieOrShow } from '../types';
import { fetchDetailedTitle, getTitleLogoUrl } from '../lib/tmdb';

interface HeroProps {
  trendingItems: MovieOrShow[];
  onPlayClick: (item: MovieOrShow) => void;
  onInfoClick: (item: MovieOrShow) => void;
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    scale: 1.04,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1.14,
    transition: {
      x: { duration: 1.4, ease: [0.16, 1, 0.3, 1] },
      opacity: { duration: 1.1, ease: 'easeOut' },
      scale: { duration: 9, ease: 'linear' },
    }
  },
  exit: (direction: number) => ({
    x: direction > 0 ? '-100%' : '100%',
    opacity: 0,
    scale: 1.18,
    transition: {
      x: { duration: 0.42, ease: [0.3, 0, 0.7, 0] },
      opacity: { duration: 0.35, ease: 'easeIn' },
      scale: { duration: 0.42, ease: 'easeIn' }
    }
  })
};

const contentVariants = {
  enter: {
    y: 25,
    opacity: 0,
  },
  center: {
    y: 0,
    opacity: 1,
    transition: {
      y: { duration: 1.3, ease: [0.16, 1, 0.3, 1] },
      opacity: { duration: 1.0, ease: 'easeOut' },
    }
  },
  exit: {
    y: -20,
    opacity: 0,
    transition: {
      y: { duration: 0.35, ease: 'easeInOut' },
      opacity: { duration: 0.3, ease: 'easeIn' },
    }
  }
};

export default function Hero({ trendingItems, onPlayClick, onInfoClick }: HeroProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [logoCache, setLogoCache] = useState<Record<string, string | null>>({});
  const rotationTimer = useRef<NodeJS.Timeout | null>(null);

  const activePool = trendingItems.slice(0, 20);

  const startTimer = () => {
    if (rotationTimer.current) clearInterval(rotationTimer.current);
    if (activePool.length > 1) {
      rotationTimer.current = setInterval(() => {
        setDirection(1);
        setCurrentIndex((prev) => (prev + 1) % activePool.length);
      }, 7500);
    }
  };

  useEffect(() => {
    startTimer();
    return () => {
      if (rotationTimer.current) clearInterval(rotationTimer.current);
    };
  }, [activePool.length]);

  const activeItemForLogo = activePool[currentIndex];
  useEffect(() => {
    if (!activeItemForLogo || !activeItemForLogo.id || !activeItemForLogo.type) return;
    const key = `${activeItemForLogo.type}-${activeItemForLogo.id}`;
    if (key in logoCache) return;
    let cancelled = false;
    fetchDetailedTitle(activeItemForLogo.type, activeItemForLogo.id)
      .then((d) => {
        if (!cancelled) setLogoCache((c) => ({ ...c, [key]: getTitleLogoUrl(d) }));
      })
      .catch(() => {
        if (!cancelled) setLogoCache((c) => ({ ...c, [key]: null }));
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItemForLogo?.id, activeItemForLogo?.type]);

  if (!activePool.length) {
    return (
      <div className="w-full h-[65vh] min-h-[500px] bg-stone-900 animate-pulse relative flex items-end p-8 md:p-16">
        <div className="max-w-xl space-y-4">
          <div className="w-24 h-6 bg-stone-800 rounded"></div>
          <div className="w-72 h-12 bg-stone-800 rounded"></div>
          <div className="w-full h-20 bg-stone-800 rounded"></div>
          <div className="flex gap-3">
            <div className="w-28 h-10 bg-stone-800 rounded-full"></div>
            <div className="w-28 h-10 bg-stone-800 rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  const activeItem = activePool[currentIndex];
  const prevItem = activePool[(currentIndex - 1 + activePool.length) % activePool.length];
  const nextItem = activePool[(currentIndex + 1) % activePool.length];

  const activeLogo = activeItem ? logoCache[`${activeItem.type}-${activeItem.id}`] : null;

  const getHighRes = (url: string | undefined) => {
    if (!url) return '';
    return url.replace('/w1280', '/original').replace('/w500', '/original');
  };

  const handlePrev = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + activePool.length) % activePool.length);
    startTimer();
  };

  const handleNext = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % activePool.length);
    startTimer();
  };

  const handleDotSelect = (index: number) => {
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
    startTimer();
  };

  return (
    <div className="relative h-[68vh] sm:h-[88vh] min-h-[500px] sm:min-h-[680px] max-h-[920px] w-full overflow-hidden mb-10 sm:mb-14 flex items-end group select-none">
      
      {/* Background with custom container */}
      <div className="absolute inset-0 overflow-hidden">
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${(activeItem.backdrop || activeItem.poster || '').replace('/w1280', '/original').replace('/w500', '/original')})`,
            }}
          />
        </AnimatePresence>
        
        {/* Shadow overlays - Clean gradient masks */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/55 to-transparent z-[5] pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0a0a0a] to-transparent z-[5] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/65 via-transparent to-[#0a0a0a]/25 z-[5] pointer-events-none" />
      </div>

      {/* ═══ Side Peek — Apple TV+ Style ═══ */}
      {activePool.length > 1 && (
        <>
          {/* Right side — previous movie (RTL) */}
          <div
            className="absolute top-0 bottom-0 right-0 w-[10%] md:w-[8%] bg-cover bg-center overflow-hidden pointer-events-none z-[3] transition-opacity duration-700"
            style={{
              backgroundImage: `url(${getHighRes(prevItem?.backdrop || prevItem?.poster)})`,
              backgroundPosition: 'center',
              transform: 'scaleX(3)',
              transformOrigin: 'right center',
              opacity: 0.35,
              filter: 'brightness(0.5)',
            }}
          />
          {/* Left side — next movie (RTL) */}
          <div
            className="absolute top-0 bottom-0 left-0 w-[10%] md:w-[8%] bg-cover bg-center overflow-hidden pointer-events-none z-[3] transition-opacity duration-700"
            style={{
              backgroundImage: `url(${getHighRes(nextItem?.backdrop || nextItem?.poster)})`,
              backgroundPosition: 'center',
              transform: 'scaleX(3)',
              transformOrigin: 'left center',
              opacity: 0.35,
              filter: 'brightness(0.5)',
            }}
          />
          {/* Shadow dividers */}
          <div className="absolute top-0 bottom-0 right-[8%] md:right-[8%] w-24 bg-gradient-to-l from-[#0a0a0a] to-transparent pointer-events-none z-[4]" />
          <div className="absolute top-0 bottom-0 left-[8%] md:left-[8%] w-24 bg-gradient-to-r from-[#0a0a0a] to-transparent pointer-events-none z-[4]" />
        </>
      )}

      {/* Hero Slide Contents - Animated concurrently */}
      <div className="absolute inset-x-0 bottom-0 z-10 w-full px-4 sm:px-12 pb-6 sm:pb-20 md:pb-24 pointer-events-none">
        <div className="max-w-xl text-right md:text-right pointer-events-auto">
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={currentIndex}
              variants={contentVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="flex flex-col text-right"
            >
              {/* Trending Badge */}
              <div className="inline-flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold mb-3 sm:mb-4 self-start">
                <Flame className="w-3 sm:w-3.5 h-3 sm:h-3.5 fill-red-400" />
                <span>الأكثر رواجاً هذا الأسبوع</span>
              </div>

              {/* Title (logo if available, else text) */}
              {activeLogo ? (
                <img
                  src={activeLogo}
                  alt={activeItem.title}
                  referrerPolicy="no-referrer"
                  className="max-h-24 sm:max-h-36 md:max-h-44 max-w-[300px] sm:max-w-[480px] object-contain object-right mb-2 sm:mb-4 drop-shadow-2xl select-none"
                />
              ) : (
                <h1 className="font-display text-3xl sm:text-5xl md:text-7xl font-black tracking-tight mb-2 sm:mb-4 text-gradient-noir line-clamp-2 leading-[1.05] drop-shadow-2xl">
                  {activeItem.title}
                </h1>
              )}

              {/* Metadata */}
              <div className="flex items-center gap-3.5 text-xs text-gray-300 font-medium mb-3 sm:mb-4 justify-start">
                <span className="flex items-center gap-1 text-[#f5c518] font-bold">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  {activeItem.rating > 0 ? activeItem.rating.toFixed(1) : 'جديد'}
                </span>
                <span className="w-1 h-1 bg-gray-500 rounded-full" />
                <span>{activeItem.year || 'غير معروف'}</span>
                {activeItem.genres.length > 0 && (
                  <>
                    <span className="w-1 h-1 bg-gray-500 rounded-full" />
                    <span className="text-gray-400 bg-white/5 px-2 py-0.5 rounded border border-white/5 text-[10px] sm:text-xs font-bold">
                      {activeItem.genres.slice(0, 3).join(' · ')}
                    </span>
                  </>
                )}
              </div>

              {/* Overview */}
              <p className="hidden sm:block text-gray-300 text-xs sm:text-sm md:text-base leading-relaxed mb-6 line-clamp-2 max-w-lg">
                {activeItem.overview}
              </p>

              {/* Call to Actions */}
              <div className="flex flex-wrap gap-2.5 sm:gap-3">
                <button
                  onClick={() => onPlayClick(activeItem)}
                  className="flex items-center gap-2 bg-white text-black hover:bg-white/90 font-bold px-6 sm:px-8 py-2.5 sm:py-3.5 rounded-2xl transition-all hover:scale-[1.03] active:scale-[0.98] cursor-pointer text-sm shadow-xl shadow-black/30"
                >
                  <Play className="w-4 h-4 fill-current text-black" />
                  <span>شاهد الآن</span>
                </button>
                <button
                  onClick={() => onInfoClick(activeItem)}
                  className="glass flex items-center gap-2 hover:bg-white/15 text-white font-bold px-6 sm:px-8 py-2.5 sm:py-3.5 rounded-2xl transition-all hover:scale-[1.03] cursor-pointer text-sm"
                >
                  <Info className="w-4 h-4" />
                  <span>التفاصيل</span>
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Manual Sliding Arrows */}
      <div className="absolute inset-y-0 left-0 right-0 z-20 flex justify-between items-center px-4 md:px-8 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity pointer-events-none">
        <button
          onClick={handlePrev}
          className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur border border-white/5 text-white flex items-center justify-center cursor-pointer pointer-events-auto transition-transform hover:scale-105"
          aria-label="الشريحة السابقة"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
        <button
          onClick={handleNext}
          className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur border border-white/5 text-white flex items-center justify-center cursor-pointer pointer-events-auto transition-transform hover:scale-105"
          aria-label="الشريحة التالية"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>

      {/* Slider Indicator Dots in Center */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {activePool.map((_, i) => (
          <button
            key={i}
            onClick={() => handleDotSelect(i)}
            className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
              i === currentIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/30 hover:bg-white/50'
            }`}
            aria-label={`الذهاب للشريحة ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
