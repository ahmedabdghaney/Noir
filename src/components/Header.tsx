/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import LogoIcon from './LogoIcon';

interface HeaderProps {
  goHome: () => void;
  user: { name: string; email?: string; photoURL?: string; type: 'guest' | 'google' | 'email' } | null;
  onLogout: () => void;
  onOpenProfile: () => void;
}

export default function Header({
  goHome,
  user,
  onLogout,
  onOpenProfile,
}: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
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
    <nav
      aria-label="الشريط العلوي"
        className={`fixed top-0 left-0 right-0 z-[200] h-14 flex items-center transition-all duration-300 ${
          isScrolled
            ?'backdrop-blur-2xl bg-[#0b0b0d]/70 border-b border-white/8 saturate-150'
            :'backdrop-blur-xl bg-gradient-to-b from-black/50 to-transparent border-b border-transparent'
        }`}
      >
        <div className="w-full px-4 sm:px-6 flex items-center justify-between">
          <button
              type="button"
              onClick={goHome}
              className="flex min-h-11 items-center gap-2 cursor-pointer select-none text-white font-bold text-lg tracking-tight shrink-0"
              aria-label="العودة إلى الرئيسية"
            >
              <LogoIcon className="w-5 h-5 text-red-500 shrink-0" />
              <span>نوار</span>
              <span className="text-gray-500 font-normal text-[10px] mr-1 bg-white/5 px-1.5 py-0.5 rounded">سينما</span>
          </button>

          <div className="flex items-center justify-end text-left relative">
            {user && (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className="w-11 h-11 rounded-full flex items-center justify-center cursor-pointer select-none"
                  title="خيارات الحساب"
                  aria-label="فتح خيارات الحساب"
                  aria-expanded={isProfileDropdownOpen}
                >
                  <span className="w-8 h-8 rounded-full border border-white/10 hover:border-white/20 overflow-hidden flex items-center justify-center bg-stone-900">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center bg-indigo-600 text-white font-bold text-[10px] uppercase">
                        {user.name.slice(0, 2)}
                      </span>
                    )}
                  </span>
                </button>

                {isProfileDropdownOpen && (
                  <div className="absolute left-0 mt-2.5 w-52 glass-strong rounded-2xl shadow-2xl py-2 z-[250] text-right animate-pop-in">
                    <div className="px-4 py-2 border-b border-white/5">
                      <p className="text-[11px] text-gray-400 font-medium mb-1">الحساب الحالي</p>
                      <p className="text-sm text-white font-bold truncate leading-tight">{user.name}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onOpenProfile();
                        setIsProfileDropdownOpen(false);
                      }}
                      className="w-full min-h-11 text-right px-4 py-2.5 text-sm text-stone-200 hover:text-white hover:bg-white/5 flex items-center transition-colors cursor-pointer font-semibold"
                    >
                      الملف الشخصي
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onLogout();
                        setIsProfileDropdownOpen(false);
                      }}
                      className="w-full min-h-11 text-right px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center transition-colors cursor-pointer font-semibold"
                    >
                      <span>تسجيل الخروج</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>
  );
}
