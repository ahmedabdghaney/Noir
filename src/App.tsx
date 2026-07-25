/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import { lazy, Suspense, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, Loader, Filter, ArrowUpDown, Bookmark, Eye, EyeOff, Star, WifiOff, X } from 'lucide-react';
import LogoIcon from './components/LogoIcon';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { auth, loginWithGoogle, logoutUser, signInWithEmail, signUpWithEmail, resetPassword, checkSignInMethods, translateAuthError, fetchFirestoreWatchlist, db, sendVerification, removeFromFirestoreWatchlist, addToFirestoreWatchlist } from './lib/firebase';
import { MovieOrShow } from './types';
import {
  initializeGenres,
  fetchTrendingWeek,
  fetchNowPlaying,
  fetchPopularTV,
  fetchPopularMovies,
  fetchUpcoming,
  discoverForSection,
  discoverTitles,
  searchTitles,
  MOVIE_GENRES,
} from './lib/tmdb';

// Component Imports
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Hero from './components/Hero';
import MovieRow from './components/MovieRow';
import CategoryRow from './components/CategoryRow';
import StudiosRow from './components/StudiosRow';
import PullToRefresh from './components/PullToRefresh';
import { getCategoryByKey } from './lib/categories';
import { getStudioByKey } from './lib/studios';
import ContinueWatchingRow from './components/ContinueWatchingRow';
import ShareModal from './components/ShareModal';
import MobileNav from './components/MobileNav';
import Footer from './components/Footer';
import {
  subscribeHidden, subscribeManualItems, subscribeCustomSections, subscribeSectionOrder,
  subscribeHeroHidden, toggleHeroHidden, subscribeHeroExtra, subscribeHeroOrder, HeroExtra,
  toggleHidden,
  itemKey, ManualItem, CustomSection,
} from './lib/adminStore';

const DetailView = lazy(() => import('./components/DetailView'));
const SearchOverlay = lazy(() => import('./components/SearchOverlay'));
const CategoryPage = lazy(() => import('./components/CategoryPage'));
const StudioPage = lazy(() => import('./components/StudioPage'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));

// Static Configuration Constants
const COUNTRIES = [
  ['US','الولايات المتحدة'],
  ['GB','المملكة المتحدة'],
  ['FR','فرنسا'],
  ['JP','اليابان'],
  ['KR','كوريا الجنوبية'],
  ['IN','الهند'],
  ['EG','الوطن العربي (مصر)'],
  ['DE','ألمانيا'],
  ['IT','إيطاليا'],
  ['ES','إسبانيا'],
];

const LANGS = [
  ['en','الإنجليزية'],
  ['ar','العربية'],
  ['fr','الفرنسية'],
  ['ja','اليابانية'],
  ['ko','الكورية'],
  ['es','الإسبانية'],
  ['hi','الهندية'],
  ['de','الألمانية'],
];

const RATINGS = [
  ['8','8+ نجوم'],
  ['7','7+ نجوم'],
  ['6','6+ نجوم'],
];

const RUNTIMES = [
  ['lt90','أقل من ساعة ونصف'],
  ['90_120','ساعة ونصف إلى ساعتين'],
  ['gt120','أكثر من ساعتين'],
];

const YEARS = (() => {
  const current = new Date().getFullYear();
  return Array.from({ length: 15 }, (_, i) => String(current - i));
})();

function ViewFallback() {
  return (
    <div className="min-h-[55vh] flex items-center justify-center" role="status" aria-label="جاري تحميل الصفحة">
      <div className="w-7 h-7 rounded-full border-2 border-white/15 border-t-white animate-spin" />
    </div>
  );
}

