import { CheckCircle2, Clock3, Play, Trash2 } from 'lucide-react';
import { ViewingHistoryItem } from '../types';

interface ViewingHistoryPageProps {
  items: ViewingHistoryItem[];
  onItemClick: (item: ViewingHistoryItem) => void;
  onRemove: (item: ViewingHistoryItem) => void;
  onBack: () => void;
}

export default function ViewingHistoryPage({
  items,
  onItemClick,
  onRemove,
  onBack,
}: ViewingHistoryPageProps) {
  const isTvApp = document.documentElement.classList.contains('noir-tv-app');
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in" dir="rtl">
      <div className="flex items-end justify-between gap-4 border-b border-white/5 pb-6 mb-8">
        <div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">
            سجل المشاهدة
          </h1>
          <p className="mt-2 text-sm text-white/45">
            أعمالك المكتملة والتي بدأت مشاهدتها، متزامنة بين أجهزتك.
          </p>
        </div>
        {!isTvApp && <button type="button" onClick={onBack} className="noir-button-secondary cursor-pointer">
          الرئيسية
        </button>}
      </div>

      {items.length === 0 ? (
        <div className="min-h-[320px] rounded-[26px] border border-white/8 bg-black/15 flex flex-col items-center justify-center text-center p-8">
          <Clock3 className="w-10 h-10 text-white/20" />
          <h2 className="mt-4 text-lg font-bold text-white">سجل المشاهدة فارغ</h2>
          <p className="mt-2 text-sm text-white/45">ابدأ مشاهدة أي فيلم أو مسلسل وسيظهر هنا.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
          {items.map((item) => (
            <article key={`${item.type}_${item.id}`} className="group relative min-w-0">
              <button
                type="button"
                onClick={() => onItemClick(item)}
                data-tv-card={isTvApp ? '' : undefined}
                className="block w-full text-right cursor-pointer"
              >
                <div data-tv-card-artwork={isTvApp ? '' : undefined} className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-stone-900 border border-white/8">
                  {item.poster || item.backdrop ? (
                    <img
                      src={item.poster || item.backdrop || undefined}
                      alt={item.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-300 md:group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/30 p-3 text-center text-xs">
                      {item.title}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-3 right-3 left-3">
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-white/80">
                      {item.completed ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          مكتمل
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          {Math.round(item.progress)}%
                        </>
                      )}
                    </span>
                  </div>
                </div>
                <h2 className="mt-2.5 px-1 text-sm font-semibold text-white line-clamp-1">{item.title}</h2>
                <p className="mt-1 px-1 text-[11px] text-white/45">
                  {item.type === 'movie' ? 'فيلم' : `م${item.season} • ح${item.episode}`}
                </p>
              </button>
              <button
                type="button"
                onClick={() => onRemove(item)}
                className="absolute top-2 left-2 w-9 h-9 rounded-full bg-black/65 backdrop-blur-md border border-white/10 text-white/75 hover:text-white flex items-center justify-center cursor-pointer opacity-100 md:opacity-0 md:group-hover:opacity-100"
                aria-label={`حذف ${item.title} من سجل المشاهدة`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
