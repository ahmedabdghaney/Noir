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

  useEffect(() => {
    if (activePool.length <= 1) return;
    const timer = setInterval(() => {
      setDirection(1);
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
      <div className="relative w-full mb-12 px-6 md:px-12 pt-6">
        <div className="w-full aspect-[16/9] sm:aspect-[2.4/1] rounded-3xl bg-stone-900 animate-pulse" />
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
    (it.backdrop || it.poster || '').replace('/w500', '/original').replace('/w1280', '/original');

  return (
    <div className="relative w-full mb-12 sm:mb-16 pt-4 sm:pt-8 select-none overflow-hidden">
      <div className="relative flex items-stretch justify-center gap-4 sm:gap-6">
        {/* Side peek card (right / previous in RTL) */}
        <button
          onClick={() => goTo(-1)}
          className="hidden lg:block flex-none w-[7%] rounded-3xl overflow-hidden opacity-45 hover:opacity-75 transition-opacity cursor-pointer aspect-[2.3/1]"
          aria-label="السابق"
        >
          <img src={wideImg(prevItem)} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" style={{ objectPosition: 'left center' }} />
        </button>

        {/* Center wide card */}
        <div className="flex-1 max-w-[1100px] px-2 sm:px-0">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={`card-${activeItem.type}-${activeItem.id}`}
              custom={direction}
              initial={{ opacity: 0, scale: 0.97, x: direction > 0 ? 40 : -40 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.97, x: direction > 0 ? -40 : 40 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative rounded-3xl overflow-hidden border border-white/12 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10"
            >
              {/* Wide backdrop */}
              <div className="relative aspect-[16/10] sm:aspect-[2.3/1]">
                <img
                  src={wideImg(activeItem)}
                  alt={activeItem.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                {/* Gradient + blur so right-side details stay readable */}
                <div className="absolute inset-0 bg-gradient-to-l from-black/95 via-black/40 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 to-transparent" />

                {/* Details — right aligned */}
                <div className="absolute inset-0 flex flex-col items-end justify-center text-right p-6 sm:p-10 md:p-14">
                  <div className="max-w-[85%] sm:max-w-[60%] flex flex-col items-end">
                    {/* Logo or title */}
                    {activeLogo ? (
                      <img src={activeLogo} alt={activeItem.title} referrerPolicy="no-referrer" className="max-h-16 sm:max-h-24 md:max-h-28 max-w-full object-contain object-right mb-3 sm:mb-4 drop-shadow-2xl" />
                    ) : (
                      <h1 className="font-display text-3xl sm:text-5xl font-black text-white mb-3 leading-tight line-clamp-2 drop-shadow-2xl">{activeItem.title}</h1>
                    )}

                    {/* Meta */}
                    <div className="flex items-center justify-end gap-2 sm:gap-3 text-[11px] sm:text-xs text-gray-200 font-semibold mb-2 flex-wrap">
                      <span className="text-stone-300">{activeItem.type === 'movie' ? 'فيلم' : 'مسلسل'}</span>
                      <span>{activeItem.year || ''}</span>
                      <span className="flex items-center gap-1 text-[#f5c518]">
                        {activeItem.rating > 0 ? activeItem.rating.toFixed(1) : 'جديد'}
                        <Star className="w-3 h-3 fill-current" />
                      </span>
                    </div>

                    {/* Genre chips */}
                    {activeItem.genres.length > 0 && (
                      <div className="flex items-center justify-end gap-1.5 mb-3 flex-wrap">
                        {activeItem.genres.slice(0, 3).map((g, i) => (
                          <span key={i} className="text-[9px] sm:text-[10px] font-semibold text-stone-200 glass px-2 py-0.5 rounded-md">{g}</span>
                        ))}
                      </div>
                    )}

                    {/* Overview */}
                    {activeItem.overview && (
                      <p className="hidden sm:block text-gray-300 text-[11px] sm:text-xs leading-relaxed line-clamp-2 mb-5 max-w-md">
                        {activeItem.overview}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2.5">
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

                      {onToggleSave && (
                        <button
                          onClick={() => onToggleSave(activeItem)}
                          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${saved ? 'bg-white text-black' : 'glass text-white hover:bg-white/15'}`}
                          title={saved ? 'محفوظ في قائمتي' : 'إضافة لقائمتي'}
                        >
                          {saved ? <Check className="w-5 h-5 text-black" strokeWidth={3} /> : <Plus className="w-5 h-5" />}
                        </button>
                      )}

                      <button
                        onClick={() => onPlayClick(activeItem)}
                        className="flex items-center gap-2 bg-white text-black hover:bg-white/90 font-bold px-7 py-2.5 sm:py-3 rounded-full transition-all hover:scale-[1.04] active:scale-95 cursor-pointer text-sm shadow-lg"
                      >
                        <Play className="w-4 h-4 fill-black text-black" />
                        <span>Play</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* In-card nav arrows */}
                <button
                  onClick={() => goTo(-1)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-black flex items-center justify-center cursor-pointer transition-all hover:scale-105 shadow-lg"
                  aria-label="السابق"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => goTo(1)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-black flex items-center justify-center cursor-pointer transition-all hover:scale-105 shadow-lg"
                  aria-label="التالي"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Side peek card (left / next in RTL) */}
        <button
          onClick={() => goTo(1)}
          className="hidden lg:block flex-none w-[7%] rounded-3xl overflow-hidden opacity-45 hover:opacity-75 transition-opacity cursor-pointer aspect-[2.3/1]"
          aria-label="التالي"
        >
          <img src={wideImg(nextItem)} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" style={{ objectPosition: 'right center' }} />
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