export default function App() {
  // Navigation & View State
  const [activeView, setActiveView] = useState<'home' | 'search' | 'detail' | 'watchlist' | 'category' | 'studio' | 'admin'>('home');
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null);
  const [categoryAllMode, setCategoryAllMode] = useState(false);
  const [selectedStudioKey, setSelectedStudioKey] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<'movie' | 'tv'>('movie');
  const [selectedTitle, setSelectedTitle] = useState<{ type: 'movie' | 'tv'; id: number } | null>(null);
  // الموسم/الحلقة المقروءة من الـ URL (تُمرَّر لـ DetailView كقيمة ابتدائية)
  const [selectedEpisodeRoute, setSelectedEpisodeRoute] = useState<{ season: number; episode: number } | null>(null);
  const [joinRoomCode, setJoinRoomCode] = useState<string>('');

  // User Profile Modal active state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSendingVerification, setIsSendingVerification] = useState(false);

  useEffect(() => {
    if (!isProfileModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsProfileModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isProfileModalOpen]);

  // Watchlist custom filter & sorting options
  const [watchlistFilter, setWatchlistFilter] = useState<'all' | 'movie' | 'tv'>('all');
  const [watchlistSort, setWatchlistSort] = useState<'default' | 'rating' | 'year'>('default');
  const [watchlistSortDir, setWatchlistSortDir] = useState<'asc' | 'desc'>('desc');

  // Authentication Management State
  const [user, setUser] = useState<{ name: string; email?: string; photoURL?: string; type: 'guest' | 'google' | 'email' } | null>(() => {
    try {
      const stored = localStorage.getItem('noir_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed;
      }
      return { name: 'زائر نوار', type: 'guest' };
    } catch {
      return { name: 'زائر نوار', type: 'guest' };
    }
  });
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authMethod, setAuthMethod] = useState<'guest' | 'google' | 'email' | null>(null);

  // Email auth form state
  const [authView, setAuthView] = useState<'menu' | 'signin' | 'signup' | 'reset'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  // Bookmark / Watchlist feeds
  const [watchlist, setWatchlist] = useState<MovieOrShow[]>([]);
  // loadWatchlist checks cloud for authenticated users or local storage for guests
  const loadWatchlist = async () => {
    const curUser = auth.currentUser;
    if (curUser) {
      try {
        const cloudList = await fetchFirestoreWatchlist(curUser.uid);
        setWatchlist(cloudList);
        localStorage.setItem('noir_watchlist', JSON.stringify(cloudList));
      } catch (err) {
        console.error("Failed to load watchlist from Firestore: ", err);
        const saved = localStorage.getItem('noir_watchlist');
        setWatchlist(saved ? JSON.parse(saved) : []);
      }
    } else {
      try {
        const saved = localStorage.getItem('noir_watchlist');
        setWatchlist(saved ? JSON.parse(saved) : []);
      } catch {
        setWatchlist([]);
      }
    }
  };

  // Synchronize authenticated identity with Firebase state-listener and real-time watchlist
  useEffect(() => {
    let unsubscribeWatchlist: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      // Unsubscribe previous watchlist listener if exists
      if (unsubscribeWatchlist) {
        unsubscribeWatchlist();
        unsubscribeWatchlist = null;
      }

      if (firebaseUser) {
        const isEmailOnly = firebaseUser.providerData?.[0]?.providerId === 'password';
        const userData = {
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'مستخدم نوار',
          email: firebaseUser.email || undefined,
          photoURL: firebaseUser.photoURL || undefined,
          type: (isEmailOnly ? 'email' : 'google') as 'email' | 'google',
        };
        localStorage.setItem('noir_user', JSON.stringify(userData));
        setUser(userData);
        
        // Subscribe to real-time watchlist changes in Firestore
        try {
          const q = collection(db, 'users', firebaseUser.uid, 'watchlist');
          unsubscribeWatchlist = onSnapshot(q, (snapshot) => {
            const list: any[] = [];
            snapshot.forEach((docSnap) => {
              const d = docSnap.data();
              list.push({
                id: Number(d.id),
                type: d.type as 'movie' | 'tv',
                title: d.title || '',
                poster: d.poster || null,
                backdrop: d.backdrop || null,
                rating: Number(d.rating || 0),
                year: String(d.year || ''),
                genres: Array.isArray(d.genres) ? d.genres : [],
                overview: '',
                date: '',
                addedAt: d.addedAt || null,
              });
            });
            // Sort client-side safely by addedAt decreasingly
            list.sort((a, b) => {
              const valA = a.addedAt?.seconds || (a.addedAt ? new Date(a.addedAt).getTime() : 0);
              const valB = b.addedAt?.seconds || (b.addedAt ? new Date(b.addedAt).getTime() : 0);
              return valB - valA;
            });
            const normalizedList: MovieOrShow[] = list.map(({ addedAt, ...rest }) => rest);
            setWatchlist(normalizedList);
            localStorage.setItem('noir_watchlist', JSON.stringify(normalizedList));
          }, (err) => {
            console.error("Watchlist snapshot subscription error: ", err);
            loadWatchlist();
          });
        } catch (setupErr) {
          console.error("Failed to subscribe to watchlist: ", setupErr);
          loadWatchlist();
        }
      } else {
        const stored = localStorage.getItem('noir_user');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed.type === 'google' || parsed.type === 'email') {
              setUser(null);
              localStorage.removeItem('noir_user');
              loadWatchlist();
            }
          } catch {
            localStorage.removeItem('noir_user');
            loadWatchlist();
          }
        } else {
          loadWatchlist();
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeWatchlist) {
        unsubscribeWatchlist();
      }
    };
  }, []);

  // Home Lists Feeds State
  const [trendingWeek, setTrendingWeek] = useState<MovieOrShow[]>([]);
  const [nowPlaying, setNowPlaying] = useState<MovieOrShow[]>([]);
  const [popularTV, setPopularTV] = useState<MovieOrShow[]>([]);
  const [popularMovies, setPopularMovies] = useState<MovieOrShow[]>([]);
  const [upcoming, setUpcoming] = useState<MovieOrShow[]>([]);
  const [homeLoadError, setHomeLoadError] = useState(false);

  // بيانات الإدارة (مشتركة لكل الزوار) — إخفاء، عناصر يدوية، أقسام مخصصة
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [heroHiddenIds, setHeroHiddenIds] = useState<string[]>([]);
  const [heroExtra, setHeroExtra] = useState<HeroExtra[]>([]);
  const [heroOrder, setHeroOrder] = useState<string[]>([]);
  const [manualItems, setManualItems] = useState<ManualItem[]>([]);
  const [customSections, setCustomSections] = useState<CustomSection[]>([]);
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  // نتائج أقسام التصنيف التلقائية: key القسم -> عناصره من TMDB
  const [genreSectionData, setGenreSectionData] = useState<Record<string, MovieOrShow[]>>({});
  // Reusable home feed reload (used on mount + pull-to-refresh)
  const refreshHome = useCallback(async () => {
    setHomeLoadError(false);
    try {
      await Promise.all([
        fetchTrendingWeek().then(setTrendingWeek),
        fetchNowPlaying().then(setNowPlaying),
        fetchPopularTV().then(setPopularTV),
        fetchPopularMovies().then(setPopularMovies),
        fetchUpcoming().then(setUpcoming),
      ]);
    } catch (e) {
      console.error('refreshHome failed:', e);
      setHomeLoadError(true);
    }
  }, []);

  // Continue Watching List State
  const [continueWatching, setContinueWatching] = useState<MovieOrShow[]>([]);

  // loadContinueWatching parses active sessions where progress is between 1% and 94%
  const loadContinueWatching = () => {
    try {
      const listStr = localStorage.getItem('noir_continue_watching_list');
      if (!listStr) {
        setContinueWatching([]);
        return;
      }
      const list: MovieOrShow[] = JSON.parse(listStr);
      // Drop broken entries: invalid type, or missing title/name (legacy items saved before title fix)
      const validList = list.filter(
        (item) =>
          (item.type === 'movie' || item.type === 'tv') &&
          item.id &&
          ((item.title && item.title.trim() && item.title !== 'بدون عنوان') || (item as any).name),
      );
      // If we removed broken entries, persist the cleaned list back
      if (validList.length !== list.length) {
        localStorage.setItem('noir_continue_watching_list', JSON.stringify(validList));
      }
      const activeItems = validList.filter((item) => {
        const progressVal = Number(localStorage.getItem(`noir_progress_${item.type}_${item.id}`)) || 0;
        // Keep anything that hasn't been (almost) finished — including freshly opened items at 0%.
        return progressVal < 95;
      });
      setContinueWatching(activeItems);
    } catch (err) {
      console.error("Error loading continue watching list:", err);
    }
  };

  // Advanced Filters State (Dedicated Search Page)
  const [fQuery, setFQuery] = useState('');
  const [fSort, setFSort] = useState('trend');
  const [selectedGenres, setSelectedGenres] = useState<Set<number>>(new Set());
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedRating, setSelectedRating] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [selectedRuntime, setSelectedRuntime] = useState<string | null>(null);

  // Search Results State
  const [searchResults, setSearchResults] = useState<MovieOrShow[]>([]);
  const [searchPage, setSearchPage] = useState(1);
  const [searchTotalPages, setSearchTotalPages] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isFilterSidebarOpen, setIsFilterSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isFilterSidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFilterSidebarOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isFilterSidebarOpen]);

  // Modals & Overlays State
  const [isSearchOverlayOpen, setIsSearchOverlayOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);

  // Quick helper to show success notifications
  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const handleLogin = async (type: 'guest' | 'google') => {
    setIsAuthLoading(true);
    setAuthMethod(type);
    
    if (type ==='google') {
      try {
        await loginWithGoogle();
        showToast('تم تسجيل الدخول بجوجل بنجاح');
      } catch (error: any) {
        console.error("Google login failed: ", error);
        const errMsg = translateAuthError(error);
        if (error?.code === 'auth/operation-not-allowed') {
          showToast('فشل: يرجى تفعيل تسجيل الدخول بجوجل في لوحة تحكم Firebase');
        } else {
          showToast(`فشل تسجيل الدخول بجوجل: ${errMsg}`);
        }
        setIsAuthLoading(false);
        setAuthMethod(null);
      }
    } else {
      setTimeout(() => {
        const newUser = { name: 'زائر كريم', type: 'guest' as const };
        localStorage.setItem('noir_user', JSON.stringify(newUser));
        setUser(newUser);
        setIsAuthLoading(false);
        setAuthMethod(null);
        showToast('مرحباً بك كضيف في نوار سينما');
      }, 850);
    }
  };

  const handleEmailSignIn = async () => {
    if (!authEmail || !authPassword) {
      setAuthError('أدخل البريد وكلمة السر');
      return;
    }
    setAuthError('');
    setIsAuthLoading(true);
    setAuthMethod('email');
    try {
      await signInWithEmail(authEmail, authPassword);
      showToast('أهلاً بك من جديد');
      setAuthEmail('');
      setAuthPassword('');
      setAuthName('');
    } catch (e) {
      setAuthError(translateAuthError(e));
    } finally {
      setIsAuthLoading(false);
      setAuthMethod(null);
    }
  };

  const handleEmailSignUp = async () => {
    if (!authEmail || !authPassword || !authName || !authPasswordConfirm) {
      setAuthError('أكمل كل الحقول');
      return;
    }
    if (authPassword !== authPasswordConfirm) {
      setAuthError('كلمة السر والتأكيد غير متطابقتين');
      return;
    }
    if (authPassword.length < 6) {
      setAuthError('كلمة السر لازم 6 خانات على الأقل');
      return;
    }
    if (!/[A-Z]/.test(authPassword)) {
      setAuthError('كلمة السر لازم تحتوي حرف كبير (A-Z)');
      return;
    }
    if (!/[a-z]/.test(authPassword)) {
      setAuthError('كلمة السر لازم تحتوي حرف صغير (a-z)');
      return;
    }
    setAuthError('');
    setIsAuthLoading(true);
    setAuthMethod('email');
    try {
      await signUpWithEmail(authEmail, authPassword, authName);
      showToast('تم إنشاء حسابك، أهلاً بك');
      setAuthEmail('');
      setAuthPassword('');
      setAuthPasswordConfirm('');
      setAuthName('');
    } catch (e) {
      setAuthError(translateAuthError(e));
    } finally {
      setIsAuthLoading(false);
      setAuthMethod(null);
    }
  };

  const handleResetPassword = async () => {
    if (!authEmail) {
      setAuthError('أدخل البريد الإلكتروني');
      return;
    }
    setAuthError('');
    setIsAuthLoading(true);
    try {
      // Try to detect Google-only accounts (best effort — Firebase may hide this
      // for privacy if email enumeration protection is on)
      try {
        const methods = await checkSignInMethods(authEmail);
        if (methods.length > 0 && !methods.includes('password') && methods.includes('google.com')) {
          setAuthError('هذا البريد مسجّل عبر Google، رجاءً سجّل دخولك بزر Google مباشرة');
          return;
        }
      } catch {
        // Ignore — fall through to sending reset
      }
      await resetPassword(authEmail);
      showToast('لو البريد مسجّل عندنا، راح يوصلك رابط الاستعادة (افحص السبام)');
      setAuthView('signin');
      setAuthEmail('');
    } catch (e) {
      setAuthError(translateAuthError(e));
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    const stored = localStorage.getItem('noir_user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.type ==='google' || parsed.type === 'email') {
          await logoutUser();
        }
      } catch (e) {
        console.error("Logout from Firebase failed: ", e);
      }
    }
    localStorage.removeItem('noir_user');
    setUser(null);
    showToast('تم تسجيل الخروج بنجاح');
  };

  const handleSendVerificationEmail = async () => {
    setIsSendingVerification(true);
    try {
      await sendVerification();
      showToast('تم إرسال رابط التفعيل إلى بريدك الإلكتروني بنجاح (افحص البريد المزعج/السبام)');
    } catch (e: any) {
      console.error(e);
      showToast('فشل في إرسال رابط التفعيل، يرجى المحاولة لاحقاً');
    } finally {
      setIsSendingVerification(false);
    }
  };

  const handleViewWatchlist = () => {
    setIsSearchOverlayOpen(false);
    setActiveView('watchlist');
    setSelectedTitle(null);
    window.location.hash ='#watchlist';
  };

  // loadWatchlist definition was moved to the state section above for better initialization.

  // Setup Dynamic URL Hash routing system
  useEffect(() => {
    const handleHashRouting = () => {
      const hash = window.location.hash;
      if (!hash || hash ==='#home') {
        setActiveView('home');
        setSelectedTitle(null);
      } else if (hash ==='#movies') {
        setSearchMode('movie');
        setActiveView('search');
        setSelectedTitle(null);
      } else if (hash ==='#tv') {
        setSearchMode('tv');
        setActiveView('search');
        setSelectedTitle(null);
      } else if (hash ==='#watchlist') {
        setActiveView('watchlist');
        setSelectedTitle(null);
      } else if (hash ==='#noir-control') {
        setActiveView('admin');
        setSelectedTitle(null);
      } else if (hash.startsWith('#watch-together')) {
        const parts = hash.split('?');
        const queryStr = parts[1] ||'';
        const params = new URLSearchParams(queryStr);
        const room = params.get('room') ||'';
        const mediaType = params.get('type') as'movie' | 'tv' | null;
        const mediaId = Number(params.get('id'));

        if (mediaType && mediaId) {
          setSelectedTitle({ type: mediaType, id: mediaId });
          setActiveView('detail');
          setJoinRoomCode(room);
        } else {
          setActiveView('home');
          setSelectedTitle(null);
        }
      } else if (hash.startsWith('#category/')) {
        const rest = hash.replace('#category/', '');
        const isAll = rest.endsWith('/all');
        const key = isAll ? rest.replace('/all', '') : rest;
        if (getCategoryByKey(key)) {
          setSelectedCategoryKey(key);
          setCategoryAllMode(isAll);
          setActiveView('category');
          setSelectedTitle(null);
        } else {
          window.location.hash = '#home';
        }
      } else if (hash.startsWith('#studio/')) {
        const key = hash.replace('#studio/', '');
        if (getStudioByKey(key)) {
          setSelectedStudioKey(key);
          setActiveView('studio');
          setSelectedTitle(null);
        } else {
          window.location.hash = '#home';
        }
      } else {
        const movieMatch = hash.match(/^#movie\/(-?\d+)$/);
        // يدعم: #tv/123 أو #tv/123/s2/e5 (والـ id ممكن يكون سالب للعناصر اليدوية)
        const tvMatch = hash.match(/^#tv\/(-?\d+)(?:\/s(\d+)\/e(\d+))?$/);

        if (movieMatch) {
          setSelectedTitle({ type: 'movie', id: Number(movieMatch[1]) });
          setSelectedEpisodeRoute(null);
          setActiveView('detail');
        } else if (tvMatch) {
          setSelectedTitle({ type: 'tv', id: Number(tvMatch[1]) });
          // إذا الـ URL فيه موسم/حلقة، خزنهم لتمريرهم لـ DetailView
          if (tvMatch[2] && tvMatch[3]) {
            setSelectedEpisodeRoute({ season: Number(tvMatch[2]), episode: Number(tvMatch[3]) });
          } else {
            setSelectedEpisodeRoute(null);
          }
          setActiveView('detail');
        } else {
          window.location.hash ='#home';
        }
      }
    };

    // Initialize genres mapping list first
    setHomeLoadError(false);
    initializeGenres()
      .then(() => {
        // Load Home feeds concurrent
        return Promise.all([
          fetchTrendingWeek().then(setTrendingWeek),
          fetchNowPlaying().then(setNowPlaying),
          fetchPopularTV().then(setPopularTV),
          fetchPopularMovies().then(setPopularMovies),
          fetchUpcoming().then(setUpcoming),
        ]);
      })
      .catch((error) => {
        console.error('Initial home load failed:', error);
        setHomeLoadError(true);
      });

    window.addEventListener('hashchange', handleHashRouting);
    // Boot active hash route immediately
    handleHashRouting();

    // Load initial watchlist feed
    loadWatchlist();
    window.addEventListener('watchlist_updated', loadWatchlist);

    // Load initial continue watching feed and register sync listener
    loadContinueWatching();
    const handleProgressUpdate = () => {
      loadContinueWatching();
    };
    window.addEventListener('progress_updated', handleProgressUpdate);

    return () => {
      window.removeEventListener('hashchange', handleHashRouting);
      window.removeEventListener('watchlist_updated', loadWatchlist);
      window.removeEventListener('progress_updated', handleProgressUpdate);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // اشتراك حي ببيانات الإدارة — أي تغيير من الداشبورد ينعكس فوراً على الموقع
  useEffect(() => {
    const u1 = subscribeHidden(setHiddenIds);
    const u2 = subscribeManualItems(setManualItems);
    const u3 = subscribeCustomSections(setCustomSections);
    const u4 = subscribeSectionOrder(setSectionOrder);
    const u5 = subscribeHeroHidden(setHeroHiddenIds);
    const u6 = subscribeHeroExtra(setHeroExtra);
    const u7 = subscribeHeroOrder(setHeroOrder);
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); };
  }, []);

  // جلب محتوى أقسام التصنيف التلقائية من TMDB (تتحدّث لما تتغير الأقسام)
  useEffect(() => {
    const genreSecs = customSections.filter((s) => s.kind === 'genre' && s.genreId);
    if (genreSecs.length === 0) { setGenreSectionData({}); return; }
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(genreSecs.map(async (s) => {
        const items = await discoverForSection({
          genreId: s.genreId,
          mediaType: s.mediaType || 'movie',
          minYear: s.minYear,
          maxYear: s.maxYear,
          minRating: s.minRating,
          language: s.language,
        });
        return [s.key, items] as [string, MovieOrShow[]];
      }));
      if (!cancelled) setGenreSectionData(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [customSections]);

  // لو فُتحت صفحة الأدمن مباشرة (#noir-control) والأقسام لسا فاضية، حمّلها
  useEffect(() => {
    if (activeView === 'admin' && trendingWeek.length === 0) {
      refreshHome();
    }
  }, [activeView, trendingWeek.length, refreshHome]);

  // Sync Search results when filters or query updates
  useEffect(() => {
    if (activeView !=='search') return;
    
    // Set up search debounce timer to prevent redundant API thrashing
    const delayDebounceSearch = setTimeout(() => {
      triggerSearchQuery(false);
    }, 300);

    return () => clearTimeout(delayDebounceSearch);
  }, [
    fQuery,
    fSort,
    selectedGenres,
    selectedYear,
    selectedRating,
    selectedCountry,
    selectedLanguage,
    selectedRuntime,
    searchMode,
    activeView,
  ]);

  // Automatically scroll to the top of the viewport whenever the active view or selected title changes
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
    
    const t = setTimeout(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    }, 60);
    return () => clearTimeout(t);
  }, [activeView, selectedTitle]);

  // Master Query search resolver (handles discover vs search parameters)
  const triggerSearchQuery = async (append = false) => {
    const nextPage = append ? searchPage + 1 : 1;
    if (append) {
      if (isLoadingMore || nextPage > searchTotalPages) return;
      setIsLoadingMore(true);
    } else {
      setIsSearching(true);
      setSearchResults([]);
    }

    try {
      let resultsArr: MovieOrShow[] = [];
      let totalP = 1;

      if (fQuery.trim()) {
        const data = await searchTitles(searchMode, fQuery.trim(), nextPage);
        resultsArr = data.results;
        totalP = data.totalPages;
      } else {
        // Build query Options for advanced discovery filters
        const genreIds = selectedGenres.size > 0 ? Array.from(selectedGenres).join(',') : undefined;
        let runtimeLte: string | undefined;
        let runtimeGte: string | undefined;

        if (selectedRuntime ==='lt90') runtimeLte ='89';
        else if (selectedRuntime ==='90_120') {
          runtimeGte ='90';
          runtimeLte ='120';
        } else if (selectedRuntime ==='gt120') {
          runtimeGte ='121';
        }

        const data = await discoverTitles(searchMode, {
          page: nextPage,
          genreIds,
          year: selectedYear || undefined,
          ratingGte: selectedRating || undefined,
          originCountry: selectedCountry || undefined,
          originalLanguage: selectedLanguage || undefined,
          runtimeLte,
          runtimeGte,
          sortBy: fSort,
        });

        resultsArr = data.results;
        totalP = data.totalPages;
      }

      setSearchPage(nextPage);
      setSearchTotalPages(totalP);
      
      if (append) {
        setSearchResults((prev) => [...prev, ...resultsArr]);
      } else {
        setSearchResults(resultsArr);
      }
    } catch (err) {
      console.error('Search error: ', err);
    } finally {
      setIsSearching(false);
      setIsLoadingMore(false);
    }
  };

  // Global redirection tool
  const navigateToHome = () => {
    setIsSearchOverlayOpen(false);
    setActiveView('home');
    setSelectedTitle(null);
    window.location.hash ='#home';
  };

  // يحدّث الـ URL بالموسم/الحلقة الحاليين بدون إعادة تحميل
  const handleEpisodeRouteChange = useCallback((season: number, episode: number) => {
    setSelectedTitle((cur) => {
      if (cur && cur.type === 'tv') {
        const newHash = `#tv/${cur.id}/s${season}/e${episode}`;
        if (window.location.hash !== newHash) {
          window.history.replaceState(null, '', newHash);
        }
      }
      return cur;
    });
  }, []);

  const handleSetSearchMode = (mode: 'movie' | 'tv') => {
    setIsSearchOverlayOpen(false);
    setSearchMode(mode);
    setActiveView('search');
    setSelectedTitle(null);
    window.location.hash = mode ==='tv' ?'#tv' :'#movies';
  };

  const handleTitleClick = (item: MovieOrShow) => {
    window.location.hash =`#${item.type}/${item.id}`;
  };

  const removeFromWatchlist = (item: MovieOrShow) => {
    const next = watchlist.filter((w) => !(w.id === item.id && w.type === item.type));
    setWatchlist(next);
    localStorage.setItem('noir_watchlist', JSON.stringify(next));
    const curUser = auth.currentUser;
    if (curUser) {
      removeFromFirestoreWatchlist(curUser.uid, item.type, item.id).catch((e) =>
        console.error('Failed to remove from cloud watchlist:', e)
      );
    }
  };

  const isInWatchlist = (item: MovieOrShow) =>
    watchlist.some((w) => w.id === item.id && w.type === item.type);

  const toggleWatchlistItem = (item: MovieOrShow) => {
    if (isInWatchlist(item)) {
      removeFromWatchlist(item);
    } else {
      const next = [item, ...watchlist];
      setWatchlist(next);
      localStorage.setItem('noir_watchlist', JSON.stringify(next));
      const curUser = auth.currentUser;
      if (curUser) {
        addToFirestoreWatchlist(curUser.uid, {
          id: item.id, type: item.type, title: item.title,
          poster: item.poster, backdrop: item.backdrop, rating: item.rating,
          year: item.year, genres: item.genres,
        }).catch((e) => console.error('Failed to add to cloud watchlist:', e));
      }
    }
  };

  const handleQuickSelectTitle = (type: 'movie' | 'tv', id: number) => {
    window.location.hash =`#${type}/${id}`;
  };

  const handleOpenShare = (url: string) => {
    setShareUrl(url);
    setIsShareModalOpen(true);
  };

  const handleResetFilters = () => {
    setSelectedGenres(new Set());
    setSelectedYear(null);
    setSelectedRating(null);
    setSelectedCountry(null);
    setSelectedLanguage(null);
    setSelectedRuntime(null);
    setFQuery('');
    showToast('تم مسح جميع فلاتر التصفية');
  };

  if (!user) {
    return (
      <div className="relative min-h-screen bg-[#09090b] text-white flex items-center justify-center font-sans overflow-hidden p-4 sm:p-6 md:p-10">
        
        {/* Main Double-Pane Card Layout */}
        <div className="relative z-10 w-full max-w-5xl bg-[#111114] border border-white/[0.09] shadow-2xl rounded-[30px] overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[660px]" dir="ltr">
          
          <div className="hidden lg:flex lg:col-span-5 relative flex-col justify-between p-12 overflow-hidden bg-[radial-gradient(circle_at_75%_15%,rgba(255,69,58,0.22),transparent_42%),linear-gradient(160deg,#19191d,#08080a)] border-r border-white/[0.08]">
            <div className="relative z-10" dir="rtl">
              <div className="flex items-center gap-3 mb-14 justify-end">
                <span className="text-xl font-bold tracking-tight text-white">نوار سينما</span>
                <div className="w-11 h-11 rounded-[14px] bg-[#ff453a] flex items-center justify-center shadow-lg shadow-red-950/30">
                  <LogoIcon className="w-5 h-5 text-white" />
                </div>
              </div>

              <span className="noir-eyebrow block mb-3">سينما بلا ضوضاء</span>
              <h2 className="font-display text-3xl font-bold text-white leading-tight">
                مكان واحد لاكتشاف وحفظ ومتابعة ما تحب.
              </h2>
              <p className="text-white/45 text-sm leading-7 mt-4 max-w-sm">
                واجهة عربية هادئة، قوائم واضحة، وتجربة مشاهدة تضع المحتوى أولاً.
              </p>
            </div>

            <p className="relative z-10 text-xs text-white/30" dir="rtl">
              تقدر تتصفح كزائر بدون إنشاء حساب.
            </p>
          </div>

          {/* RIGHT COLUMN: Stylish Login / Signup Input Form */}
          <div className="col-span-1 lg:col-span-7 flex flex-col justify-center p-7 sm:p-12 md:p-16 relative z-10 bg-[#111114]" dir="rtl">
            
            {/* Form Header */}
            <div className="text-right mb-8">
              <h1 className="text-2xl font-black text-white leading-tight">
                {authView === 'signin' && 'سجل الدخول الآن'}
                {authView === 'signup' && 'ابدأ حسابك الآن'}
                {authView === 'reset' && 'استعادة كلمة السر'}
              </h1>
              <p className="text-gray-500 text-xs mt-1.5 leading-relaxed font-semibold">
                {authView === 'signin' && 'من فضلك قم بتسجيل الدخول إلى حسابك للاستمرار.'}
                {authView === 'signup' && 'قم بملء البيانات التالية لتسجيل حسابك الجديد.'}
                {authView === 'reset' && 'أدخل بريدك الإلكتروني وسنقوم بإرسال رابط الاستعادة.'}
              </p>
            </div>

            {/* Actual Input form fields */}
            <div className="flex flex-col gap-4 w-full">
              
              {/* Name Field (Sign up only) */}
              {authView === 'signup' && (
                <div className="flex flex-col gap-1.5 text-right w-full">
                  <label htmlFor="auth-name" className="text-gray-400 text-xs font-bold mr-1">الاسم</label>
                  <input
                    id="auth-name"
                    type="text"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="ادخل اسمك الكامل..."
                    className="w-full bg-[#141414] border border-white/10 hover:border-white/20 focus:border-red-500/60 focus:bg-[#181818] outline-none text-white text-sm font-semibold py-3.5 px-4 rounded-xl transition-all text-right placeholder-gray-600 focus:ring-1 focus:ring-red-500/20"
                    dir="rtl"
                  />
                </div>
              )}

              {/* Email address field */}
              <div className="flex flex-col gap-1.5 text-right w-full">
                <label htmlFor="auth-email" className="text-gray-400 text-xs font-bold mr-1">البريد الإلكتروني</label>
                <input
                  id="auth-email"
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-[#141414] border border-white/10 hover:border-white/20 focus:border-red-500/60 focus:bg-[#181818] outline-none text-white text-sm font-semibold py-3.5 px-4 rounded-xl transition-all text-right placeholder-gray-600 focus:ring-1 focus:ring-red-500/20"
                  dir="ltr"
                />
              </div>

              {/* Password field with built-in "Forgot password" Link inside the label row */}
              {authView !== 'reset' && (
                <div className="flex flex-col gap-1.5 w-full">
                  <div className="flex items-center justify-between mr-1 ml-1 text-xs">
                    <label htmlFor="auth-password" className="text-gray-400 font-bold block">كلمة السر</label>
                    {authView === 'signin' && (
                      <button
                        onClick={() => { setAuthView('reset'); setAuthError(''); }}
                        className="text-red-400 hover:text-red-300 font-bold transition-colors cursor-pointer text-[11px]"
                      >
                        نسيت كلمة السر؟
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#141414] border border-white/10 hover:border-white/20 focus:border-red-500/60 focus:bg-[#181818] outline-none text-white text-sm font-semibold py-3.5 pr-4 pl-11 rounded-xl transition-all text-right placeholder-gray-600"
                      dir="rtl"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (authView === 'signin') handleEmailSignIn();
                          else if (authView === 'signup') handleEmailSignUp();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer p-1"
                      title={showPassword ? 'إخفاء' : 'إظهار'}
                      aria-label={showPassword ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'}
                    >
                      {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Confirm Password Field (Sign up only) */}
              {authView === 'signup' && (
                <div className="flex flex-col gap-1.5 w-full">
                  <div className="flex items-center justify-between mr-1 text-xs">
                    <label htmlFor="auth-password-confirm" className="text-gray-400 font-bold block">تأكيد كلمة السر</label>
                  </div>
                  <div className="relative">
                    <input
                      id="auth-password-confirm"
                      type={showPasswordConfirm ? 'text' : 'password'}
                      value={authPasswordConfirm}
                      onChange={(e) => setAuthPasswordConfirm(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#141414] border border-white/10 hover:border-white/20 focus:border-red-500/60 focus:bg-[#181818] outline-none text-white text-sm font-semibold py-3.5 pr-4 pl-11 rounded-xl transition-all text-right placeholder-gray-600"
                      dir="rtl"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleEmailSignUp(); }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer p-1"
                      title={showPasswordConfirm ? 'إخفاء' : 'إظهار'}
                      aria-label={showPasswordConfirm ? 'إخفاء تأكيد كلمة السر' : 'إظهار تأكيد كلمة السر'}
                    >
                      {showPasswordConfirm ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-gray-500 text-[10px] leading-relaxed text-right -mt-0.5 mr-1">
                    6 خانات على الأقل، حرف كبير وحرف صغير
                  </p>
                </div>
              )}



              {/* Form Validation Errors alerts */}
              {authError && (
                <div className="text-red-400 text-xs font-semibold bg-red-500/10 border border-red-500/20 rounded-xl py-3 px-4 text-right leading-relaxed animate-fade-in">
                  {authError}
                </div>
              )}

              {/* Submit Action Button */}
              <button
                onClick={() => {
                  if (authView === 'signin') handleEmailSignIn();
                  else if (authView === 'signup') handleEmailSignUp();
                  else if (authView === 'reset') handleResetPassword();
                }}
                disabled={isAuthLoading}
                className="noir-button-primary w-full disabled:opacity-50 text-sm mt-2"
              >
                {isAuthLoading && authMethod === 'email' ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>
                    {authView === 'signin' && 'تسجيل الدخول'}
                    {authView === 'signup' && 'إنشاء حساب جديد'}
                    {authView === 'reset' && 'إرسال رابط استعادة'}
                  </span>
                )}
              </button>

              {/* Switch View Trigger Text link */}
              <div className="text-center text-xs my-2.5">
                {authView === 'signin' && (
                  <>
                    <span className="text-gray-500 font-medium">ليس لديك حساب؟ </span>
                    <button
                      onClick={() => { setAuthView('signup'); setAuthError(''); setAuthPassword(''); }}
                      className="text-[#dc2626] hover:text-red-400 font-bold transition-colors cursor-pointer"
                    >
                      أنشئ حساباً جديداً
                    </button>
                  </>
                )}
                {authView === 'signup' && (
                  <>
                    <span className="text-gray-500 font-medium">لديك حساب بالفعل؟ </span>
                    <button
                      onClick={() => { setAuthView('signin'); setAuthError(''); setAuthPassword(''); }}
                      className="text-[#dc2626] hover:text-red-400 font-bold transition-colors cursor-pointer"
                    >
                      سجل دخولك
                    </button>
                  </>
                )}
                {authView === 'reset' && (
                  <button
                    onClick={() => { setAuthView('signin'); setAuthError(''); }}
                    className="text-gray-400 hover:text-white font-semibold transition-colors cursor-pointer text-[11px]"
                  >
                    ← العودة لصفحة تسجيل الدخول
                  </button>
                )}
              </div>

              {/* OR Divider Line exactly matching mockup "Or" layout */}
              {authView !== 'reset' && (
                <div className="flex items-center gap-3 my-2.5">
                  <div className="h-px flex-1 bg-white/5" />
                  <span className="text-[10px] text-gray-500 uppercase font-black">أو</span>
                  <div className="h-px flex-1 bg-white/5" />
                </div>
              )}

              {/* Google Social login button styled with full width */}
              {authView !== 'reset' && (
                <button
                  onClick={() => handleLogin('google')}
                  disabled={isAuthLoading}
                  className="noir-button-secondary w-full disabled:opacity-50 text-xs"
                >
                  {isAuthLoading && authMethod === 'google' ? (
                    <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
                  ) : (
                    <svg className="w-[14px] h-[14px] shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  <span>دخول بجوجل</span>
                </button>
              )}

              {authView !== 'reset' && (
                <button
                  onClick={() => handleLogin('guest')}
                  disabled={isAuthLoading}
                  className="noir-button-primary w-full disabled:opacity-50 text-xs"
                >
                  متابعة التصفح بدون حساب
                </button>
              )}

            </div>

            {/* Bottom mini disclaimer footer */}
            <div className="mt-14 pt-4 border-t border-white/5 flex items-center justify-center gap-1.5 text-[9px] text-gray-600">
              <span>تطبق شروط الاستخدام والأمان الكاملة © {new Date().getFullYear()} نوار سينما</span>
            </div>
          </div>

        </div>

        {/* Toast notifications on the login screen */}
        {toastMessage && (
          <div className="fixed bottom-6 left-0 right-0 z-[600] flex justify-center pointer-events-none px-4">
            <div className="pointer-events-auto glass-strong text-white text-xs font-semibold rounded-2xl py-3 px-5 shadow-2xl flex items-center gap-2.5 select-none animate-slide-up [direction:rtl]">
              <LogoIcon className="w-4 h-4 text-red-500 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          </div>
        )}

        <style>{`
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(15px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-slide-up { animation: slideUp 0.3s ease-out forwards; }
        `}</style>
      </div>
    );
  }

  // ── فلترة الإخفاء ودمج العناصر اليدوية (بيانات الإدارة) ──
  const hiddenSet = useMemo(() => new Set(hiddenIds), [hiddenIds]);

  // يشيل أي عنصر مخفي من أي قائمة
  const applyHidden = useCallback(
    (list: MovieOrShow[]) => list.filter((it) => !hiddenSet.has(itemKey(it.type, it.id))),
    [hiddenSet]
  );

  // تحويل ManualItem (بنية الإدارة) لـ MovieOrShow (بنية العرض بالموقع).
  // العنصر اليدوي المحض (بدون tmdbId) ياخذ id سالب ثابت مشتق من uid عشان
  // نميّزه عن معرّفات TMDB (الموجبة) ويظل ثابت عبر الـ renders.
  const manualToMovie = useCallback((m: ManualItem): MovieOrShow => {
    let id = m.tmdbId ?? 0;
    if (!m.tmdbId) {
      // hash ثابت من uid → رقم سالب (djb2 مبسّط)
      let h = 0;
      for (let i = 0; i < m.uid.length; i++) h = (h * 31 + m.uid.charCodeAt(i)) | 0;
      id = -Math.abs(h) - 1; // سالب دائماً ومختلف عن 0
    }
    return {
      id,
      type: m.type,
      title: m.title,
      overview: m.overview,
      poster: m.poster,
      backdrop: m.backdrop,
      rating: m.rating,
      year: m.year,
      date: m.year ? `${m.year}-01-01` : '',
      genres: m.genres,
    };
  }, []);

  // خريطة القسم -> عناصره المضافة يدوياً (بترتيب الإضافة)، مع تجاهل المخفي
  const manualBySection = useMemo(() => {
    const map: Record<string, MovieOrShow[]> = {};
    for (const m of manualItems) {
      if (m.tmdbId && hiddenSet.has(itemKey(m.type, m.tmdbId))) continue;
      (map[m.section] ||= []).push(manualToMovie(m));
    }
    return map;
  }, [manualItems, hiddenSet, manualToMovie]);

  // عناصر الهيرو المضافة يدوياً — تُدمج فوق التلقائي (الرائج)
  const manualHeroItems = useMemo(
    () => manualItems.filter((m) => m.inHero).map(manualToMovie),
    [manualItems, manualToMovie]
  );

  // عناصر الهيرو المضافة من الداشبورد (بالبحث)
  const heroExtraItems = useMemo<MovieOrShow[]>(
    () => heroExtra.map((h) => ({
      id: h.id, type: h.type, title: h.title, overview: '',
      poster: h.poster, backdrop: h.backdrop, rating: h.rating,
      year: h.year, date: h.year ? `${h.year}-01-01` : '', genres: h.genres,
    })),
    [heroExtra]
  );

  // كل عناصر الهيرو المحتملة (مضاف + يدوي + رائج) بدون تكرار — تُعرض بالداشبورد
  const heroItemsAll = useMemo(() => {
    const seen = new Set<string>();
    const out: MovieOrShow[] = [];
    for (const it of [...heroExtraItems, ...manualHeroItems, ...applyHidden(trendingWeek)]) {
      const k = itemKey(it.type, it.id);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(it);
    }
    return out;
  }, [heroExtraItems, manualHeroItems, trendingWeek, applyHidden]);

  // الهيرو النهائي المعروض بالموقع: بعد شطب المخفي + تطبيق الترتيب المحفوظ
  const heroHiddenSet = useMemo(() => new Set(heroHiddenIds), [heroHiddenIds]);
  const heroItems = useMemo(() => {
    const visible = heroItemsAll.filter((it) => !heroHiddenSet.has(itemKey(it.type, it.id)));
    if (heroOrder.length === 0) return visible;
    const idx = (k: string) => {
      const i = heroOrder.indexOf(k);
      return i === -1 ? 9999 : i;
    };
    return [...visible].sort((a, b) => idx(itemKey(a.type, a.id)) - idx(itemKey(b.type, b.id)));
  }, [heroItemsAll, heroHiddenSet, heroOrder]);

  // أقسام الموقع التلقائية — تُمرّر للداشبورد عشان الأدمن يخفي/يظهر منها
  const siteSectionsForAdmin = useMemo(() => [
    { key: 'trending', title: 'الرائج هذا الأسبوع', items: trendingWeek },
    { key: 'upcoming', title: 'قريباً', items: upcoming },
    { key: 'nowPlaying', title: 'جديد دور السينما', items: nowPlaying },
    { key: 'popularTV', title: 'المسلسلات الموصى بها', items: popularTV },
    { key: 'popularMovies', title: 'أفلام شعبية مميزة', items: popularMovies },
  ], [trendingWeek, upcoming, nowPlaying, popularTV, popularMovies]);

  // بناء كل أقسام الرئيسية بشكل موحّد، ثم ترتيبها حسب sectionOrder من الداشبورد.
  // كل قسم: { key, title, items }. الأقسام الفاضية تُحذف عند العرض.
  const renderableSections = useMemo(() => {
    // الأصلية
    const native: { key: string; title: string; items: MovieOrShow[] }[] = [
      { key: 'trending', title: 'الرائج هذا الأسبوع', items: applyHidden(trendingWeek) },
      { key: 'upcoming', title: 'قريباً', items: applyHidden(upcoming) },
      { key: 'nowPlaying', title: 'جديد دور السينما', items: applyHidden(nowPlaying) },
      { key: 'popularTV', title: 'المسلسلات الموصى بها', items: applyHidden(popularTV) },
      { key: 'popularMovies', title: 'أفلام شعبية مميزة', items: applyHidden(popularMovies) },
    ];

    // المخصصة: يدوية + تصنيف. للتصنيف ندمج العناصر اليدوية فوق نتائج TMDB.
    const custom = customSections.map((sec) => {
      const manual = manualBySection[sec.key] || [];
      let items: MovieOrShow[] = manual;
      if (sec.kind === 'genre') {
        const genreItems = applyHidden(genreSectionData[sec.key] || []);
        // العناصر اليدوية أولاً، بعدها التصنيف (بدون تكرار)
        const seen = new Set(manual.map((m) => `${m.type}_${m.id}`));
        items = [...manual, ...genreItems.filter((g) => !seen.has(`${g.type}_${g.id}`))];
      }
      return { key: sec.key, title: sec.title, items };
    });

    const all = [...native, ...custom];

    // رتّب حسب sectionOrder؛ اللي مو بالترتيب يروح للنهاية
    const idx = (k: string) => {
      const i = sectionOrder.indexOf(k);
      return i === -1 ? 9999 : i;
    };
    return all.sort((a, b) => idx(a.key) - idx(b.key));
  }, [trendingWeek, upcoming, nowPlaying, popularTV, popularMovies, customSections, manualBySection, genreSectionData, sectionOrder, applyHidden]);

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-row font-sans relative tracking-normal antialiased">
      
      {/* Desktop Sidebar — Apple TV style */}
      <Sidebar
        activeView={activeView}
        searchMode={searchMode}
        setSearchMode={handleSetSearchMode}
        goHome={navigateToHome}
        openSearchOverlay={() => setIsSearchOverlayOpen(true)}
        onViewWatchlist={handleViewWatchlist}
        user={user}
        onOpenProfile={() => setIsProfileModalOpen(true)}
      />

      {/* Mobile Top Header — only on small screens */}
      <div className="lg:hidden">
        <Header
          activeView={activeView}
          searchMode={searchMode}
          setSearchMode={handleSetSearchMode}
          goHome={navigateToHome}
          openSearchOverlay={() => setIsSearchOverlayOpen(true)}
          user={user}
          onLogout={handleLogout}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          onViewWatchlist={handleViewWatchlist}
        />
      </div>

      {/* Main content — shifts right on desktop to account for sidebar */}
      <div className="flex-1 flex flex-col lg:mr-56 min-w-0">

      {/* Main Orchestration Views Switcher */}
      <main className="flex-grow lg:pt-0 pt-16 pb-20 lg:pb-0 selection:bg-red-500/30">
        {activeView ==='home' && (
          <PullToRefresh onRefresh={refreshHome}>
          <div className="animate-fade-in">
            {/* Display Hero slider */}
            {homeLoadError && heroItems.length === 0 ? (
              <div className="px-4 sm:px-6 lg:px-8 pt-5 mb-10">
                <div className="noir-surface min-h-[360px] flex flex-col items-center justify-center text-center px-6">
                  <WifiOff className="w-10 h-10 text-white/25 mb-4" />
                  <h1 className="text-xl font-bold text-white">تعذّر تحميل المحتوى</h1>
                  <p className="text-sm text-white/45 mt-2 max-w-md">
                    تأكد من اتصال الإنترنت وإعداد مفتاح TMDB، ثم حاول مرة ثانية.
                  </p>
                  <button onClick={() => void refreshHome()} className="noir-button-primary mt-6 text-sm">
                    إعادة المحاولة
                  </button>
                </div>
              </div>
            ) : (
              <Hero
                trendingItems={heroItems}
                onPlayClick={(item) => handleTitleClick(item)}
                onInfoClick={(item) => handleTitleClick(item)}
                onTrailerClick={(item) => handleTitleClick(item)}
                isSaved={isInWatchlist}
                onToggleSave={toggleWatchlistItem}
              />
            )}

            {/* Custom Horizontal Cinema Rows */}
            <div className="space-y-1 md:space-y-2">
              {watchlist.length > 0 && (
                <div id="watchlist-section" className="scroll-mt-20">
                  <MovieRow
                    title="قائمتي"
                    viewAllHash="#watchlist"
                    items={watchlist}
                    onItemClick={handleTitleClick}
                    onRemove={removeFromWatchlist}
                  />
</div>
              )}

              {continueWatching.length > 0 && (
                <div id="continue-watching-section" className="scroll-mt-20">
                  <ContinueWatchingRow
                    title="أكمل المشاهدة"
                    items={continueWatching}
                    onItemClick={handleTitleClick}
                    onRemove={(item) => {
                      const next = continueWatching.filter(
                        (c) => !(c.id === item.id && c.type === item.type)
                      );
                      setContinueWatching(next);
                      localStorage.setItem('noir_continue_watching_list', JSON.stringify(next));
                      localStorage.removeItem(`noir_progress_${item.type}_${item.id}`);
                      localStorage.removeItem(`noir_resume_${item.type}_${item.id}`);
                    }}
                  />
                </div>
              )}

              {/* حصري نوار — العناصر المضافة يدوياً بلا قسم مخصص (يظهر أول دائماً) */}
              {(manualBySection['manual']?.length ?? 0) > 0 && (
                <MovieRow
                  title="حصري نوار"
                  items={manualBySection['manual']}
                  onItemClick={handleTitleClick}
                />
              )}

              {/* كل الأقسام مرتّبة حسب الداشبورد (أصلية + مخصصة)، الفاضية تُحذف */}
              {renderableSections.map((sec, i) => (
                sec.items.length > 0 && (
                  <div key={sec.key}>
                    <MovieRow
                      title={sec.title}
                      items={sec.items}
                      onItemClick={handleTitleClick}
                    />
                    {/* شريط التصنيفات يظهر بعد أول قسم */}
                    {i === 0 && (
                      <>
                        <CategoryRow onSelect={(key) => { window.location.hash = `#category/${key}`; }} />
                        <StudiosRow onSelect={(key) => { window.location.hash = `#studio/${key}`; }} />
                      </>
                    )}
                  </div>
                )
              ))}
</div>
</div>
          </PullToRefresh>
        )}

        {/* Dedicated Watchlist View */}
        {activeView ==='watchlist' && (() => {
          // Process current watchlist items with filter & sort states
          let processedItems = [...watchlist];
          if (watchlistFilter !=='all') {
            processedItems = processedItems.filter(item => item.type === watchlistFilter);
          }
          if (watchlistSort ==='rating') {
            processedItems.sort((a, b) =>
              watchlistSortDir === 'asc' ? a.rating - b.rating : b.rating - a.rating
            );
          } else if (watchlistSort ==='year') {
            processedItems.sort((a, b) => {
              const yearA = parseInt(itemYear(a.year)) || 0;
              const yearB = parseInt(itemYear(b.year)) || 0;
              return watchlistSortDir === 'asc' ? yearA - yearB : yearB - yearA;
            });
          }

          // helper to parse year
          function itemYear(yr: string) {
            if (!yr) return'0';
            const m = yr.match(/\d{4}/);
            return m ? m[0] :'0';
          }

          return (
            <div className="max-w-7xl mx-auto px-6 md:px-12 py-8 animate-fade-in text-right">
              {/* Header section on Dedicated Watchlist View */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 mb-6 select-none">
                <div className="space-y-2">
                  <span className="noir-eyebrow block">مكتبتك الشخصية</span>
                  <h1 className="font-display text-3xl md:text-5xl font-bold text-white tracking-tight leading-none">
                    قائمتي
                  </h1>
                  <p className="text-white/50 text-sm font-medium">
                    كل الأعمال التي حفظتها بمكان واحد.
                  </p>
                </div>
                
                {watchlist.length > 0 && (
                  <div className="flex flex-wrap gap-2 items-center justify-start md:justify-end">
                    <label className="glass min-h-11 px-3 rounded-full flex items-center gap-2 text-xs text-white/45">
                      <span>النوع</span>
                      <select
                        value={watchlistFilter}
                        onChange={(event) => setWatchlistFilter(event.target.value as 'all' | 'movie' | 'tv')}
                        className="bg-transparent text-white font-semibold outline-none cursor-pointer"
                      >
                        <option value="all">الكل</option>
                        <option value="movie">أفلام</option>
                        <option value="tv">مسلسلات</option>
                      </select>
                    </label>

                    <label className="glass min-h-11 px-3 rounded-full flex items-center gap-2 text-xs text-white/45">
                      <span>الترتيب</span>
                      <select
                        value={watchlistSort}
                        onChange={(event) => setWatchlistSort(event.target.value as 'default' | 'rating' | 'year')}
                        className="bg-transparent text-white font-semibold outline-none cursor-pointer"
                      >
                        <option value="default">الإضافة</option>
                        <option value="rating">التقييم</option>
                        <option value="year">السنة</option>
                      </select>
                    </label>

                      {watchlistSort !== 'default' && (
                        <button
                          onClick={() => setWatchlistSortDir(watchlistSortDir === 'desc' ? 'asc' : 'desc')}
                          className="noir-icon-button"
                          title={watchlistSortDir === 'desc' ? 'تنازلي (الأعلى أولاً)' : 'تصاعدي (الأدنى أولاً)'}
                          aria-label={watchlistSortDir === 'desc' ? 'ترتيب تنازلي' : 'ترتيب تصاعدي'}
                        >
                          <ArrowUpDown className="w-4 h-4" />
                        </button>
                      )}
                  </div>
                )}
              </div>

              {watchlist.length === 0 ? (
                <div className="noir-surface flex flex-col items-center justify-center p-12 text-center mt-6 min-h-[300px]">
                  <Bookmark className="w-10 h-10 text-white/25 mb-4" />
                  <h3 className="text-lg font-bold text-white mb-2">قائمتك فارغة حالياً!</h3>
                  <p className="text-xs text-gray-400 max-w-sm leading-relaxed">
                    تصفّح العروض والمسلسلات في الصفحة الرئيسية وأضفها بالضغط على زر الحفظ في تفاصيل الفيلم.
</p>
                  <button
                    onClick={navigateToHome}
                    className="noir-button-primary mt-6 text-sm"
                  >
                    الذهاب للرئيسية وتصفّح العروض 
</button>
</div>
              ) : processedItems.length === 0 ? (
                <div className="noir-surface flex flex-col items-center justify-center p-12 text-center mt-6 min-h-[250px]">
                  <Filter className="w-9 h-9 text-white/25 mb-3" />
                  <h3 className="text-base font-bold text-white mb-1">لا توجد نتائج مطابقة!</h3>
                  <p className="text-xs text-gray-400 max-w-sm">
                    لم نجد أي أعمال تطابق الفلاتر المختارة في قائمتك الخاصة.
</p>
</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 mt-6">
                  {processedItems.map((item) => {
                    const hasScore = item.rating > 0;
                    const progressKey =`noir_progress_${item.type}_${item.id}`;
                    const storedProgress = localStorage.getItem(progressKey);
                    const progress = storedProgress ? Number(storedProgress) : 0;

                    return (
                      <div
                        key={`${item.type}-${item.id}`}
                        onClick={() => handleTitleClick(item)}
                        onKeyDown={(event) => {
                          if (event.target !== event.currentTarget) return;
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleTitleClick(item);
                          }
                        }}
                        role="link"
                        tabIndex={0}
                        aria-label={`${item.title}، ${item.type === 'movie' ? 'فيلم' : 'مسلسل'}`}
                        className="group/card cursor-pointer rounded-[18px] p-1.5 pb-3 select-none"
                      >
                        {/* Poster Artwork container */}
                        <div className="noir-card relative aspect-[2/3]">
                          {/* Remove from watchlist button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromWatchlist(item);
                            }}
                            className="absolute top-2 left-2 z-10 w-10 h-10 rounded-full glass flex items-center justify-center text-white/80 hover:text-white opacity-100 lg:opacity-0 lg:group-hover/card:opacity-100 transition-opacity hover:bg-white/20 cursor-pointer"
                            title="إزالة من قائمتي"
                            aria-label={`إزالة ${item.title} من قائمتي`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                          {item.poster || item.backdrop ? (
                            <img
                              src={item.poster || item.backdrop || undefined}
                              alt={item.title}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover select-none transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center p-3 text-stone-600 bg-stone-950">
                              <span className="text-[10px] sm:text-xs font-semibold text-center leading-normal break-all line-clamp-2">
                                {item.title}
</span>
</div>
                          )}

                          {/* Subtle gradient at bottom of poster for depth */}
                          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 pointer-events-none" />

                          {/* Rating stamp */}
                          {hasScore && (
                            <div className="absolute bottom-2 right-2 glass text-[#f5c518] text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-lg flex items-center gap-0.5">
                              <Star className="w-2.5 h-2.5 fill-current" />
                              <span>{item.rating.toFixed(1)}</span>
</div>
                          )}

                          {/* Watch progression indicator red bar */}
                          {progress > 0 && (
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                              <div 
                                className="h-full bg-white transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              />
</div>
                          )}
</div>

                        {/* Meta details */}
                        <div className="mt-2.5 px-1 text-right flex flex-col">
                          <span className="text-white font-bold text-xs sm:text-sm line-clamp-1 leading-tight transition-colors">
                            {item.title}
</span>
                          <span className="text-stone-500 font-semibold text-[10px] sm:text-xs mt-1 flex items-center gap-1 justify-start">
                            <span>{item.year ||'—'}</span>
                            <span className="w-1 h-1 bg-stone-800 rounded-full" />
                            <span>{item.type ==='movie' ?'فيلم' :'مسلسل'}</span>
</span>
</div>
</div>
                    );
                  })}
</div>
              )}
</div>
          );
        })()}


        {activeView ==='search' && (
          <div className="max-w-7xl mx-auto px-6 md:px-12 py-8 animate-fade-in">
            {/* Header section on Dedicated Search View */}
            <div className="mb-8">
              <span className="noir-eyebrow block mb-2">استكشف المكتبة</span>
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
                <div>
                  <h1 className="font-display text-3xl md:text-5xl font-bold text-white tracking-tight leading-none mb-3">
                    {searchMode ==='tv' ?'المسلسلات' :'الأفلام'}
                  </h1>
                  <p className="text-white/55 text-sm font-medium max-w-xl">
                    اختيارات مرتبة، بحث سريع، وفلاتر عند الحاجة.
                  </p>
                </div>
                <div className="inline-flex self-start bg-white/[0.07] border border-white/10 rounded-full p-1">
                  <button
                    onClick={() => handleSetSearchMode('movie')}
                    className={`min-h-10 px-5 rounded-full text-sm font-semibold transition-colors ${
                      searchMode === 'movie' ? 'bg-white text-black' : 'text-white/55 hover:text-white'
                    }`}
                  >
                    أفلام
                  </button>
                  <button
                    onClick={() => handleSetSearchMode('tv')}
                    className={`min-h-10 px-5 rounded-full text-sm font-semibold transition-colors ${
                      searchMode === 'tv' ? 'bg-white text-black' : 'text-white/55 hover:text-white'
                    }`}
                  >
                    مسلسلات
                  </button>
                </div>
              </div>
            </div>

            {/* Direct Input Filter bar */}
            <div className="flex gap-3 mb-6 relative z-10">
              <div className="glass-strong flex-1 flex items-center gap-3 px-4 py-3 rounded-[18px]">
                <Search className="w-5 h-5 text-white/40 shrink-0" />
                <input
                  type="text"
                  value={fQuery}
                  onChange={(e) => setFQuery(e.target.value)}
                  placeholder="ابحث بالعنوان، الكلمات المفتاحية..."
                  aria-label="البحث في المكتبة"
                  className="flex-1 min-w-0 bg-transparent border-0 outline-none text-white text-sm md:text-base font-medium placeholder:text-white/30 text-right"
                />
</div>

              <button
                onClick={() => setIsFilterSidebarOpen(!isFilterSidebarOpen)}
                className={`min-h-12 flex items-center justify-center gap-2 px-4 rounded-[18px] border text-xs font-semibold cursor-pointer transition-colors ${
                  isFilterSidebarOpen
                    ?'bg-white text-black border-white'
                    :'bg-white/[0.07] text-white/65 border-white/10 hover:text-white'
                }`}
                aria-expanded={isFilterSidebarOpen}
              >
                <Filter className="w-4 h-4" />
                <span>التصفية</span>
</button>
</div>

            <div>
              
              <div className="min-w-0">
                
                {/* Search Sorting Metrics controller */}
                <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
                  <span className="text-xs text-stone-400 font-medium">
                    {searchResults.length > 0 ?`${searchResults.length} عنوان ظاهر حالياً` :'لا توجد نتائج مناسبة'}
</span>
                  
                  <div className="flex items-center gap-1.5 min-w-[140px]">
                    <ArrowUpDown className="w-4 h-4 text-stone-500" />
                    <select
                      value={fSort}
                      onChange={(e) => setFSort(e.target.value)}
                      className="bg-white/[0.07] text-white border border-white/10 rounded-full px-4 py-2 text-xs font-semibold focus:outline-none cursor-pointer"
                    >
                      <option value="trend">الرائج عالمياً</option>
                      <option value="rating">الأعلى تقييماً</option>
                      <option value="year">تاريخ الإصدار</option>
                      <option value="az">ترتيب أبجدي (A-Z)</option>
</select>
</div>
</div>

                {isSearching ? (
                  // Grid Skeletons loading fallback
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {Array.from({ length: 15 }).map((_, i) => (
                      <div key={i} className="flex flex-col gap-3">
                        <div className="aspect-[2/3] w-full rounded-2xl bg-stone-950 border border-white/5 flex flex-col justify-end p-2 animate-pulse">
                          <div className="w-full h-full bg-stone-900 rounded-xl shimmer-bg" />
</div>
                        <div className="w-24 h-4 bg-stone-900 rounded animate-pulse" />
                        <div className="w-16 h-3 bg-stone-900 rounded animate-pulse" />
</div>
                    ))}
</div>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-8">
                    {/* Rendered lists grid layout */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5">
                      {searchResults.map((item, idx) => (
                        <div
                          key={`${item.type}-${item.id}`}
                          onClick={() => handleTitleClick(item)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              handleTitleClick(item);
                            }
                          }}
                          role="link"
                          tabIndex={0}
                          aria-label={`${item.title}، ${item.type === 'movie' ? 'فيلم' : 'مسلسل'}`}
                          style={{ animationDelay: `${idx * 40}ms` }}
                          className="group/card cursor-pointer rounded-[18px] p-1.5 pb-3 select-none"
                        >
                          {/* Poster Artwork container */}
                          <div className="noir-card relative aspect-[2/3]">
                            {item.poster || item.backdrop ? (
                              <img
                                src={item.poster || item.backdrop || undefined}
                                alt={item.title}
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover select-none transition-transform duration-500"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center p-3 text-stone-600 bg-stone-950">
                                <span className="text-[10px] sm:text-xs font-semibold text-center leading-normal break-all line-clamp-2">
                                  {item.title}
                                </span>
                              </div>
                            )}

                            {/* Subtle gradient at bottom of poster for depth */}
                            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 pointer-events-none" />

                            {/* Rating stamp */}
                            {item.rating > 0 && (
                              <div className="absolute bottom-2 right-2 glass text-[#f5c518] text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-lg flex items-center gap-0.5">
                                <span>★</span>
                                <span>{item.rating.toFixed(1)}</span>
</div>
                            )}
</div>

                          {/* Meta details */}
                          <div className="mt-2.5 px-1 text-right flex flex-col">
                            <span className="text-white font-bold text-xs sm:text-sm line-clamp-1 leading-tight transition-colors">
                              {item.title}
</span>
                            <span className="text-stone-500 font-semibold text-[10px] sm:text-xs mt-1 flex items-center gap-1 justify-start">
                              <span>{item.year ||'—'}</span>
                              <span className="w-1 h-1 bg-stone-800 rounded-full" />
                              <span>{item.type === 'movie' ? 'فيلم' : 'مسلسل'}</span>
</span>
</div>
</div>
                      ))}
</div>

                    {/* Paginated trigger load more items button */}
                    {searchPage < searchTotalPages && (
                      <div className="flex justify-center pt-4">
                        <button
                          onClick={() => triggerSearchQuery(true)}
                          disabled={isLoadingMore}
                          className="noir-button-secondary flex items-center gap-2 text-xs disabled:opacity-50"
                        >
                          {isLoadingMore ? (
                            <>
                              <Loader className="w-4 h-4 text-red-500 animate-spin" />
                              <span>جاري التحميل...</span>
</>
                          ) : (
                            <span>عرض المزيد من العناوين</span>
                          )}
</button>
</div>
                    )}
</div>
                ) : (
                  <div className="noir-surface py-20 text-center flex flex-col items-center justify-center gap-4 px-6">
                    <Search className="w-9 h-9 text-white/20" />
                    <h3 className="text-sm font-bold text-white">لم نجد أي عناوين مطابقة</h3>
                    <p className="text-xs text-gray-500 max-w-xs">
                      جرب تغيير عوامل التصفية المختارة، أو اختصر العناوين في مربع البحث للوصول لنتائج أفضل.
</p>
</div>
                )}
</div>

              <div
                className={isFilterSidebarOpen
                  ? 'fixed inset-0 z-[450] bg-black/65 backdrop-blur-sm p-3 sm:p-6 flex justify-end'
                  : 'hidden'}
                onClick={(event) => {
                  if (event.target === event.currentTarget) setIsFilterSidebarOpen(false);
                }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="filter-panel-title"
              >
                <div className="glass-strong h-full w-full max-w-sm rounded-[24px] p-5 sm:p-6 overflow-y-auto space-y-6 text-right">
                  <div className="flex justify-between items-center border-b border-white/[0.08] pb-4">
                    <h3 id="filter-panel-title" className="text-lg font-bold text-white">خيارات التصفية</h3>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleResetFilters}
                        className="min-h-10 px-3 text-xs text-white/45 hover:text-white"
                      >
                        مسح الكل
                      </button>
                    <button
                      onClick={() => setIsFilterSidebarOpen(false)}
                      className="noir-icon-button !w-10 !min-w-10 !min-h-10"
                      aria-label="إغلاق خيارات التصفية"
                    >
                      <X className="w-4 h-4" />
</button>
                    </div>
</div>

                  {/* Select Dropdown: Genres */}
                  {MOVIE_GENRES.length > 0 && !fQuery.trim() && (
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400 font-bold">التصنيف</label>
                      <select
                        onChange={(e) => {
                          const id = Number(e.target.value);
                          const next = new Set<number>();
                          if (id > 0) next.add(id);
                          setSelectedGenres(next);
                        }}
                        value={Array.from(selectedGenres)[0] ||""}
                        className="noir-select"
                      >
                        <option value="">كل التصنيفات</option>
                        {MOVIE_GENRES.map((g) => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
</select>
</div>
                  )}

                  {/* Select Dropdown: Release Year */}
                  {!fQuery.trim() && (
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400 font-bold">سنة الإصدار</label>
                      <select
                        value={selectedYear ||""}
                        onChange={(e) => setSelectedYear(e.target.value || null)}
                        className="noir-select"
                      >
                        <option value="">كل السنوات</option>
                        {YEARS.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
</select>
</div>
                  )}

                  {/* Select Dropdown: Rating */}
                  {!fQuery.trim() && (
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400 font-bold">الحد الأدنى للتقييم</label>
                      <select
                        value={selectedRating ||""}
                        onChange={(e) => setSelectedRating(e.target.value || null)}
                        className="noir-select"
                      >
                        <option value="">كل التقييمات</option>
                        {RATINGS.map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
</select>
</div>
                  )}

                  {/* Select Dropdown: Country of origin */}
                  {!fQuery.trim() && (
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400 font-bold">جهة الإنتاج</label>
                      <select
                        value={selectedCountry ||""}
                        onChange={(e) => setSelectedCountry(e.target.value || null)}
                        className="noir-select"
                      >
                        <option value="">كل جهات الإنتاج</option>
                        {COUNTRIES.map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
</select>
</div>
                  )}

                  {/* Select Dropdown: Language */}
                  {!fQuery.trim() && (
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400 font-bold">اللغة الصوتية</label>
                      <select
                        value={selectedLanguage ||""}
                        onChange={(e) => setSelectedLanguage(e.target.value || null)}
                        className="noir-select"
                      >
                        <option value="">كل اللغات</option>
                        {LANGS.map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
</select>
</div>
                  )}

                  {/* Select Dropdown: Duration */}
                  {!fQuery.trim() && (
                    <div className="space-y-2.5 pb-6">
                      <label className="text-xs text-gray-400 font-bold">مدة العرض</label>
                      <select
                        value={selectedRuntime ||""}
                        onChange={(e) => setSelectedRuntime(e.target.value || null)}
                        className="noir-select"
                      >
                        <option value="">كل المدد</option>
                        {RUNTIMES.map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
</select>
</div>
                  )}
                  
</div>
</div>

</div>
</div>
        )}

        {activeView ==='detail' && selectedTitle && (
          <Suspense fallback={<ViewFallback />}>
            <div className="animate-fade-in block">
              <DetailView
              type={selectedTitle.type}
              id={selectedTitle.id}
              initialSeason={selectedEpisodeRoute?.season}
              initialEpisode={selectedEpisodeRoute?.episode}
              onEpisodeChange={handleEpisodeRouteChange}
              onBackClick={navigateToHome}
              onItemClick={handleTitleClick}
              onOpenShare={handleOpenShare}
              user={user}
              showToast={showToast}
              autoOpenWatchTogether={joinRoomCode}
              onClearAutoOpenWatchTogether={() => setJoinRoomCode('')}
              watchlist={watchlist}
              manualData={(() => {
                // عنصر يدوي محض: id سالب. نلقاه ونمرّر بياناته
                if (selectedTitle.id >= 0) return null;
                const m = manualItems.find((mi) => !mi.tmdbId && manualToMovie(mi).id === selectedTitle.id);
                if (!m) return null;
                return {
                  title: m.title, overview: m.overview, poster: m.poster, backdrop: m.backdrop,
                  rating: m.rating, year: m.year, genres: m.genres, director: m.director,
                  country: m.country, language: m.language,
                };
              })()}
              />
            </div>
          </Suspense>
        )}

        {activeView ==='category' && selectedCategoryKey && getCategoryByKey(selectedCategoryKey) && (
          <Suspense fallback={<ViewFallback />}>
            <CategoryPage
              category={getCategoryByKey(selectedCategoryKey)!}
              onItemClick={handleTitleClick}
              onBack={navigateToHome}
              showAllMode={categoryAllMode}
              onOpenAll={(key) => { window.location.hash = `#category/${key}/all`; }}
            />
          </Suspense>
        )}

        {activeView ==='studio' && selectedStudioKey && getStudioByKey(selectedStudioKey) && (
          <Suspense fallback={<ViewFallback />}>
            <StudioPage
              studio={getStudioByKey(selectedStudioKey)!}
              onItemClick={handleTitleClick}
              onBack={navigateToHome}
            />
          </Suspense>
        )}

        {activeView ==='admin' && (
          <Suspense fallback={<ViewFallback />}>
            <AdminDashboard
              userEmail={user?.email}
              onBack={navigateToHome}
              siteSections={siteSectionsForAdmin}
              hiddenIds={hiddenIds}
              onToggleHidden={(type, id, hide) => { toggleHidden(type, id, hide); }}
              heroItems={heroItemsAll}
              heroHiddenIds={heroHiddenIds}
              onToggleHeroHidden={(type, id, hide) => { toggleHeroHidden(type, id, hide); }}
            />
          </Suspense>
        )}
</main>

      {activeView !== 'detail' && activeView !== 'admin' && (
        <Footer goHome={navigateToHome} setSearchMode={handleSetSearchMode} />
      )}

      </div>{/* end main content wrapper */}

      {/* iOS/Android style bottom navigation bar on touchscreens */}
      <MobileNav
        activeView={activeView}
        searchMode={searchMode}
        setSearchMode={handleSetSearchMode}
        goHome={navigateToHome}
        openSearchOverlay={() => setIsSearchOverlayOpen(true)}
        onViewWatchlist={handleViewWatchlist}
      />

      {/* Cmd+K QuickSearch predicting suggestions overlay */}
      {isSearchOverlayOpen && (
        <Suspense fallback={null}>
          <SearchOverlay
            isOpen
            onClose={() => setIsSearchOverlayOpen(false)}
            onSelectTitle={handleQuickSelectTitle}
            onBrowseCategory={(key) => {
              setIsSearchOverlayOpen(false);
              window.location.hash = `#category/${key}`;
            }}
          />
        </Suspense>
      )}

      {/* Browser URL Share Dialog */}
      <ShareModal
        isOpen={isShareModalOpen}
        url={shareUrl}
        onClose={() => setIsShareModalOpen(false)}
        onToast={showToast}
      />

      {/* Google Account Profile Details Dialog Modal */}
      {isProfileModalOpen && user && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 text-right" role="dialog" aria-modal="true" aria-labelledby="profile-dialog-title">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/85 backdrop-blur-md cursor-pointer animate-fade-in" 
            onClick={() => setIsProfileModalOpen(false)}
          />

          {/* Modal Container */}
          <div className="noir-surface relative z-10 w-full max-w-sm p-6 md:p-8 shadow-2xl text-center animate-scale-in">
            {/* Close Trigger Button */}
            <button
              onClick={() => setIsProfileModalOpen(false)}
              className="noir-icon-button !w-10 !min-w-10 !min-h-10 absolute top-4 left-4"
              aria-label="إغلاق الملف الشخصي"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
</svg>
</button>

            {/* Profile Avatar Frame */}
            <div className="flex flex-col items-center gap-4 mt-2">
              <div className="w-20 h-20 rounded-full p-1 bg-white/5 border border-white/10 shadow-xl overflow-hidden relative flex items-center justify-center">
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.name} 
                    className="w-full h-full rounded-full object-cover" 
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <div className="w-full h-full rounded-full flex items-center justify-center bg-indigo-600 text-white font-extrabold text-2xl uppercase">
                    {user.name.slice(0, 2)}
</div>
                )}
                <div className={`absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full border border-stone-950 ${user.type ==='google' ?'bg-indigo-500' : user.type === 'email' ? 'bg-red-500' : 'bg-emerald-500'}`} />
</div>

              {/* User Bio Information */}
              <div className="space-y-1 text-center">
                <h3 id="profile-dialog-title" className="text-lg font-extrabold text-white leading-snug">{user.name}</h3>
                {user.email && (
                  <p className="text-xs text-gray-400 font-medium font-mono select-text">{user.email}</p>
                )}
                {user.type ==='guest' ? (
                  <span className="inline-block bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full mt-1">
                    أنت مسجل حالياً كضيف
</span>
                ) : user.type === 'email' ? (
                  <div className="flex flex-col items-center gap-2 mt-1">
                    <span className="inline-block bg-red-500/10 border border-red-500/25 text-red-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                      حساب نوار سينما
                    </span>
                    {auth.currentUser?.emailVerified === false && (
                      <div className="mt-1 flex flex-col items-center gap-1.5 p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl max-w-[240px] mx-auto">
                        <p className="text-[10px] text-amber-400 font-bold leading-normal">
                          البريد الإلكتروني غير مفعّل ⚠️
                        </p>
                        <p className="text-[9px] text-gray-400 leading-normal">
                          السحابة تمنع الحفظ لغير المفعّلين لحماية بياناتك.
                        </p>
                        <button
                          onClick={handleSendVerificationEmail}
                          disabled={isSendingVerification}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 underline font-extrabold cursor-pointer disabled:opacity-50"
                        >
                          {isSendingVerification ? 'جاري الإرسال...' : 'إرسال رابط تفعيل البريد'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="inline-block bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full mt-1">
                    حساب جوجل مفعل وموثق 
</span>
                )}
</div>
</div>



            {/* Restrict warning or list status */}
            <div className="mt-8 p-3.5 rounded-2xl bg-stone-900/60 border border-white/5 text-right space-y-1">
              <p className="text-[10px] text-gray-500 font-bold leading-normal">إحصائيات القائمة والنشاط</p>
              <div className="text-xs text-gray-300 font-semibold leading-relaxed">
                {user.type ==='guest' ? (
                  <span className="text-white/55 block">محفوظاتك موجودة على هذا الجهاز. سجّل الدخول إذا تريد مزامنتها بين أجهزتك.</span>
                ) : (
                  <span>مجموع العناوين المضافة لقائمتك الخاصة: <strong className="text-red-400">{watchlist.length} عنوان</strong></span>
                )}
</div>
</div>

            {/* Action buttons */}
            <div className="mt-6 flex flex-col gap-2">
              {user.type ==='guest' && (
                <button
                  onClick={() => {
                    setIsProfileModalOpen(false);
                    handleLogout();
                  }}
                  className="noir-button-primary w-full text-xs"
                >
                  تسجيل الدخول أو إنشاء حساب
</button>
              )}
              {user.type !== 'guest' && (
                <button
                  onClick={() => {
                    handleLogout();
                    setIsProfileModalOpen(false);
                  }}
                  className="noir-button-secondary w-full text-xs text-[#ff453a]"
                >
                  تسجيل الخروج من الحساب
                </button>
              )}
</div>
</div>
</div>
      )}

      {/* Floating Success Indicator Toast notifications */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-6 left-0 right-0 z-[600] flex justify-center pointer-events-none px-4">
          <div className="pointer-events-auto glass-strong text-white text-xs font-semibold rounded-full py-3 px-6 shadow-2xl flex items-center gap-2.5 select-none animate-slide-up [direction:rtl]">
            <LogoIcon className="w-4 h-4 text-red-500 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Direct inline classes style supporting some animation frames */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-slide-up {
          animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-pop-in {
          animation: popIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
`}</style>
      
</div>
  );
}
