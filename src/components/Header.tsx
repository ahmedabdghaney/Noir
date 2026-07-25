/**
 * Mobile top bar — compact Apple TV style.
 */

import { Search } from 'lucide-react';
import LogoIcon from './LogoIcon';

interface HeaderProps {
  activeView: 'home' | 'search' | 'detail' | 'watchlist' | 'category' | 'studio' | 'admin';
  searchMode: 'movie' | 'tv';
  setSearchMode: (mode: 'movie' | 'tv') => void;
  goHome: () => void;
  openSearchOverlay: () => void;
  user: { name: string; email?: string; photoURL?: string; type: 'guest' | 'google' | 'email' } | null;
  onLogout: () => void;
  onOpenProfile: () => void;
  onViewWatchlist: () => void;
}

export default function Header({
  goHome,
  openSearchOverlay,
  user,
  onOpenProfile,
}: HeaderProps) {
  return (
    <header className="fixed top-0 inset-x-0 z-[200] h-16 px-4 flex items-center justify-between bg-[#0b0b0e]/82 border-b border-white/[0.08] backdrop-blur-2xl supports-[backdrop-filter]:bg-[#0b0b0e]/68">
      <button
        onClick={goHome}
        className="h-11 inline-flex items-center gap-2.5 rounded-full text-white"
        aria-label="العودة إلى الرئيسية"
      >
        <span className="w-8 h-8 rounded-[10px] bg-[#ff453a] flex items-center justify-center shadow-[0_8px_24px_-10px_rgba(255,69,58,0.9)]">
          <LogoIcon className="w-[18px] h-[18px] text-white" />
        </span>
        <span className="font-display text-base font-bold">نوار</span>
      </button>

      <div className="flex items-center gap-2">
        <button
          onClick={openSearchOverlay}
          className="noir-icon-button !w-10 !min-w-10 !min-h-10"
          aria-label="فتح البحث"
        >
          <Search className="w-[18px] h-[18px]" />
        </button>

        <button
          onClick={onOpenProfile}
          className="w-10 h-10 rounded-full border border-white/12 bg-white/[0.07] overflow-hidden flex items-center justify-center"
          aria-label="فتح الملف الشخصي"
        >
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="text-[11px] text-white font-bold">
              {(user?.name || 'نوار').slice(0, 2)}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
