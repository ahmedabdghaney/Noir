import { CheckCircle2, Clock3, Play, Trash2 } from 'lucide-react';
import { ViewingHistoryItem } from '../types';

interface ViewingHistoryPageProps {
  items: ViewingHistoryItem[];
  onItemClick: (item: ViewingHistoryItem) => void;
  onRemove: (item: ViewingHistoryItem) => void;
}

export default function ViewingHistoryPage({
  items,
  onItemClick,
  onRemove,
}: ViewingHistoryPageProps) {
  const isTvApp = document.documentElement.classList.contains('noir-tv-app');
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in" dir="ltr">
      <div className="flex items-end justify-between gap-4 border-b border-white/5 pb-6 mb-8">
        <div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">
            Watch history
          </h1>
          <p className="mt-2 text-sm text-white/45">
            Titles you finished or started watching, synced across your devices.
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="min-h-[320px] rounded-[26px] border border-white/8 bg-black/15 flex flex-col items-center justify-center text-center p-8">
          <Clock3 className="w-10 h-10 text-white/20" />
          <h2 className="mt-4 text-lg font-bold text-white">Your watch history is empty</h2>
          <p className="mt-2 text-sm text-white/45">Start watching any movie or show and it will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-2">
          {items.map((item) => (
            <article key={`${item.type}_${item.id}`} className="group relative min-w-0">
              <button
                type="button"
                onClick={() => onItemClick(item)}
                data-tv-card={isTvApp ? '' : undefined}
                className="block w-full text-left cursor-pointer"
              >
                <div data-tv-card-artwork={isTvApp ? '' : undefined} className="relative aspect-video overflow-hidden rounded-sm bg-black border border-white/[0.06]">
                  {item.backdrop || item.poster ? (
                    <img
                      src={item.backdrop || item.poster || undefined}
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
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                  <div className="absolute bottom-3 right-3 left-3">
                    <h2 className="mb-1 text-sm font-bold text-white line-clamp-1">{item.title}</h2>
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-white/80">
                      {item.completed ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          Completed
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
              </button>
              <button
                type="button"
                onClick={() => onRemove(item)}
                className="absolute top-2 left-2 w-9 h-9 rounded-full bg-black/65 backdrop-blur-md border border-white/10 text-white/75 hover:text-white flex items-center justify-center cursor-pointer opacity-100 md:opacity-0 md:group-hover:opacity-100"
                aria-label={`Delete ${item.title} from watch history`}
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
