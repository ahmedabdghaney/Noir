import { Bookmark, Film, Home, Search, Tv } from 'lucide-react';
import LogoIcon from './LogoIcon';

interface TvNavigationProps {
  activeView: string;
  searchMode: 'movie' | 'tv';
  isSearchOpen: boolean;
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
  isSearchOpen,
  goHome,
  openSearch,
  setSearchMode,
  openWatchlist,
  user,
  openProfile,
}: TvNavigationProps) {
  const items = [
    { key: 'search', label: 'البحث', icon: Search, active: isSearchOpen, action: openSearch },
    { key: 'home', label: 'الرئيسية', icon: Home, active: !isSearchOpen && activeView === 'home', action: goHome },
    { key: 'movies', label: 'الأفلام', icon: Film, active: !isSearchOpen && activeView === 'search' && searchMode === 'movie', action: () => setSearchMode('movie') },
    { key: 'tv', label: 'المسلسلات', icon: Tv, active: !isSearchOpen && activeView === 'search' && searchMode === 'tv', action: () => setSearchMode('tv') },
    { key: 'watchlist', label: 'قائمتي', icon: Bookmark, active: !isSearchOpen && activeView === 'watchlist', action: openWatchlist },
  ];

  return (
    <aside
      data-tv-navigation
      className="noir-tv-navigation pointer-events-none fixed inset-x-0 top-0 z-[210] h-24 border-b border-white/[0.04] bg-[#17171a]/95 px-[3vw] backdrop-blur-2xl"
      dir="rtl"
    >
      <div
        className="pointer-events-none absolute right-[3vw] top-1/2 flex items-center gap-2 text-white"
        style={{ transform: 'translateY(-50%)' }}
        aria-hidden="true"
      >
          <LogoIcon className="h-7 w-7 shrink-0 text-red-500" />
          <span className="whitespace-nowrap font-display text-2xl font-bold">نوار</span>
      </div>

      <nav
        className="noir-tv-top-navigation pointer-events-auto absolute flex items-center gap-1 rounded-full border border-white/15 bg-[#08080a] p-2"
        style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
        aria-label="التنقل الرئيسي"
      >
          {items.map(({ key, label, icon: Icon, active, action }) => (
            <button
              key={key}
              type="button"
              onClick={action}
              data-tv-nav-item={key}
              className={`flex h-12 items-center gap-2 rounded-full px-5 text-sm font-semibold ${
                active ? 'bg-white text-black' : 'text-white/58 hover:bg-white/8 hover:text-white'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="whitespace-nowrap">{label}</span>
            </button>
          ))}
      </nav>

        {user && (
          <button
            type="button"
            onClick={openProfile}
            data-tv-nav-item="profile"
            className="pointer-events-auto absolute left-[3vw] top-1/2 flex h-12 w-12 items-center justify-center rounded-full text-white/70"
            style={{ transform: 'translateY(-50%)' }}
            aria-label="فتح الملف الشخصي"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/8">
              {user.photoURL
                ? <img src={user.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                : <span className="text-sm font-bold text-white">{user.name.slice(0, 2)}</span>}
            </span>
          </button>
        )}
    </aside>
  );
}
