import { useEffect, useRef, useState } from 'react';
import { Bookmark, Film, Home, Search, Tv } from 'lucide-react';
import LogoIcon from './LogoIcon';

interface TvNavigationProps {
  activeView: string;
  searchMode: 'movie' | 'tv';
  isSearchOpen: boolean;
  goHome: () => void;
  openSearch: () => void;
  setSearchMode: (mode: 'movie' | 'tv') => void;
  openWatchlist: () => void;
  user: { name: string; photoURL?: string } | null;
  openProfile: () => void;
}

export default function TvNavigation({
  activeView,
  searchMode,
  isSearchOpen,
  goHome,
  openSearch,
  setSearchMode,
  openWatchlist,
  user,
  openProfile,
}: TvNavigationProps) {
  const navigationRef = useRef<HTMLElement>(null);
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    let frame: number | undefined;
    const updateVisibility = () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = undefined;
        if (navigationRef.current?.contains(document.activeElement)) {
          setIsHidden(false);
          return;
        }
        setIsHidden(window.scrollY > Math.max(90, window.innerHeight * 0.12));
      });
    };
    const reveal = () => setIsHidden(false);
    const handleFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && navigationRef.current?.contains(event.target)) {
        reveal();
      }
    };
    const handleFocusOut = () => window.requestAnimationFrame(updateVisibility);

    window.addEventListener('scroll', updateVisibility, { passive: true });
    window.addEventListener('noir_tv_reveal_navigation', reveal);
    document.addEventListener('focusin', handleFocusIn);
    navigationRef.current?.addEventListener('focusout', handleFocusOut);
    updateVisibility();
    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', updateVisibility);
      window.removeEventListener('noir_tv_reveal_navigation', reveal);
      document.removeEventListener('focusin', handleFocusIn);
      navigationRef.current?.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  const items = [
    { key: 'search', label: 'البحث', icon: Search, active: isSearchOpen, action: openSearch },
    { key: 'home', label: 'الرئيسية', icon: Home, active: !isSearchOpen && activeView === 'home', action: goHome },
    { key: 'movies', label: 'الأفلام', icon: Film, active: !isSearchOpen && activeView === 'search' && searchMode === 'movie', action: () => setSearchMode('movie') },
    { key: 'tv', label: 'المسلسلات', icon: Tv, active: !isSearchOpen && activeView === 'search' && searchMode === 'tv', action: () => setSearchMode('tv') },
    { key: 'watchlist', label: 'قائمتي', icon: Bookmark, active: !isSearchOpen && activeView === 'watchlist', action: openWatchlist },
  ];

  return (
    <aside
      ref={navigationRef}
      data-tv-navigation
      data-tv-navigation-hidden={isHidden ? '' : undefined}
      className={`noir-tv-navigation pointer-events-none fixed inset-x-0 top-0 z-[210] h-[4.25rem] px-[4vw] ${isHidden ? 'is-hidden' : ''}`}
      dir="rtl"
    >
      <div
        className="noir-tv-navigation-brand pointer-events-none absolute right-[4vw] top-1/2 flex items-center gap-2 text-white"
        style={{ transform: 'translateY(-50%)' }}
        aria-hidden="true"
      >
          <LogoIcon className="h-5 w-5 shrink-0 text-red-500" />
          <span className="whitespace-nowrap font-display text-lg font-bold">نوار</span>
      </div>

      <nav
        className="noir-tv-top-navigation pointer-events-auto absolute flex items-center gap-0.5 rounded-full border border-white/15 p-1"
        style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
        aria-label="التنقل الرئيسي"
      >
          {items.map(({ key, label, icon: Icon, active, action }) => (
            <button
              key={key}
              type="button"
              onClick={action}
              data-tv-nav-item={key}
              className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ${
                active ? 'bg-white text-black' : 'text-white/58 hover:bg-white/8 hover:text-white'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">{label}</span>
            </button>
          ))}
      </nav>

        {user && (
          <button
            type="button"
            onClick={openProfile}
            data-tv-nav-item="profile"
            className="noir-tv-navigation-profile pointer-events-auto absolute left-[4vw] top-1/2 flex h-9 w-9 items-center justify-center rounded-full text-white/70"
            style={{ transform: 'translateY(-50%)' }}
            aria-label="فتح الملف الشخصي"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/8">
              {user.photoURL
                ? <img src={user.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                : <span className="text-sm font-bold text-white">{user.name.slice(0, 2)}</span>}
            </span>
          </button>
        )}
    </aside>
  );
}
