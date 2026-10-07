/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Home, Search, Bookmark, CircleUserRound } from 'lucide-react';

interface MobileNavProps {
  activeView: string;
  goHome: () => void;
  openSearchOverlay: () => void;
  onViewWatchlist: () => void;
  isSearchOpen: boolean;
  onOpenProfile: () => void;
}

export default function MobileNav({
  activeView,
  goHome,
  openSearchOverlay,
  onViewWatchlist,
  isSearchOpen,
  onOpenProfile,
}: MobileNavProps) {
  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="fixed bottom-3 left-3 right-3 z-[200] flex h-[62px] items-center justify-around rounded-[20px] border border-white/[0.09] bg-[#0b0c0f]/92 px-1 shadow-[0_20px_48px_-20px_black] backdrop-blur-2xl selection:bg-transparent lg:hidden"
      dir="rtl"
    >
      
      {/* Home Button */}
      <button
        onClick={goHome}
        className={`flex h-12 flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-[14px] py-1 text-center transition-all ${
          activeView === 'home' ? 'bg-white/[0.07] text-red-400' : 'text-gray-500'
        }`}
        aria-current={activeView === 'home' ? 'page' : undefined}
      >
        <Home className="w-5 h-5 transition-transform" />
        <span className="text-[11px] font-semibold leading-none">الرئيسية</span>
      </button>

      {/* Search Button */}
      <button
        onClick={openSearchOverlay}
        className={`flex h-12 flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-[14px] py-1 text-center transition-all ${
          isSearchOpen ? 'bg-white/[0.07] text-red-400' : 'text-gray-500 hover:text-white'
        }`}
        aria-current={isSearchOpen ? 'page' : undefined}
      >
        <Search className="w-5 h-5 transition-transform" />
        <span className="text-[11px] font-semibold leading-none">البحث</span>
      </button>

      {/* My List / Watchlist Button */}
      <button
        onClick={onViewWatchlist}
        className={`flex h-12 flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-[14px] py-1 text-center transition-all ${
          activeView === 'watchlist' ? 'bg-white/[0.07] text-red-400' : 'text-gray-500'
        }`}
        aria-current={activeView === 'watchlist' ? 'page' : undefined}
      >
        <Bookmark className="w-5 h-5 transition-transform" />
        <span className="text-[11px] font-semibold leading-none">قائمتي</span>
      </button>

      {/* Profile Button */}
      <button
        onClick={onOpenProfile}
        className="flex h-12 flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-[14px] py-1 text-center text-gray-500 transition-all hover:bg-white/[0.05] hover:text-white"
      >
        <CircleUserRound className="w-5 h-5 transition-transform" />
        <span className="text-[11px] font-semibold leading-none">حسابي</span>
      </button>

    </nav>
  );
}
