/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Play, Plus, Check, ChevronRight, ChevronLeft, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MovieOrShow } from '../types';
import { fetchDetailedTitle, getTitleLogoUrl } from '../lib/tmdb';

interface HeroProps {
  trendingItems: MovieOrShow[];
  onPlayClick: (item: MovieOrShow) => void;
  onInfoClick: (item: MovieOrShow) => void;
  onTrailerClick?: (item: MovieOrShow) => void;
  onShareClick?: (item: MovieOrShow) => void;
  isSaved?: (item: MovieOrShow) => boolean;
  onToggleSave?: (item: MovieOrShow) => void;
}

export default function Hero({
  trendingItems,
  onPlayClick,
  onInfoClick,
  onTrailerClick,
  onShareClick,
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

  // Lazy-load logos for visible items
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
      <div className="relative h-[78vh] min-h-[560px] w-full mb-10 flex items-center justify-center">
        <div className="w-[300px] h-[450px] rounded-3xl bg-stone-900 animate-pulse" />
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

  const poster = (it: MovieOrShow) => it.poster || it.backdrop || '';

  return (
    <div className="relative w-full mb-12 sm:mb-16 pt-6 sm:pt-10 select-none overflow-hidden">
      {/* Ambient blurred backdrop from active poster */}
      <div className="absolute inset-0 -z-0 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={`bg-${activeItem.type}-${activeItem.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 bg-cover bg-center blur-3xl scale-125"
            style={{ backgroundImage: `url(${(activeItem.backdrop || poster(activeItem)).replace('/w500', '/w780')})` }}
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-[#0b0b0d]/70" />
      </div>

      <div className="relative z-10 flex items-center justify-center gap-3 sm:gap-6 px-2 sm:px-6">
        {/* Side card (right / previous in RTL) */}
        <button
          onClick={() => goTo(-1)}
          className="hidden md:block flex-none w-[110px] lg:w-[150px] aspect-[2/3] rounded-2xl overflow-hidden border border-white/8 opacity-40 hover:opacity-70 transition-all cursor-pointer shadow-xl"
          aria-label="السابق"
        >
          <img src={poster(prevItem)} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
        </button>

        {/* Center card */}
        <div className="flex-none w-[300px] sm:w-[340px] lg:w-[380px]">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={`card-${activeItem.type}-${activeItem.id}`}
              custom={direction}
              initial={{ opacity: 0, scale: 0.94, x: direction > 0 ? 60 : -60 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.94, x: direction > 0 ? -60 : 60 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative rounded-3xl overflow-hidden border border-white/12 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10"
            >
              {/* Poster */}
              <div className="relative aspect-[2/3]">
                <img
                  src={poster(activeItem)}
                  alt={activeItem.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                {/* Bottom blur + gradient so details are readable */}
                <div className="absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black/97 via-black/70 to-transparent backdrop-blur-[3px] [mask-image:linear-gradient(to_top,black_65%,transparent)]" />

                {/* Details overlaid on bottom */}
                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 flex flex-col items-center text-center">
                  {/* Logo or title */}
                  {activeLogo ? (
                    <img src={activeLogo} alt={activeItem.title} referrerPolicy="no-referrer" className="max-h-16 sm:max-h-20 max-w-[80%] object-contain mb-3 drop-shadow-2xl" />
                  ) : (
                    <h1 className="font-display text-2xl sm:text-3xl font-black text-white mb-3 leading-tight line-clamp-2 drop-shadow-2xl">{activeItem.title}</h1>
                  )}

                  {/* Meta: rating + year + genre */}
                  <div className="flex items-center justify-center gap-3 text-xs text-gray-200 font-semibold mb-2.5">
                    <span className="flex items-center gap-1 text-[#f5c518]">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      {activeItem.rating > 0 ? activeItem.rating.toFixed(1) : 'جديد'}
                    </span>
                    <span>{activeItem.year || ''}</span>
                    {activeItem.genres.length > 0 && (
                      <span className="text-gray-300">{activeItem.genres.slice(0, 2).join(' · ')}</span>
                    )}
                  </div>

                  {/* Overview */}
                  {activeItem.overview && (
                    <p className="text-gray-300 text-[11px] sm:text-xs leading-relaxed line-clamp-2 mb-4 max-w-[90%]">
                      {activeItem.overview}
                    </p>
                  )}

                  {/* Actions: Play (white) + trailer + save + share */}
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => onPlayClick(activeItem)}
                      className="flex items-center gap-2 bg-white text-black hover:bg-white/90 font-bold px-6 py-2.5 rounded-full transition-all hover:scale-[1.04] active:scale-95 cursor-pointer text-sm shadow-lg"
                    >
                      <Play className="w-4 h-4 fill-black text-black" />
                      <span>Play</span>
                    </button>

                    {onTrailerClick && (
                      <button
                        onClick={() => onTrailerClick(activeItem)}
                        className="w-10 h-10 rounded-full glass flex items-center justify-center text-white hover:bg-white/15 transition-all cursor-pointer"
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
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${saved ? 'bg-white text-black' : 'glass text-white hover:bg-white/15'}`}
                        title={saved ? 'محفوظ في قائمتي' : 'إضافة لقائمتي'}
                      >
                        {saved ? <Check className="w-5 h-5 text-black" strokeWidth={3} /> : <Plus className="w-5 h-5" />}
                      </button>
                    )}

                    <button
                      onClick={() => onInfoClick(activeItem)}
                      className="w-10 h-10 rounded-full glass flex items-center justify-center text-white hover:bg-white/15 transition-all cursor-pointer"
                      title="التفاصيل"
                    >
                      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="2">
                        <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                        <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Side card (left / next in RTL) */}
        <button
          onClick={() => goTo(1)}
          className="hidden md:block flex-none w-[110px] lg:w-[150px] aspect-[2/3] rounded-2xl overflow-hidden border border-white/8 opacity-40 hover:opacity-70 transition-all cursor-pointer shadow-xl"
          aria-label="التالي"
        >
          <img src={poster(nextItem)} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
        </button>
      </div>

      {/* Mobile nav arrows */}
      <div className="md:hidden relative z-10 flex justify-center gap-4 mt-5">
        <button onClick={() => goTo(-1)} className="w-10 h-10 rounded-full glass flex items-center justify-center text-white cursor-pointer" aria-label="السابق">
          <ChevronRight className="w-5 h-5" />
        </button>
        <button onClick={() => goTo(1)} className="w-10 h-10 rounded-full glass flex items-center justify-center text-white cursor-pointer" aria-label="التالي">
          <ChevronLeft className="w-5 h-5" />
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
