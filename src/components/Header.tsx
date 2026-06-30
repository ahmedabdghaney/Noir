/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Search, Menu, X } from 'lucide-react';
import LogoIcon from './LogoIcon';

interface HeaderProps {
  activeView: 'home' | 'search' | 'detail' | 'watchlist';
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
  activeView,
  searchMode,
  setSearchMode,
  goHome,
  openSearchOverlay,
  user,
  onLogout,
  onOpenProfile,
  onViewWatchlist,
}: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    }

    if (isProfileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileDropdownOpen]);

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-[200] h-14 flex items-center transition-all duration-300 ${
          isScrolled
            ?'backdrop-blur-2xl bg-[#0b0b0d]/70 border-b border-white/8 saturate-150'
            :'backdrop-blur-xl bg-gradient-to-b from-black/50 to-transparent border-b border-transparent'
        }`}
      >
        <div className="w-full px-4 md:px-12 grid grid-cols-3 items-center">
          {/* Left Column: Brand Logo & Desktop Nav Links */}
          <div className="flex items-center gap-6 justify-start text-right">
            <div
              onClick={goHome}
              className="flex items-center gap-2 cursor-pointer select-none text-white font-bold text-lg md:text-xl tracking-tight shrink-0"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key ==='Enter' && goHome()}
            >
              <LogoIcon className="w-5 h-5 text-red-500 shrink-0" />
              <span className="hidden sm:inline">نوار</span>
              <span className="text-gray-500 font-normal text-[10px] mr-1 bg-white/5 px-1.5 py-0.5 rounded">سينما</span>
</div>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-3 lg:gap-6 shrink-0">
              <button
                onClick={goHome}
                className={`text-xs lg:text-sm font-semibold transition-colors hover:text-white cursor-pointer select-none whitespace-nowrap ${
                    activeView ==='home' ?'text-white' :'text-gray-400'
                }`}
              >
                الرئيسية
</button>
              <button
                onClick={() => setSearchMode('movie')}
                className={`text-xs lg:text-sm font-semibold transition-colors hover:text-white cursor-pointer select-none whitespace-nowrap ${
                    activeView ==='search' && searchMode ==='movie' ?'text-white' :'text-gray-400'
                }`}
              >
                الأفلام
</button>
              <button
                onClick={() => setSearchMode('tv')}
                className={`text-xs lg:text-sm font-semibold transition-colors hover:text-white cursor-pointer select-none whitespace-nowrap ${
                    activeView ==='search' && searchMode ==='tv' ?'text-white' :'text-gray-400'
                }`}
              >
                المسلسلات
</button>
              <button
                onClick={onViewWatchlist}
                className={`text-xs lg:text-sm font-semibold transition-colors hover:text-white cursor-pointer select-none whitespace-nowrap ${
                    activeView ==='watchlist' ?'text-white' :'text-gray-400'
                }`}
              >
                قائمتي
</button>
</div>
</div>

          {/* Center Column: Centered Search bar trigger */}
          <div className="flex justify-center px-2">
            <button
              onClick={openSearchOverlay}
              className="glass flex items-center gap-2 hover:bg-white/10 px-3.5 py-2 rounded-full transition-all text-gray-300 hover:text-white text-xs cursor-pointer group w-full max-w-[180px] lg:max-w-[300px]"
            >
              <Search className="w-3.5 h-3.5 text-gray-400 group-hover:text-white transition-colors shrink-0" />
              <span className="truncate text-[10px] sm:text-xs">ابحث...</span>
            </button>
</div>

          {/* Right Column: User profile avatar with dropdown & mobile menu trigger */}
          <div className="flex items-center gap-3 justify-end text-left relative">
            {user && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className="w-8 h-8 rounded-full border border-white/10 hover:border-white/20 hover:scale-105 active:scale-95 transition-all overflow-hidden flex items-center justify-center bg-stone-900 cursor-pointer select-none"
                  title="خيارات الحساب"
                >
                  {user.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt={user.name} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-indigo-600 text-white font-bold text-[10px] uppercase">
                      {user.name.slice(0, 2)}
</div>
                  )}
</button>

                {isProfileDropdownOpen && (
                  <div className="absolute left-0 mt-2.5 w-48 bg-stone-950 border border-white/5 rounded-2xl shadow-2xl py-2 z-[250] text-right animate-pop-in">
                    <div className="px-4 py-2 border-b border-white/5">
                      <p className="text-[9px] text-gray-500 font-bold mb-0.5">تسجيل الدخول كـ</p>
                      <p className="text-xs text-white font-bold truncate leading-tight">{user.name}</p>
</div>

                    <div className="h-px bg-white/5 my-1" />

                    <button
                      onClick={() => {
                        onLogout();
                        setIsProfileDropdownOpen(false);
                      }}
                      className="w-full text-right px-4 py-2.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center gap-2 transition-colors cursor-pointer font-bold"
                    >
                      <span className="text-sm"></span>
                      <span>تسجيل الخروج</span>
</button>
</div>
                )}
</div>
            )}

            {/* Mobile Menu Toggle (only on smaller screens) */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden flex items-center justify-center p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer shrink-0"
              aria-label="قائمة الملاحة"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
</button>
</div>
</div>
</nav>

      {/* Mobile Navigation Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-y-0 right-0 left-0 top-14 bg-black/95 backdrop-blur-xl z-[150] flex flex-col p-6 animate-fade-in md:hidden border-t border-white/5">
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                goHome();
                setIsMobileMenuOpen(false);
              }}
              className={`flex items-center text-right text-lg font-medium py-3 px-4 rounded-xl transition-colors ${
                activeView ==='home' ?'bg-white/10 text-white font-semibold' :'text-gray-300 hover:bg-white/5'
              }`}
            >
              الرئيسية
</button>
            <button
              onClick={() => {
                setSearchMode('movie');
                setIsMobileMenuOpen(false);
              }}
              className={`flex items-center text-right text-lg font-medium py-3 px-4 rounded-xl transition-colors ${
                activeView ==='search' && searchMode ==='movie' ?'bg-white/10 text-white font-semibold' :'text-gray-300 hover:bg-white/5'
              }`}
            >
              الأفلام
</button>
            <button
              onClick={() => {
                setSearchMode('tv');
                setIsMobileMenuOpen(false);
              }}
              className={`flex items-center text-right text-lg font-medium py-3 px-4 rounded-xl transition-colors ${
                activeView ==='search' && searchMode ==='tv' ?'bg-white/10 text-white font-semibold' :'text-gray-300 hover:bg-white/5'
              }`}
            >
              المسلسلات التلفزيونية
</button>
            <button
              onClick={() => {
                onViewWatchlist();
                setIsMobileMenuOpen(false);
              }}
              className={`flex items-center text-right text-lg font-medium py-3 px-4 rounded-xl transition-colors ${
                activeView ==='watchlist' ?'bg-white/10 text-white font-semibold' :'text-gray-300 hover:bg-white/5'
              }`}
            >
              قائمتي 
</button>
</div>
</div>
      )}
</>
  );
}
