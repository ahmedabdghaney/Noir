/**
 * Sidebar — Apple TV style
 */

import { Home, Film, Tv, Bookmark, Search, ChevronLeft } from 'lucide-react';
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

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active: boolean;
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

  const navItems: NavItem[] = [
    {
      id: 'search',
      label: 'البحث',
      icon: <Search className="w-[18px] h-[18px]" />,
      onClick: openSearchOverlay,
      active: false,
    },
    {
      id: 'home',
      label: 'الرئيسية',
      icon: <Home className="w-[18px] h-[18px]" />,
      onClick: goHome,
      active: activeView === 'home',
    },
    {
      id: 'movies',
      label: 'الأفلام',
      icon: <Film className="w-[18px] h-[18px]" />,
      onClick: () => setSearchMode('movie'),
      active: activeView === 'search' && searchMode === 'movie',
    },
    {
      id: 'tv',
      label: 'المسلسلات',
      icon: <Tv className="w-[18px] h-[18px]" />,
      onClick: () => setSearchMode('tv'),
      active: activeView === 'search' && searchMode === 'tv',
    },
    {
      id: 'watchlist',
      label: 'قائمتي',
      icon: <Bookmark className="w-[18px] h-[18px]" />,
      onClick: onViewWatchlist,
      active: activeView === 'watchlist',
    },
  ];

  return (
    <aside className="hidden md:flex flex-col fixed right-0 top-0 bottom-0 w-52 z-[180] border-l border-white/[0.06] bg-[#141417]"
      style={{ direction: 'rtl' }}
    >
      {/* Logo */}
      <div
        onClick={goHome}
        className="flex items-center gap-2.5 px-5 py-5 cursor-pointer select-none"
      >
        <LogoIcon className="w-5 h-5 text-red-500 shrink-0" />
        <span className="text-white font-bold text-base tracking-tight">نوار</span>
        <span className="text-stone-500 font-normal text-[10px] bg-white/5 px-1.5 py-0.5 rounded mr-auto">سينما</span>
      </div>

      {/* Divider */}
      <div className="h-px bg-white/[0.06] mx-4" />

      {/* Nav Items */}
      <nav className="flex flex-col gap-0.5 px-2.5 pt-3 flex-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={item.onClick}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer w-full text-right ${
              item.active
                ? 'bg-white/10 text-white'
                : item.id === 'search'
                ? 'text-stone-400 hover:text-white hover:bg-white/5'
                : 'text-stone-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className={item.active ? 'text-white' : 'text-stone-500'}>
              {item.icon}
            </span>
            <span>{item.label}</span>
            {item.id === 'search' && (
              <span className="mr-auto text-[10px] text-stone-600 bg-white/5 px-1.5 py-0.5 rounded font-mono">⌘K</span>
            )}
          </button>
        ))}
      </nav>

      {/* Divider */}
      <div className="h-px bg-white/[0.06] mx-4 mb-3" />

      {/* User Profile */}
      {user && (
        <button
          onClick={onOpenProfile}
          className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-white/5 transition-colors"
        >
          <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center bg-indigo-600 shrink-0">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-white font-bold text-[10px] uppercase">{user.name.slice(0, 2)}</span>
            )}
          </div>
          <div className="flex-1 min-w-0 text-right">
            <p className="text-xs text-white font-medium truncate">{user.name}</p>
            <p className="text-[10px] text-stone-500 truncate">الملف الشخصي</p>
          </div>
          <ChevronLeft className="w-3.5 h-3.5 text-stone-600 shrink-0" />
        </button>
      )}
    </aside>
  );
}
