import { Bookmark, Film, Home, Search, Tv, UserRound } from 'lucide-react';
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
  const items = [
    { id: 'home', label: 'الرئيسية', icon: Home, active: activeView === 'home', action: goHome },
    { id: 'movies', label: 'الأفلام', icon: Film, active: activeView === 'search' && searchMode === 'movie', action: () => setSearchMode('movie') },
    { id: 'tv', label: 'المسلسلات', icon: Tv, active: activeView === 'search' && searchMode === 'tv', action: () => setSearchMode('tv') },
    { id: 'watchlist', label: 'قائمتي', icon: Bookmark, active: activeView === 'watchlist', action: onViewWatchlist },
  ];

  return (
    <header className="noir-site-header" dir="rtl">
      <div className="noir-site-header-inner">
        <button type="button" onClick={goHome} className="noir-site-brand" aria-label="العودة إلى الرئيسية">
          <LogoIcon className="h-8 w-8 text-[#ed1c24]" />
          <span>نوار</span>
        </button>

        <nav className="noir-site-nav" aria-label="التنقل الرئيسي">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.action}
                className={item.active ? 'is-active' : ''}
                aria-current={item.active ? 'page' : undefined}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="noir-site-actions">
          <button type="button" onClick={openSearchOverlay} aria-label="البحث">
            <Search className="h-5 w-5" />
          </button>
          {user && (
            <button type="button" onClick={onOpenProfile} aria-label="فتح الملف الشخصي">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.name} referrerPolicy="no-referrer" />
              ) : (
                <UserRound className="h-5 w-5" />
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
