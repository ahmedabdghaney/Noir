import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import LogoIcon from './LogoIcon';

interface SidebarProps {
  activeView: string;
  searchMode: 'movie' | 'tv';
  setSearchMode: (mode: 'movie' | 'tv') => void;
  goHome: () => void;
  openSearchOverlay: () => void;
  onViewWatchlist: () => void;
  user: { name: string; photoURL?: string; type: string } | null;
  onOpenProfile: () => void;
}

export default function Sidebar({
  activeView,
  searchMode,
  setSearchMode,
  goHome,
  openSearchOverlay,
  onViewWatchlist,
  user,
  onOpenProfile,
}: SidebarProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 36);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  const items = [
    { id: 'home', label: 'الرئيسية', active: activeView === 'home', action: goHome },
    {
      id: 'movies', label: 'الأفلام',
      active: activeView === 'search' && searchMode === 'movie',
      action: () => setSearchMode('movie'),
    },
    {
      id: 'tv', label: 'المسلسلات',
      active: activeView === 'search' && searchMode === 'tv',
      action: () => setSearchMode('tv'),
    },
    { id: 'watchlist', label: 'قائمتي', active: activeView === 'watchlist', action: onViewWatchlist },
  ];

  return (
    <header
      className="pointer-events-none fixed inset-x-0 top-0 z-[220] hidden px-5 pt-4 lg:block xl:px-10"
      dir="rtl"
    >
      <div className={`pointer-events-auto mx-auto flex h-[60px] max-w-[1800px] items-center gap-7 rounded-[20px] border px-3.5 transition-all duration-300 xl:px-4 ${
        scrolled
          ? 'border-white/10 bg-[#0b0c0f]/88 shadow-[0_18px_48px_-24px_rgba(0,0,0,0.95)] backdrop-blur-2xl'
          : 'border-white/[0.08] bg-black/40 shadow-[0_16px_44px_-28px_black] backdrop-blur-xl'
      }`}>
        <button
          type="button"
          onClick={goHome}
          className="group flex min-h-11 shrink-0 items-center gap-2.5 px-1 text-white"
          aria-label="العودة إلى الرئيسية"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.065] transition-colors group-hover:bg-white/10">
            <LogoIcon className="h-5 w-5 text-[#00D6D9]" />
          </span>
          <span className="text-xl font-extrabold tracking-[-0.04em] text-white">نوار</span>
        </button>

        <nav className="flex items-center gap-1" aria-label="التنقل الرئيسي">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.action}
              className={`relative min-h-9 rounded-[11px] px-3.5 text-[13px] transition-all ${
                item.active
                  ? 'bg-white/[0.09] font-semibold text-white'
                  : 'font-medium text-white/55 hover:bg-white/[0.045] hover:text-white/90'
              }`}
              aria-current={item.active ? 'page' : undefined}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mr-auto flex items-center gap-2">
          <button
            type="button"
            onClick={openSearchOverlay}
            className="flex h-9 w-9 items-center justify-center rounded-[11px] text-white/65 hover:bg-white/[0.08] hover:text-white"
            aria-label="البحث"
          >
            <Search className="h-5 w-5" />
          </button>

          {user && (
            <button
              type="button"
              onClick={onOpenProfile}
              className="group flex h-9 w-9 items-center justify-center rounded-[11px] text-white/85 hover:bg-white/[0.08]"
              aria-label="فتح الملف الشخصي"
            >
              <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-[9px] bg-[#202126] text-[10px] font-bold uppercase ring-1 ring-white/10 group-hover:ring-white/25">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                ) : user.name.slice(0, 2)}
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
