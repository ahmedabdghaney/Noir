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
        className={`fixed left-3 right-3 top-3 z-[200] flex h-14 items-center rounded-[18px] border transition-all duration-300 ${
          isScrolled
            ?'border-white/[0.09] bg-[#0b0c0f]/90 shadow-[0_16px_36px_-24px_black] backdrop-blur-2xl'
            :'border-white/[0.07] bg-black/42 backdrop-blur-xl'
        }`}
      >
        <div className="w-full px-4 sm:px-6 flex items-center justify-between">
          <button
              type="button"
              onClick={goHome}
              className="flex min-h-11 shrink-0 cursor-pointer select-none items-center gap-2 text-lg font-extrabold tracking-tight text-white"
              aria-label="العودة إلى الرئيسية"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-white/[0.07]">
                <LogoIcon className="h-4.5 w-4.5 shrink-0 text-[#00BDC2]" />
              </span>
              <span>نوار</span>
          </button>

          <div className="flex items-center justify-end text-left relative">
            {user && (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className="flex h-11 w-11 cursor-pointer select-none items-center justify-center rounded-[12px]"
                  title="خيارات الحساب"
                  aria-label="فتح خيارات الحساب"
                  aria-expanded={isProfileDropdownOpen}
                >
                  <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-[9px] border border-white/10 bg-stone-900 hover:border-white/20">
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
                  <div className="absolute left-0 mt-2.5 w-52 glass-strong rounded-xl shadow-2xl py-2 z-[250] text-right animate-pop-in">
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
                      className="w-full min-h-11 text-right px-4 py-2.5 text-sm text-[#22CDD0] hover:text-[#55DADD] hover:bg-[#00BDC2]/10 flex items-center transition-colors cursor-pointer font-semibold"
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
