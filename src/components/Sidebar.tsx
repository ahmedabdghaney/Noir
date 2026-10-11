import { Bookmark, Clock3, Film, Home, LogOut, Megaphone, Search, Sparkles, Tv, UserRound, UsersRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import LogoIcon from './LogoIcon';

interface SidebarProps {
  activeView: string;
  searchMode: 'movie' | 'tv';
  setSearchMode: (mode: 'movie' | 'tv') => void;
  goHome: () => void;
  openSearchOverlay: () => void;
  onViewWatchlist: () => void;
  onViewHistory: () => void;
  onLogout: () => void;
  onLogin: () => void;
  onSignUp: () => void;
  user: { name: string; photoURL?: string; type: string } | null;
  onOpenProfile: () => void;
}

export default function Sidebar({
  activeView,
  searchMode,
  setSearchMode,
  goHome,
  openSearchOverlay,
  onViewWatchlist,
  onViewHistory,
  onLogout,
  onLogin,
  onSignUp,
  user,
  onOpenProfile,
}: SidebarProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [showAds, setShowAds] = useState(() => localStorage.getItem('noir_show_ads') !== 'false');
  const profileAvatar = localStorage.getItem('noir_profile_avatar');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setProfileOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [profileOpen]);

  const items = [
    { id: 'home', label: 'الرئيسية', icon: Home, active: activeView === 'home', action: goHome },
    { id: 'movies', label: 'الأفلام', icon: Film, active: activeView === 'search' && searchMode === 'movie', action: () => setSearchMode('movie') },
    { id: 'tv', label: 'المسلسلات', icon: Tv, active: activeView === 'search' && searchMode === 'tv', action: () => setSearchMode('tv') },
    { id: 'anime', label: 'أنمي', icon: Sparkles, active: activeView === 'category' && window.location.hash === '#category/animation', action: () => { window.location.hash = '#category/animation'; } },
  ];

  return (
    <header className="noir-site-header" dir="rtl">
      <div className="noir-site-header-inner">
        <button type="button" onClick={goHome} className="noir-site-brand" aria-label="العودة إلى الرئيسية">
          <LogoIcon className="h-8 w-8 text-[var(--noir-accent)]" />
          <span>نوار</span>
        </button>

        <nav className="noir-site-nav" aria-label="التنقل الرئيسي">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.action}
                className={item.active ? 'is-active' : ''}
                aria-current={item.active ? 'page' : undefined}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="noir-site-actions" ref={menuRef}>
          <button type="button" onClick={openSearchOverlay} aria-label="البحث">
            <Search className="h-5 w-5" />
          </button>
          {user && (
            <button type="button" onClick={() => setProfileOpen((open) => !open)} aria-label="فتح قائمة الملف الشخصي" aria-expanded={profileOpen}>
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.name} referrerPolicy="no-referrer" />
              ) : profileAvatar ? (
                <span className="noir-nav-avatar" aria-hidden="true">{profileAvatar}</span>
              ) : (
                <UserRound className="h-5 w-5" />
              )}
            </button>
          )}
          {profileOpen && (
            <div className="noir-desktop-profile-menu" role="menu">
              <button type="button" onClick={() => { onViewHistory(); setProfileOpen(false); }} role="menuitem">
                <Clock3 /><span>سجل المشاهدة</span>
              </button>
              <button type="button" onClick={() => { onViewWatchlist(); setProfileOpen(false); }} role="menuitem">
                <Bookmark /><span>قائمتي</span>
              </button>
              <button type="button" onClick={() => { onOpenProfile(); setProfileOpen(false); }} role="menuitem">
                <UsersRound /><span>مشاهدة جماعية</span>
              </button>
              <div className="noir-profile-menu-divider" />
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
                <Megaphone /><span>عرض الإعلانات</span><i className={showAds ? 'is-on' : ''} />
              </button>
              <div className="noir-profile-menu-footer">
                {user?.type === 'guest' ? (
                  <>
                    <button type="button" onClick={() => { onLogin(); setProfileOpen(false); }}>تسجيل الدخول</button>
                    <button type="button" onClick={() => { onSignUp(); setProfileOpen(false); }}>حساب جديد</button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => { onOpenProfile(); setProfileOpen(false); }}>الملف الشخصي</button>
                    <button type="button" onClick={() => { onLogout(); setProfileOpen(false); }}><LogOut /> خروج</button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
