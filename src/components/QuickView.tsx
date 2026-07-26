import { useEffect } from 'react';
import { Check, Info, Play, Plus, Star, X } from 'lucide-react';
import { MovieOrShow } from '../types';

interface QuickViewProps {
  item: MovieOrShow | null;
  saved: boolean;
  onClose: () => void;
  onPlay: (item: MovieOrShow) => void;
  onDetails: (item: MovieOrShow) => void;
  onToggleSave: (item: MovieOrShow) => void;
}

export default function QuickView({
  item,
  saved,
  onClose,
  onPlay,
  onDetails,
  onToggleSave,
}: QuickViewProps) {
  useEffect(() => {
    if (!item) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [item, onClose]);

  if (!item) return null;

  const image = item.backdrop || item.poster;

  return (
    <div
      className="fixed inset-0 z-[420] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-view-title"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        dir="rtl"
        className="relative w-full sm:max-w-3xl max-h-[92dvh] overflow-y-auto bg-[#151518] border border-white/10 rounded-t-[28px] sm:rounded-[28px] shadow-[0_30px_100px_rgba(0,0,0,.7)] animate-pop-in"
      >
        <div className="sm:hidden flex justify-center pt-2.5">
          <span className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="relative aspect-[16/9] min-h-[220px] overflow-hidden sm:rounded-t-[28px] bg-stone-950">
          {image ? (
            <img
              src={image}
              alt=""
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-stone-800 to-black" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#151518] via-black/20 to-black/15" />

          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 left-3 noir-icon-button bg-black/50 cursor-pointer"
            aria-label="إغلاق المعاينة"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute inset-x-0 bottom-0 px-5 sm:px-8 pb-5 sm:pb-7">
            <h2 id="quick-view-title" className="text-2xl sm:text-4xl font-bold text-white leading-tight line-clamp-2">
              {item.title}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2.5 text-xs sm:text-sm text-white/70">
              {item.rating > 0 && (
                <span className="inline-flex items-center gap-1 text-[#ffd60a] font-semibold">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  {item.rating.toFixed(1)}
                </span>
              )}
              {item.year && <span>{item.year}</span>}
              <span>{item.type === 'movie' ? 'فيلم' : 'مسلسل'}</span>
              {item.genres.slice(0, 2).map((genre) => (
                <span key={genre} className="rounded-full bg-white/10 px-2.5 py-1 text-white/80">
                  {genre}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 sm:px-8 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-8">
          <p className="text-sm sm:text-base text-white/68 leading-7 line-clamp-3">
            {item.overview || 'شاهد التفاصيل الكاملة ومعلومات العمل.'}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onPlay(item)}
              className="noir-button-primary inline-flex items-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              المشاهدة الآن
            </button>

            <button
              type="button"
              onClick={() => onDetails(item)}
              className="noir-button-secondary inline-flex items-center gap-2 cursor-pointer"
            >
              <Info className="w-4 h-4" />
              التفاصيل
            </button>

            <button
              type="button"
              onClick={() => onToggleSave(item)}
              className={`noir-icon-button cursor-pointer ${saved ? '!bg-white !text-black' : ''}`}
              aria-label={saved ? 'إزالة من قائمتي' : 'إضافة إلى قائمتي'}
              aria-pressed={saved}
            >
              {saved ? <Check className="w-5 h-5" strokeWidth={3} /> : <Plus className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
