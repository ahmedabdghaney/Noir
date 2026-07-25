/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Home, Compass, Search, Bookmark } from 'lucide-react';

interface MobileNavProps {
  activeView: 'home' | 'search' | 'detail' | 'watchlist' | 'category' | 'studio' | 'admin';
  searchMode: 'movie' | 'tv';
  setSearchMode: (mode: 'movie' | 'tv') => void;
  goHome: () => void;
  openSearchOverlay: () => void;
  onViewWatchlist: () => void;
}

export default function MobileNav({
  activeView,
  searchMode,
  setSearchMode,
  goHome,
  openSearchOverlay,
  onViewWatchlist,
}: MobileNavProps) {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-[200] h-[68px] bg-[#0b0b0e]/88 backdrop-blur-2xl border-t border-white/[0.08] flex items-center justify-around px-2 selection:bg-transparent safe-bottom" aria-label="التنقل الرئيسي">
      
      {/* Home Button */}
      <button
        onClick={goHome}
        aria-current={activeView === 'home' ? 'page' : undefined}
        className={`flex flex-col items-center justify-center gap-1 flex-1 h-full py-1 text-center transition-colors cursor-pointer ${
          activeView === 'home' ? 'text-white' : 'text-white/35'
        }`}
      >
        <Home className="w-5 h-5 transition-transform" />
        <span className="text-[10px] font-bold leading-none">الرئيسية</span>
      </button>

      {/* Browse Button */}
      <button
        onClick={() => {
          setSearchMode(searchMode);
        }}
        aria-current={activeView === 'search' ? 'page' : undefined}
        className={`flex flex-col items-center justify-center gap-1 flex-1 h-full py-1 text-center transition-colors cursor-pointer ${
          activeView === 'search' ? 'text-white' : 'text-white/35'
        }`}
      >
        <Compass className="w-5 h-5 transition-transform" />
        <span className="text-[11px] font-semibold leading-none">استكشف</span>
      </button>

      {/* Search Button */}
      <button
        onClick={openSearchOverlay}
        className="flex flex-col items-center justify-center gap-1 flex-1 h-full py-1 text-center transition-colors cursor-pointer text-white/35 hover:text-white"
      >
        <Search className="w-5 h-5 transition-transform" />
        <span className="text-[11px] font-semibold leading-none">البحث</span>
      </button>

      {/* My List / Watchlist Button */}
      <button
        onClick={onViewWatchlist}
        aria-current={activeView === 'watchlist' ? 'page' : undefined}
        className={`flex flex-col items-center justify-center gap-1 flex-1 h-full py-1 text-center transition-colors cursor-pointer ${
          activeView === 'watchlist' ? 'text-white' : 'text-white/35'
        }`}
      >
        <Bookmark className="w-5 h-5 transition-transform" />
        <span className="text-[11px] font-semibold leading-none">قائمتي</span>
      </button>

    </nav>
  );
}
