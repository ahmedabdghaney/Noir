/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Home, Film, Tv, Search, Bookmark } from 'lucide-react';

interface MobileNavProps {
  activeView: 'home' | 'search' | 'detail' | 'watchlist';
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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[200] h-16 bg-neutral-950/90 backdrop-blur-xl border-t border-white/5 flex items-center justify-around px-1 selection:bg-transparent safe-bottom">
      
      {/* Home Button */}
      <button
        onClick={goHome}
        className={`flex flex-col items-center justify-center gap-1 flex-1 h-full py-1 text-center transition-all cursor-pointer ${
          activeView === 'home' ? 'text-white' : 'text-gray-500'
        }`}
      >
        <Home className="w-5 h-5 transition-transform active:scale-95" />
        <span className="text-[10px] font-bold leading-none">الرئيسية</span>
      </button>

      {/* Movies Button */}
      <button
        onClick={() => {
          setSearchMode('movie');
        }}
        className={`flex flex-col items-center justify-center gap-1 flex-1 h-full py-1 text-center transition-all cursor-pointer ${
          activeView === 'search' && searchMode === 'movie' ? 'text-white' : 'text-gray-500'
        }`}
      >
        <Film className="w-5 h-5 transition-transform active:scale-95" />
        <span className="text-[10px] font-bold leading-none">الأفلام</span>
      </button>

      {/* TV Series Button */}
      <button
        onClick={() => {
          setSearchMode('tv');
        }}
        className={`flex flex-col items-center justify-center gap-1 flex-1 h-full py-1 text-center transition-all cursor-pointer ${
          activeView === 'search' && searchMode === 'tv' ? 'text-white' : 'text-gray-500'
        }`}
      >
        <Tv className="w-5 h-5 transition-transform active:scale-95" />
        <span className="text-[10px] font-bold leading-none">المسلسلات</span>
      </button>

      {/* My List / Watchlist Button */}
      <button
        onClick={onViewWatchlist}
        className={`flex flex-col items-center justify-center gap-1 flex-1 h-full py-1 text-center transition-all cursor-pointer ${
          activeView === 'watchlist' ? 'text-white' : 'text-gray-500'
        }`}
      >
        <Bookmark className="w-5 h-5 transition-transform active:scale-95" />
        <span className="text-[10px] font-bold leading-none">قائمتي</span>
      </button>

      {/* Search Button */}
      <button
        onClick={openSearchOverlay}
        className="flex flex-col items-center justify-center gap-1 flex-1 h-full py-1 text-center transition-all cursor-pointer text-gray-500 hover:text-white"
      >
        <Search className="w-5 h-5 transition-transform active:scale-95" />
        <span className="text-[10px] font-bold leading-none">البحث</span>
      </button>

    </nav>
  );
}
