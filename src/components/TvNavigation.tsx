import { Bookmark, Film, Home, Search, Tv } from 'lucide-react';
import LogoIcon from './LogoIcon';

interface TvNavigationProps {
  activeView: string;
  searchMode: 'movie' | 'tv';
  goHome: () => void;
  openSearch: () => void;
  setSearchMode: (mode: 'movie' | 'tv') => void;
  openWatchlist: () => void;
  user: { name: string; photoURL?: string } | null;
  openProfile: () => void;
}

export default function TvNavigation({
  activeView,
  searchMode,
  goHome,
  openSearch,
  setSearchMode,
  openWatchlist,
  user,
  openProfile,
}: TvNavigationProps) {
  const items = [
    { key: 'home', label: 'الرئيسية', icon: Home, active: activeView === 'home', action: goHome },
    { key: 'movies', label: 'الأفلام', icon: Film, active: activeView === 'search' && searchMode === 'movie', action: () => setSearchMode('movie') },
    { key: 'tv', label: 'المسلسلات', icon: Tv, active: activeView === 'search' && searchMode === 'tv', action: () => setSearchMode('tv') },
    { key: 'watchlist', label: 'قائمتي', icon: Bookmark, active: activeView === 'watchlist', action: openWatchlist },
  ];

  return (
    <header className="noir-tv-navigation fixed inset-x-0 top-0 z-[210] h-[5.75rem] border-b border-white/8 bg-[#09090b]/92 backdrop-blur-2xl" dir="rtl">
      <div className="mx-auto flex h-full max-w-[112rem] items-center gap-8 px-[3.5vw]">
        <button
          type="button"
          onClick={goHome}
          className="flex shrink-0 items-center gap-3 rounded-2xl px-3 py-2 text-white"
          aria-label="نوار — الرئيسية"
        >
          <LogoIcon className="h-8 w-8 text-red-500" />
          <span className="font-display text-2xl font-bold">نوار</span>
        </button>

        <nav className="flex flex-1 items-center gap-2" aria-label="التنقل الرئيسي">
          {items.map(({ key, label, icon: Icon, active, action }) => (
            <button
              key={key}
              type="button"
              onClick={action}
              className={`flex min-h-12 items-center gap-2.5 rounded-2xl px-5 text-base font-semibold ${
                active ? 'bg-white text-black' : 'text-white/65 hover:bg-white/8 hover:text-white'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </nav>

        <button
          type="button"
          onClick={openSearch}
          className="flex min-h-12 min-w-[13rem] items-center justify-between gap-5 rounded-2xl border border-white/12 bg-white/7 px-5 text-white/65"
          aria-label="فتح البحث"
        >
          <span className="text-base font-semibold">ابحث عن عنوان</span>
          <Search className="h-5 w-5" />
        </button>

        {user && (
          <button
            type="button"
            onClick={openProfile}
            className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/12 bg-white/8"
            aria-label="فتح الملف الشخصي"
          >
            {user.photoURL
              ? <img src={user.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              : <span className="text-sm font-bold text-white">{user.name.slice(0, 2)}</span>}
          </button>
        )}
      </div>
    </header>
  );
}
