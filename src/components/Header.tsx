import { useEffect, useRef, useState } from 'react';
import { Search, UserRound } from 'lucide-react';
import LogoIcon from './LogoIcon';

interface HeaderProps {
  goHome: () => void;
  user: { name: string; email?: string; photoURL?: string; type: 'guest' | 'google' | 'email' } | null;
  onLogout: () => void;
  onOpenProfile: () => void;
  onOpenSearch: () => void;
}

export default function Header({ goHome, user, onLogout, onOpenProfile, onOpenSearch }: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 18);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <header className={`noir-mobile-header ${isScrolled ? 'is-scrolled' : ''}`} dir="ltr">
      <button type="button" onClick={goHome} className="noir-mobile-brand" aria-label="Back to home">
        <LogoIcon className="h-6 w-6 text-[#A0C9CB]" />
        <span>Noir</span>
      </button>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="noir-mobile-header-action"
          aria-label="Search"
          onClick={onOpenSearch}
        >
          <Search className="h-[19px] w-[19px]" />
        </button>
        {user && (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsProfileDropdownOpen((open) => !open)}
              className="noir-mobile-header-action overflow-hidden"
              aria-label="Open account options"
              aria-expanded={isProfileDropdownOpen}
            >
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.name} className="h-7 w-7 rounded-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <UserRound className="h-[19px] w-[19px]" />
              )}
            </button>
            {isProfileDropdownOpen && (
              <div className="noir-profile-menu animate-pop-in">
                <div className="border-b border-white/[0.08] px-4 py-3">
                  <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                  {user.email && <p className="mt-0.5 truncate text-[11px] text-white/45">{user.email}</p>}
                </div>
                <button type="button" onClick={() => { onOpenProfile(); setIsProfileDropdownOpen(false); }}>Profile</button>
                <button type="button" onClick={() => { onLogout(); setIsProfileDropdownOpen(false); }}>Log out</button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
