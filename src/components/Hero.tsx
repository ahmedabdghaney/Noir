import { useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Info, Play, Plus, Star } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { MovieOrShow } from '../types';
import { getBackdropUrl } from '../lib/tmdb';
import TitleLogo from './TitleLogo';

interface HeroProps {
  trendingItems: MovieOrShow[];
  onPlayClick: (item: MovieOrShow) => void;
  onInfoClick: (item: MovieOrShow) => void;
  onTrailerClick?: (item: MovieOrShow) => void;
  isSaved?: (item: MovieOrShow) => boolean;
  onToggleSave?: (item: MovieOrShow) => void;
}

export default function Hero({ trendingItems, onPlayClick, onInfoClick, isSaved, onToggleSave }: HeroProps) {
  const items = trendingItems.slice(0, 6);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setCurrentIndex((index) => (index + 1) % items.length), 9000);
    return () => window.clearInterval(timer);
  }, [items.length]);

  useEffect(() => {
    if (currentIndex >= items.length) setCurrentIndex(0);
  }, [currentIndex, items.length]);

  if (!items.length) {
    return <div className="noir-cinema-hero noir-cinema-hero--loading shimmer-bg" />;
  }

  const activeItem = items[currentIndex];
  const saved = isSaved?.(activeItem) ?? false;
  const image = getBackdropUrl((activeItem as any).backdrop_path) || activeItem.backdrop || activeItem.poster || '';
  const genres = Array.isArray(activeItem.genres) ? activeItem.genres.slice(0, 2) : [];
  const goTo = (direction: number) => setCurrentIndex((index) => (index + direction + items.length) % items.length);

  return (
    <section className="noir-cinema-hero" aria-label="العرض المميز">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${activeItem.type}-${activeItem.id}`}
          className="noir-cinema-hero-slide"
          initial={{ opacity: 0.2 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <img src={image} alt="" referrerPolicy="no-referrer" fetchPriority="high" decoding="async" />
          <div className="noir-cinema-hero-vignette" />
          <div className="noir-cinema-hero-bottom" />

          <motion.div
            className="noir-cinema-hero-content"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="noir-cinema-kicker">عرض مختار لك</div>
            <h1 className="noir-cinema-title-lockup">
              <TitleLogo
                type={activeItem.type}
                id={activeItem.id}
                title={activeItem.title}
                className="noir-cinema-title-logo"
                fallbackClassName="noir-cinema-title-text"
              />
            </h1>
            <div className="noir-cinema-meta">
              {activeItem.rating > 0 && <span><Star className="h-3.5 w-3.5 fill-[#A0C9CB] text-[#A0C9CB]" />{activeItem.rating.toFixed(1)}</span>}
              {activeItem.year && <span>{activeItem.year}</span>}
              <span>{activeItem.type === 'movie' ? 'فيلم' : 'مسلسل'}</span>
              {genres.map((genre) => <span key={genre}>{genre}</span>)}
            </div>
            {activeItem.overview && <p>{activeItem.overview}</p>}
            <div className="noir-cinema-actions">
              <button type="button" className="noir-cinema-play" onClick={() => onPlayClick(activeItem)}>
                <Play className="h-4 w-4 fill-current" />
                <span>تشغيل</span>
              </button>
              <button type="button" className="noir-cinema-info" onClick={() => onInfoClick(activeItem)}>
                <Info className="h-4 w-4" />
                <span>معلومات أكثر</span>
              </button>
              {onToggleSave && (
                <button type="button" className={`noir-cinema-save ${saved ? 'is-saved' : ''}`} onClick={() => onToggleSave(activeItem)} aria-label={saved ? 'إزالة من قائمتي' : 'إضافة إلى قائمتي'}>
                  {saved ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                </button>
              )}
            </div>
          </motion.div>

          <div className="noir-cinema-badges">
            <span>{activeItem.type === 'movie' ? 'فيلم' : 'مسلسل'}</span>
            {activeItem.rating >= 8 && <span>الأكثر مشاهدة</span>}
          </div>
        </motion.div>
      </AnimatePresence>

      {items.length > 1 && (
        <>
          <button type="button" className="noir-cinema-arrow is-right" onClick={() => goTo(-1)} aria-label="السابق"><ChevronRight /></button>
          <button type="button" className="noir-cinema-arrow is-left" onClick={() => goTo(1)} aria-label="التالي"><ChevronLeft /></button>
          <div className="noir-cinema-dots">
            {items.map((item, index) => (
              <button
                type="button"
                key={`${item.type}-${item.id}`}
                className={index === currentIndex ? 'is-active' : ''}
                onClick={() => setCurrentIndex(index)}
                aria-label={`العرض ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
