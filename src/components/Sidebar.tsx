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
      className={`hidden lg:flex fixed inset-x-0 top-0 z-[220] h-[68px] items-center transition-[background-color,box-shadow] duration-300 ${
        scrolled
          ? 'bg-[#070707]/96 shadow-[0_12px_34px_-24px_rgba(0,0,0,1)] backdrop-blur-xl'
          : 'bg-gradient-to-b from-black/90 via-black/55 to-transparent'
      }`}
      dir="rtl"
    >
      <div className="flex w-full items-center gap-8 px-5 xl:px-12">
        <button
          type="button"
          onClick={goHome}
          className="group flex min-h-11 shrink-0 items-center gap-2 text-white"
          aria-label="العودة إلى الرئيسية"
        >
          <LogoIcon className="h-7 w-7 text-red-600 transition-transform group-hover:scale-105" />
          <span className="text-2xl font-black tracking-[-0.04em] text-red-600">نوار</span>
        </button>

        <nav className="flex items-center gap-1" aria-label="التنقل الرئيسي">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.action}
              className={`relative min-h-11 px-3 text-sm transition-colors ${
                item.active ? 'font-bold text-white' : 'font-medium text-white/68 hover:text-white'
              }`}
              aria-current={item.active ? 'page' : undefined}
            >
              {item.label}
              {item.active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-red-600" />}
            </button>
          ))}
        </nav>

        <div className="mr-auto flex items-center gap-2">
          <button
            type="button"
            onClick={openSearchOverlay}
            className="flex h-10 w-10 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="البحث"
          >
            <Search className="h-5 w-5" />
          </button>

          {user && (
            <button
              type="button"
              onClick={onOpenProfile}
              className="group flex min-h-11 items-center gap-2 rounded-md px-1.5 text-white/85 hover:text-white"
              aria-label="فتح الملف الشخصي"
            >
              <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded bg-red-700 text-[10px] font-bold uppercase ring-1 ring-white/10 group-hover:ring-white/30">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                ) : user.name.slice(0, 2)}
              </span>
              <span className="hidden max-w-28 truncate text-xs xl:block">{user.name}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
