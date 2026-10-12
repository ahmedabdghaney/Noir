/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { Bookmark, CircleUserRound, Clock3, Film, Home, LogIn, LogOut, Megaphone, Search, Sparkles, Tv, UsersRound } from 'lucide-react';

interface MobileNavProps {
  activeView: string;
  searchMode: 'movie' | 'tv';
  goHome: () => void;
  setSearchMode: (mode: 'movie' | 'tv') => void;
  openAnime: () => void;
  openSearchOverlay: () => void;
  isSearchOpen: boolean;
  user: { name: string; photoURL?: string; type: string } | null;
  onViewWatchlist: () => void;
  onViewHistory: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
  onLogin: () => void;
}

export default function MobileNav({
  activeView,
  searchMode,
  goHome,
  setSearchMode,
  openAnime,
  openSearchOverlay,
  isSearchOpen,
  user,
  onViewWatchlist,
  onViewHistory,
  onOpenProfile,
  onLogout,
  onLogin,
}: MobileNavProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [showAds, setShowAds] = useState(() => localStorage.getItem('noir_show_ads') !== 'false');
  const shellRef = useRef<HTMLElement>(null);
  const profileAvatar = localStorage.getItem('noir_profile_avatar');

  useEffect(() => {
    if (!profileOpen) return;
    const close = (event: PointerEvent) => {
      if (!shellRef.current?.contains(event.target as Node)) setProfileOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileOpen(false);
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [profileOpen]);

  const runProfileAction = (action: () => void) => {
    setProfileOpen(false);
    action();
  };

  const items = [
    { id: 'home', label: 'Home', icon: Home, active: activeView === 'home', action: goHome },
    { id: 'movies', label: 'Movies', icon: Film, active: activeView === 'search' && searchMode === 'movie', action: () => setSearchMode('movie') },
    { id: 'shows', label: 'Shows', icon: Tv, active: activeView === 'search' && searchMode === 'tv', action: () => setSearchMode('tv') },
    { id: 'anime', label: 'Anime', icon: Sparkles, active: activeView === 'category' && window.location.hash.startsWith('#category/animation'), action: openAnime },
    { id: 'search', label: 'Search', icon: Search, active: isSearchOpen, action: openSearchOverlay },
  ];

  return (
    <nav
      ref={shellRef}
      aria-label="Main navigation"
      className={`noir-mobile-nav lg:hidden ${isSearchOpen ? 'is-search-open' : ''}`}
      dir="ltr"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={item.action}
            className={item.active ? 'is-active' : ''}
            aria-label={item.label}
            title={item.label}
            aria-current={item.active ? 'page' : undefined}
          >
            <Icon />
          </button>
        );
      })}

      <span className="noir-mobile-nav-divider" aria-hidden="true" />

      <button
        type="button"
        className={`noir-mobile-profile-button ${profileOpen ? 'is-active' : ''}`}
        aria-label="Profile"
        aria-expanded={profileOpen}
        onClick={() => setProfileOpen((open) => !open)}
      >
        {user?.photoURL ? (
          <img src={user.photoURL} alt={user.name} referrerPolicy="no-referrer" />
        ) : profileAvatar ? (
          <span className="noir-mobile-avatar" aria-hidden="true">{profileAvatar}</span>
        ) : (
          <CircleUserRound />
        )}
      </button>

      {profileOpen && (
        <div className="noir-mobile-profile-menu" role="menu">
          {user && (
            <div className="noir-mobile-profile-summary">
              <span className="noir-mobile-profile-avatar">
                {user.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : profileAvatar || user.name.slice(0, 1).toUpperCase()}
              </span>
              <span><strong>{user.name}</strong><small>{user.type === 'guest' ? 'Guest profile' : 'Noir account'}</small></span>
            </div>
          )}
          <button type="button" onClick={() => runProfileAction(onViewHistory)} role="menuitem"><Clock3 /><span>History</span></button>
          <button type="button" onClick={() => runProfileAction(onViewWatchlist)} role="menuitem"><Bookmark /><span>Watchlist</span></button>
          <button type="button" onClick={() => runProfileAction(onOpenProfile)} role="menuitem"><UsersRound /><span>Profile & watch party</span></button>
          <div className="noir-mobile-profile-divider" />
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={showAds}
            onClick={() => {
              const next = !showAds;
              setShowAds(next);
              localStorage.setItem('noir_show_ads', String(next));
            }}
          >
            <Megaphone /><span>Show ads</span><i className={showAds ? 'is-on' : ''} />
          </button>
          <div className="noir-mobile-profile-divider" />
          {user?.type === 'guest' ? (
            <button type="button" onClick={() => runProfileAction(onLogin)} role="menuitem"><LogIn /><span>Login</span></button>
          ) : (
            <button type="button" onClick={() => runProfileAction(onLogout)} role="menuitem"><LogOut /><span>Logout</span></button>
          )}
        </div>
      )}
    </nav>
  );
}
