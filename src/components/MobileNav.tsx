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
      className="lg:hidden fixed bottom-0 left-0 right-0 z-[200] bg-[#141417]/95 backdrop-blur-xl border-t border-white/8 flex items-start justify-around px-1 selection:bg-transparent noir-mobile-nav"
      dir="rtl"
    >
      
      {/* Home Button */}
      <button
        onClick={goHome}
        className={`flex flex-col items-center justify-center gap-1 flex-1 h-16 py-1 text-center transition-all cursor-pointer ${
          activeView === 'home' ? 'text-white' : 'text-gray-500'
        }`}
        aria-current={activeView === 'home' ? 'page' : undefined}
      >
        <Home className="w-5 h-5 transition-transform" />
        <span className="text-[11px] font-semibold leading-none">الرئيسية</span>
      </button>

      {/* Search Button */}
      <button
        onClick={openSearchOverlay}
        className={`flex flex-col items-center justify-center gap-1 flex-1 h-16 py-1 text-center transition-all cursor-pointer ${
          isSearchOpen ? 'text-white' : 'text-gray-500 hover:text-white'
        }`}
        aria-current={isSearchOpen ? 'page' : undefined}
      >
        <Search className="w-5 h-5 transition-transform" />
        <span className="text-[11px] font-semibold leading-none">البحث</span>
      </button>

      {/* My List / Watchlist Button */}
      <button
        onClick={onViewWatchlist}
        className={`flex flex-col items-center justify-center gap-1 flex-1 h-16 py-1 text-center transition-all cursor-pointer ${
          activeView === 'watchlist' ? 'text-white' : 'text-gray-500'
        }`}
        aria-current={activeView === 'watchlist' ? 'page' : undefined}
      >
        <Bookmark className="w-5 h-5 transition-transform" />
        <span className="text-[11px] font-semibold leading-none">قائمتي</span>
      </button>

      {/* Profile Button */}
      <button
        onClick={onOpenProfile}
        className="flex flex-col items-center justify-center gap-1 flex-1 h-16 py-1 text-center transition-all cursor-pointer text-gray-500 hover:text-white"
      >
        <CircleUserRound className="w-5 h-5 transition-transform" />
        <span className="text-[11px] font-semibold leading-none">حسابي</span>
      </button>

    </nav>
  );
}
