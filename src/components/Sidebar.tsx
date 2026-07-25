/**
 * Sidebar — Apple TV style
 */

import type { ReactNode } from 'react';
import { Home, Compass, Bookmark, Search, ChevronLeft } from 'lucide-react';
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
  icon: ReactNode;
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
      id: 'home',
      label: 'الرئيسية',
      icon: <Home className="w-[18px] h-[18px]" />,
      onClick: goHome,
      active: activeView === 'home',
    },
    {
      id: 'browse',
      label: 'استكشف',
      icon: <Compass className="w-[18px] h-[18px]" />,
      onClick: () => setSearchMode(searchMode),
      active: activeView === 'search',
    },
    {
      id: 'watchlist',
      label: 'قائمتي',
      icon: <Bookmark className="w-[18px] h-[18px]" />,
      onClick: onViewWatchlist,
      active: activeView === 'watchlist',
    },
    {
      id: 'search',
      label: 'البحث',
      icon: <Search className="w-[18px] h-[18px]" />,
      onClick: openSearchOverlay,
      active: false,
    },
  ];

  return (
    <aside className="hidden lg:flex flex-col fixed right-0 top-0 bottom-0 w-56 z-[180] border-l border-white/[0.08] bg-[#0d0d10]/88 backdrop-blur-2xl"
      style={{ direction: 'rtl' }}
    >
      {/* Logo */}
      <button
        onClick={goHome}
        className="flex items-center gap-3 px-5 py-5 cursor-pointer select-none text-right"
        aria-label="نوار سينما — الرئيسية"
      >
        <span className="w-9 h-9 rounded-xl bg-[#ff453a] flex items-center justify-center shadow-[0_10px_28px_-12px_rgba(255,69,58,0.9)]">
          <LogoIcon className="w-5 h-5 text-white shrink-0" />
        </span>
        <span>
          <span className="block text-white font-bold text-base tracking-tight">نوار</span>
          <span className="block text-white/40 font-medium text-[11px]">سينما</span>
        </span>
      </button>

      {/* Divider */}
      <div className="h-px bg-white/[0.06] mx-4" />

      {/* Nav Items */}
      <nav className="flex flex-col gap-1 px-3 pt-4 flex-1" aria-label="التنقل الرئيسي">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={item.onClick}
            aria-current={item.active ? 'page' : undefined}
            className={`flex min-h-11 items-center gap-3 px-3.5 py-2.5 rounded-[14px] text-sm font-semibold transition-colors cursor-pointer w-full text-right ${
              item.active
                ? 'bg-white text-black shadow-[0_10px_30px_-16px_rgba(255,255,255,0.85)]'
                : 'text-white/55 hover:text-white hover:bg-white/[0.08]'
            }`}
          >
            <span className={item.active ? 'text-black' : 'text-white/45'}>
              {item.icon}
            </span>
            <span>{item.label}</span>
            {item.id === 'search' && (
              <span className="mr-auto text-[10px] text-white/35 bg-white/[0.06] px-1.5 py-0.5 rounded-md font-mono">⌘K</span>
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
          className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-white/[0.06] transition-colors text-right"
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
            <p className="text-xs text-white/40 truncate">{user.type === 'guest' ? 'تصفح كضيف' : 'الملف الشخصي'}</p>
          </div>
          <ChevronLeft className="w-3.5 h-3.5 text-stone-600 shrink-0" />
        </button>
      )}
    </aside>
  );
}
