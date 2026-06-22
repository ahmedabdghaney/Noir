/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import { useState, useEffect, useRef } from 'react';
import { Search, Loader, Filter, Trash2, ArrowUpDown, ChevronDown, CheckCircle, Eye, EyeOff, Star } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, loginWithGoogle, logoutUser, signInWithEmail, signUpWithEmail, resetPassword, checkSignInMethods, translateAuthError } from './lib/firebase';
import { MovieOrShow } from './types';
import {
  initializeGenres,
  fetchTrendingWeek,
  fetchNowPlaying,
  fetchPopularTV,
  fetchPopularMovies,
  discoverTitles,
  searchTitles,
  MOVIE_GENRES,
} from './lib/tmdb';

// Component Imports
import Header from './components/Header';
import Hero from './components/Hero';
import MovieRow from './components/MovieRow';
import DetailView from './components/DetailView';
import SearchOverlay from './components/SearchOverlay';
import ShareModal from './components/ShareModal';
import MobileNav from './components/MobileNav';
import Footer from './components/Footer';

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

export default function App() {
  // Navigation & View State
  const [activeView, setActiveView] = useState<'home' | 'search' | 'detail' | 'watchlist'>('home');
  const [searchMode, setSearchMode] = useState<'movie' | 'tv'>('movie');
  const [selectedTitle, setSelectedTitle] = useState<{ type: 'movie' | 'tv'; id: number } | null>(null);
  const [joinRoomCode, setJoinRoomCode] = useState<string>('');

  // User Profile Modal active state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Watchlist custom filter & sorting options
  const [watchlistFilter, setWatchlistFilter] = useState<'all' | 'movie' | 'tv'>('all');
  const [watchlistSort, setWatchlistSort] = useState<'default' | 'rating' | 'year'>('default');

  // Authentication Management State
  const [user, setUser] = useState<{ name: string; email?: string; photoURL?: string; type: 'guest' | 'google' | 'email' } | null>(() => {
    try {
      const stored = localStorage.getItem('noir_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.type ==='guest') {
          localStorage.removeItem('noir_user');
          return null;
        }
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  });
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authMethod, setAuthMethod] = useState<'guest' | 'google' | 'email' | null>(null);

  // Email auth form state
  const [authView, setAuthView] = useState<'menu' | 'signin' | 'signup' | 'reset'>('menu');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  // Synchronize authenticated identity with Firebase state-listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const isEmailOnly = firebaseUser.providerData?.[0]?.providerId === 'password';
        const userData = {
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] ||'مستخدم نوار',
          email: firebaseUser.email || undefined,
          photoURL: firebaseUser.photoURL || undefined,
          type: (isEmailOnly ? 'email' : 'google') as 'email' | 'google',
        };
        localStorage.setItem('noir_user', JSON.stringify(userData));
        setUser(userData);
      } else {
        const stored = localStorage.getItem('noir_user');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed.type ==='google' || parsed.type === 'email') {
              setUser(null);
              localStorage.removeItem('noir_user');
            }
          } catch {
            localStorage.removeItem('noir_user');
          }
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Bookmark / Watchlist feeds
  const [watchlist, setWatchlist] = useState<MovieOrShow[]>([]);

  // Home Lists Feeds State
  const [trendingWeek, setTrendingWeek] = useState<MovieOrShow[]>([]);
  const [nowPlaying, setNowPlaying] = useState<MovieOrShow[]>([]);
  const [popularTV, setPopularTV] = useState<MovieOrShow[]>([]);
  const [popularMovies, setPopularMovies] = useState<MovieOrShow[]>([]);
  const [isHomeLoading, setIsHomeLoading] = useState(true);

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
      } catch (error) {
        console.error("Google login failed: ", error);
        showToast('فشل تسجيل الدخول باستخدام جوجل');
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
      // First check what sign-in methods exist for this email
      const methods = await checkSignInMethods(authEmail);
      if (methods.length === 0) {
        setAuthError('ما عندنا حساب بهذا البريد، تأكد منه أو أنشئ حساب جديد');
        return;
      }
      if (!methods.includes('password')) {
        if (methods.includes('google.com')) {
          setAuthError('هذا البريد مسجّل عبر Google، رجاءً سجّل دخولك بزر Google مباشرة');
        } else {
          setAuthError('هذا البريد مسجّل بطريقة لا تدعم استعادة كلمة السر');
        }
        return;
      }
      await resetPassword(authEmail);
      showToast('أرسلنا رابط إعادة التعيين لبريدك، افحص الإيميل (أو مجلد السبام)');
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

  const handleViewWatchlist = () => {
    setActiveView('watchlist');
    setSelectedTitle(null);
    window.location.hash ='#watchlist';
  };

  const loadWatchlist = () => {
    try {
      const saved = localStorage.getItem('noir_watchlist');
      if (saved) {
        setWatchlist(JSON.parse(saved));
      } else {
        setWatchlist([]);
      }
    } catch {
      setWatchlist([]);
    }
  };

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
      } else {
        const movieMatch = hash.match(/^#movie\/(\d+)$/);
        const tvMatch = hash.match(/^#tv\/(\d+)$/);

        if (movieMatch) {
          setSelectedTitle({ type: 'movie', id: Number(movieMatch[1]) });
          setActiveView('detail');
        } else if (tvMatch) {
          setSelectedTitle({ type: 'tv', id: Number(tvMatch[1]) });
          setActiveView('detail');
        } else {
          window.location.hash ='#home';
        }
      }
    };

    // Initialize genres mapping list first
    setIsHomeLoading(true);
    initializeGenres()
      .then(() => {
        // Load Home feeds concurrent
        return Promise.all([
          fetchTrendingWeek().then(setTrendingWeek),
          fetchNowPlaying().then(setNowPlaying),
          fetchPopularTV().then(setPopularTV),
          fetchPopularMovies().then(setPopularMovies),
        ]);
      })
      .then(() => {
        setIsHomeLoading(false);
      })
      .catch(() => {
        setIsHomeLoading(false);
      });

    window.addEventListener('hashchange', handleHashRouting);
    // Boot active hash route immediately
    handleHashRouting();

    // Load initial watchlist feed
    loadWatchlist();
    window.addEventListener('watchlist_updated', loadWatchlist);

    return () => {
      window.removeEventListener('hashchange', handleHashRouting);
      window.removeEventListener('watchlist_updated', loadWatchlist);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

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
    setActiveView('home');
    setSelectedTitle(null);
    window.location.hash ='#home';
  };

  const handleSetSearchMode = (mode: 'movie' | 'tv') => {
    setSearchMode(mode);
    setActiveView('search');
    setSelectedTitle(null);
    window.location.hash = mode ==='tv' ?'#tv' :'#movies';
  };

  const handleTitleClick = (item: MovieOrShow) => {
    window.location.hash =`#${item.type}/${item.id}`;
  };

  const handleQuickSelectTitle = (type: 'movie' | 'tv', id: number) => {
    window.location.hash =`#${type}/${id}`;
  };

  const handleOpenShare = (url: string) => {
    setShareUrl(url);
    setIsShareModalOpen(true);
  };

  // Category filter chips controllers
  const toggleGenreChip = (id: number) => {
    const next = new Set(selectedGenres);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedGenres(next);
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
      <div className="relative min-h-screen bg-[#060606] text-white flex flex-col items-center justify-center font-sans overflow-hidden">
        {/* Subtle dynamic background posters backdrop */}
        <div className="absolute inset-0 z-0 bg-cover bg-center opacity-30 blur-[6px] select-none scale-105 transition-all duration-1000"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1425&auto=format&fit=crop')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/85 to-transparent z-0" />

        {/* Center Container */}
        <div className="relative z-10 w-full max-w-md px-8 py-10 bg-[#0a0a0abf] backdrop-blur-2xl border border-white/5 rounded-3xl shadow-3xl text-center select-none animate-pop-in mx-4">
          {/* Logo brand */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/25">
              <span className="text-white text-xl font-black">N</span>
</div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white m-0">نوار <span className="text-red-500 font-black">سينما</span></h1>
</div>

          <p className="text-gray-400 text-xs md:text-sm font-semibold mb-8 max-w-sm mx-auto leading-relaxed">
            مرحباً بك في بوابتك لمشاهدة وتصفح العروض والأفلام. اختر وسيلة تسجيل الدخول المناسبة للبدء فوراً بمتابعة سهرتك الليلة
</p>

          <div className="flex flex-col gap-3 w-full">
            {authView === 'menu' && (
              <>
                <button
                  onClick={() => handleLogin('google')}
                  disabled={isAuthLoading}
                  className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 disabled:opacity-50 text-gray-900 font-bold py-3.5 px-6 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer text-sm shadow-xl shadow-black/20"
                >
                  {isAuthLoading && authMethod === 'google' ? (
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
                  ) : (
                    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  <span>تسجيل الدخول باستخدام Google</span>
                </button>

                <div className="flex items-center gap-3 my-1">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-[10px] text-gray-500 font-bold">أو</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                <button
                  onClick={() => { setAuthView('signin'); setAuthError(''); }}
                  className="w-full bg-white/5 hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-white font-bold py-3.5 px-6 rounded-xl transition-all cursor-pointer text-sm"
                >
                  الدخول بالبريد الإلكتروني
                </button>

                <div className="text-center pt-3 text-xs">
                  <span className="text-gray-500">ما عندك حساب؟ </span>
                  <button
                    onClick={() => { setAuthView('signup'); setAuthError(''); }}
                    className="text-red-400 hover:text-red-300 font-bold transition-colors cursor-pointer"
                  >
                    أنشئ حساب جديد
                  </button>
                </div>
              </>
            )}

            {(authView === 'signin' || authView === 'signup') && (
              <>
                <div className="text-right mb-1">
                  <h2 className="text-white text-base font-extrabold">
                    {authView === 'signin' ? 'تسجيل الدخول' : 'إنشاء حساب'}
                  </h2>
                  <p className="text-gray-500 text-[11px] mt-0.5">
                    {authView === 'signin' ? 'مرحباً بعودتك، أكمل بياناتك للدخول' : 'كم خطوة وتنضم لـ نوار سينما'}
                  </p>
                </div>

                {authView === 'signup' && (
                  <input
                    type="text"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="الاسم"
                    className="w-full bg-white/5 border border-white/10 focus:border-red-500/60 focus:bg-white/[0.07] outline-none text-white text-sm font-semibold py-3.5 px-4 rounded-xl transition-colors text-right placeholder-gray-500"
                    dir="rtl"
                  />
                )}
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="البريد الإلكتروني"
                  className="w-full bg-white/5 border border-white/10 focus:border-red-500/60 focus:bg-white/[0.07] outline-none text-white text-sm font-semibold py-3.5 px-4 rounded-xl transition-colors text-right placeholder-gray-500"
                  dir="rtl"
                />
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="كلمة السر"
                    className="w-full bg-white/5 border border-white/10 focus:border-red-500/60 focus:bg-white/[0.07] outline-none text-white text-sm font-semibold py-3.5 pr-4 pl-11 rounded-xl transition-colors text-right placeholder-gray-500"
                    dir="rtl"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && authView === 'signin') {
                        handleEmailSignIn();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer p-1"
                    title={showPassword ? 'إخفاء' : 'إظهار'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {authView === 'signup' && (
                  <>
                    <div className="relative">
                      <input
                        type={showPasswordConfirm ? 'text' : 'password'}
                        value={authPasswordConfirm}
                        onChange={(e) => setAuthPasswordConfirm(e.target.value)}
                        placeholder="أعد كلمة السر"
                        className="w-full bg-white/5 border border-white/10 focus:border-red-500/60 focus:bg-white/[0.07] outline-none text-white text-sm font-semibold py-3.5 pr-4 pl-11 rounded-xl transition-colors text-right placeholder-gray-500"
                        dir="rtl"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleEmailSignUp(); }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer p-1"
                        title={showPasswordConfirm ? 'إخفاء' : 'إظهار'}
                      >
                        {showPasswordConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-gray-500 text-[10px] leading-relaxed text-right -mt-1">
                      6 خانات على الأقل، حرف كبير وحرف صغير
                    </p>
                  </>
                )}

                {authError && (
                  <div className="text-red-400 text-xs font-semibold bg-red-500/10 border border-red-500/20 rounded-lg py-2 px-3 text-right leading-relaxed">
                    {authError}
                  </div>
                )}

                <button
                  onClick={authView === 'signin' ? handleEmailSignIn : handleEmailSignUp}
                  disabled={isAuthLoading}
                  className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold py-3.5 px-6 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer text-sm shadow-xl shadow-red-600/20 mt-1"
                >
                  {isAuthLoading && authMethod === 'email' ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>{authView === 'signin' ? 'دخول' : 'إنشاء الحساب'}</span>
                  )}
                </button>

                {authView === 'signin' && (
                  <button
                    onClick={() => { setAuthView('reset'); setAuthError(''); }}
                    className="text-gray-400 hover:text-red-400 text-[11px] font-semibold transition-colors cursor-pointer text-center pt-1"
                  >
                    نسيت كلمة السر؟
                  </button>
                )}

                <div className="h-px bg-white/10 my-1" />

                <div className="text-center text-xs">
                  {authView === 'signin' ? (
                    <>
                      <span className="text-gray-500">ما عندك حساب؟ </span>
                      <button
                        onClick={() => { setAuthView('signup'); setAuthError(''); setAuthPassword(''); }}
                        className="text-red-400 hover:text-red-300 font-bold transition-colors cursor-pointer"
                      >
                        أنشئ حساب جديد
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-gray-500">عندك حساب؟ </span>
                      <button
                        onClick={() => { setAuthView('signin'); setAuthError(''); setAuthPassword(''); }}
                        className="text-red-400 hover:text-red-300 font-bold transition-colors cursor-pointer"
                      >
                        سجّل الدخول
                      </button>
                    </>
                  )}
                </div>

                <button
                  onClick={() => { setAuthView('menu'); setAuthError(''); }}
                  className="text-gray-500 hover:text-gray-300 text-[11px] font-semibold transition-colors cursor-pointer text-center"
                >
                  ← رجوع للخيارات
                </button>
              </>
            )}

            {authView === 'reset' && (
              <>
                <div className="text-right mb-1">
                  <h2 className="text-white text-base font-extrabold">استعادة كلمة السر</h2>
                  <p className="text-gray-500 text-[11px] mt-0.5">
                    أدخل بريدك ونرسلك رابط لإعادة التعيين
                  </p>
                </div>

                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="البريد الإلكتروني"
                  className="w-full bg-white/5 border border-white/10 focus:border-red-500/60 focus:bg-white/[0.07] outline-none text-white text-sm font-semibold py-3.5 px-4 rounded-xl transition-colors text-right placeholder-gray-500"
                  dir="rtl"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleResetPassword(); }}
                />
                {authError && (
                  <div className="text-red-400 text-xs font-semibold bg-red-500/10 border border-red-500/20 rounded-lg py-2 px-3 text-right">
                    {authError}
                  </div>
                )}
                <button
                  onClick={handleResetPassword}
                  disabled={isAuthLoading}
                  className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold py-3.5 px-6 rounded-xl transition-all cursor-pointer text-sm"
                >
                  {isAuthLoading ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>إرسال الرابط</span>
                  )}
                </button>
                <button
                  onClick={() => { setAuthView('signin'); setAuthError(''); }}
                  className="text-gray-400 hover:text-white text-[11px] font-semibold transition-colors cursor-pointer pt-1 text-center"
                >
                  ← رجوع لتسجيل الدخول
                </button>
              </>
            )}
          </div>

          <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-center gap-1.5 text-[10px] text-gray-500">
            <span>تطبق شروط الاستخدام والأمان © {new Date().getFullYear()} نوار سينما</span>
</div>
</div>

        {/* Toast notifications on the login screen */}
        {toastMessage && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[600] bg-neutral-900 border border-white/10 text-white text-xs font-semibold rounded-full py-3 px-6 shadow-2xl flex items-center gap-2.5 select-none animate-slide-up">
            <CheckCircle className="w-4 h-4 text-green-500 fill-current text-white shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        <style>{`
          @keyframes slideUp {
            from { opacity: 0; transform: translate(-50%, 15px); }
            to { opacity: 1; transform: translate(-50%, 0); }
          }
          .animate-slide-up { animation: slideUp 0.3s ease-out forwards; }
        `}</style>
</div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col font-sans relative pb-20 md:pb-0 tracking-normal antialiased">
      
      {/* High-Contrast Frosted Blur Top Header */}
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

      {/* Main Orchestration Views Switcher */}
      <main className="flex-grow pt-14 selection:bg-red-500/30">
        {activeView ==='home' && (
          <div className="animate-fade-in">
            {/* Display Hero slider */}
            <Hero
              trendingItems={trendingWeek}
              onPlayClick={(item) => handleTitleClick(item)}
              onInfoClick={(item) => handleTitleClick(item)}
            />

            {/* Custom Horizontal Cinema Rows */}
            <div className="space-y-4 md:space-y-6">
              {watchlist.length > 0 && (
                <div id="watchlist-section" className="scroll-mt-20">
                  <MovieRow
                    title="قائمتي"
                    subtitle="العناوين التي قمت بحفظها لمشاهدتها لاحقاً"
                    items={watchlist}
                    onItemClick={handleTitleClick}
                  />
</div>
              )}

              <MovieRow
                title="الرائج هذا الأسبوع"
                subtitle="أبرز العروض الأكثر تداولاً وتفضيلاً عالمياً"
                items={trendingWeek}
                onItemClick={handleTitleClick}
              />

              <MovieRow
                title="جديد دور السينما"
                subtitle="أحدث الإصدارات السينمائية المعروضة حالياً"
                items={nowPlaying}
                onItemClick={handleTitleClick}
              />

              <MovieRow
                title="المسلسلات الموصى بها"
                subtitle="عناوين ومواسم تليفزيونية مثيرة ومثالية للمشاهدة"
                items={popularTV}
                onItemClick={handleTitleClick}
              />

              <MovieRow
                title="أفلام شعبية مميزة"
                subtitle="ترشيحات كلاسيكية وحديثة ممتازة لسهرة الليلة"
                items={popularMovies}
                onItemClick={handleTitleClick}
              />
</div>
</div>
        )}

        {/* Dedicated Watchlist View */}
        {activeView ==='watchlist' && (() => {
          // Process current watchlist items with filter & sort states
          let processedItems = [...watchlist];
          if (watchlistFilter !=='all') {
            processedItems = processedItems.filter(item => item.type === watchlistFilter);
          }
          if (watchlistSort ==='rating') {
            processedItems.sort((a, b) => b.rating - a.rating);
          } else if (watchlistSort ==='year') {
            processedItems.sort((a, b) => {
              const yearA = parseInt(itemYear(a.year)) || 0;
              const yearB = parseInt(itemYear(b.year)) || 0;
              return yearB - yearA;
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
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-6 mb-8 select-none">
                <div className="space-y-2">
                  <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-none">
                    قائمتي الخاصة 
</h1>
                  <p className="text-neutral-400 text-sm font-medium">
                    العناوين والأعمال المميزة التي قمت بحفظها لتشاهدها بكل سهولة لاحقاً.
</p>
</div>
                
                {watchlist.length > 0 && (
                  <div className="flex flex-wrap gap-4 items-center justify-start md:justify-end">
                    {/* Filter Segmented Control */}
                    <div className="flex bg-neutral-900 border border-white/5 p-1 rounded-xl">
                      <button
                        onClick={() => setWatchlistFilter('all')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          watchlistFilter ==='all' ?'bg-red-600 text-white shadow-md' :'text-gray-400 hover:text-white'
                        }`}
                      >
                        الكل
</button>
                      <button
                        onClick={() => setWatchlistFilter('movie')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          watchlistFilter ==='movie' ?'bg-red-600 text-white shadow-md' :'text-gray-400 hover:text-white'
                        }`}
                      >
                        أفلام
</button>
                      <button
                        onClick={() => setWatchlistFilter('tv')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          watchlistFilter ==='tv' ?'bg-red-600 text-white shadow-md' :'text-gray-400 hover:text-white'
                        }`}
                      >
                        مسلسلات
</button>
</div>

                    {/* Sort Segmented Control */}
                    <div className="flex bg-neutral-900 border border-white/5 p-1 rounded-xl">
                      <button
                        onClick={() => setWatchlistSort('default')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          watchlistSort ==='default' ?'bg-red-600 text-white shadow-md' :'text-gray-400 hover:text-white'
                        }`}
                      >
                        الافتراضي
</button>
                      <button
                        onClick={() => setWatchlistSort('rating')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          watchlistSort ==='rating' ?'bg-red-600 text-white shadow-md' :'text-gray-400 hover:text-white'
                        }`}
                      >
                        الأعلى تقييماً
</button>
                      <button
                        onClick={() => setWatchlistSort('year')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          watchlistSort ==='year' ?'bg-red-600 text-white shadow-md' :'text-gray-400 hover:text-white'
                        }`}
                      >
                        أحدث العروض
</button>
</div>
</div>
                )}
</div>

              {watchlist.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center bg-neutral-950 border border-white/5 rounded-3xl mt-6 min-h-[300px]">
                  <span className="text-5xl mb-4"></span>
                  <h3 className="text-lg font-bold text-white mb-2">قائمتك فارغة حالياً!</h3>
                  <p className="text-xs text-gray-400 max-w-sm leading-relaxed">
                    تصفّح العروض والمسلسلات في الصفحة الرئيسية وأضفها بالضغط على زر الحفظ في تفاصيل الفيلم.
</p>
                  <button
                    onClick={navigateToHome}
                    className="mt-6 bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-6 py-3 rounded-full cursor-pointer transition-all hover:scale-105"
                  >
                    الذهاب للرئيسية وتصفّح العروض 
</button>
</div>
              ) : processedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center bg-neutral-950 border border-white/5 rounded-3xl mt-6 min-h-[250px]">
                  <span className="text-4xl mb-3"></span>
                  <h3 className="text-base font-bold text-white mb-1">لا توجد نتائج مطابقة!</h3>
                  <p className="text-xs text-gray-400 max-w-sm">
                    لم نجد أي أعمال تطابق الفلاتر المختارة في قائمتك الخاصة.
</p>
</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 mt-6">
                  {processedItems.map((item, idx) => {
                    const hasScore = item.rating > 0;
                    const progressKey =`noir_progress_${item.type}_${item.id}`;
                    const storedProgress = localStorage.getItem(progressKey);
                    const progress = storedProgress ? Number(storedProgress) : 0;

                    return (
                      <div
                        key={`${item.type}-${item.id}`}
                        onClick={() => handleTitleClick(item)}
                        style={{ animationDelay: `${idx * 40}ms` }}
                        className="card-transition cursor-pointer transition-all duration-350 hover:bg-neutral-900/60 hover:shadow-xl rounded-2xl p-2 pb-3.5 border border-white/5 bg-neutral-950 hover:scale-[1.03] active:scale-[0.98]"
                      >
                        {/* Poster Artwork container */}
                        <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-neutral-900 border border-white/5 shadow-md">
                          {item.poster || item.backdrop ? (
                            <img
                              src={item.poster || item.backdrop || undefined}
                              alt={item.title}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover select-none"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center p-3 text-neutral-600 bg-neutral-950">
                              <span className="text-[10px] sm:text-xs font-semibold text-center leading-normal break-all line-clamp-2">
                                {item.title}
</span>
</div>
                          )}

                          {/* Rating stamp directly overlaying backdrop */}
                          {hasScore && (
                            <div className="absolute bottom-2 right-2 bg-black/85 backdrop-blur-md text-[#f5c518] text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-white/5">
                              <Star className="w-2.5 h-2.5 fill-current" />
                              <span>{item.rating.toFixed(1)}</span>
</div>
                          )}

                          {/* Watch progression indicator red bar */}
                          {progress > 0 && (
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-800">
                              <div 
                                className="h-full bg-red-600 transition-all duration-300" 
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
                          <span className="text-neutral-500 font-semibold text-[10px] sm:text-xs mt-1 flex items-center gap-1 justify-start">
                            <span>{item.year ||'—'}</span>
                            <span className="w-1 h-1 bg-neutral-800 rounded-full" />
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
              <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-none mb-3">
                {searchMode ==='tv' ?'دليل المسلسلات' :'دليل الأفلام'}
</h1>
              <p className="text-neutral-400 text-sm font-medium">
                اعثر على عملك القادم من خلال تصفية كامل المكتبة السينمائية بسرعة فائقة ومقاييس مخصصة.
</p>
</div>

            {/* Direct Input Filter bar */}
            <div className="flex gap-3 mb-6 relative z-10 select-none">
              <div className="flex-1 flex items-center gap-3 bg-neutral-900 border border-white/5 focus-within:border-white/15 px-4 py-3 rounded-2xl transition-all">
                <Search className="w-5 h-5 text-gray-500 shrink-0" />
                <input
                  type="text"
                  value={fQuery}
                  onChange={(e) => setFQuery(e.target.value)}
                  placeholder="ابحث بالعنوان، الكلمات المفتاحية..."
                  className="flex-1 bg-transparent border-0 outline-none text-white text-sm md:text-base font-medium placeholder-gray-500 text-right"
                />
</div>

              {/* Mobile Filter Toggler Button */}
              <button
                onClick={() => setIsFilterSidebarOpen(!isFilterSidebarOpen)}
                className={`md:hidden flex items-center justify-center gap-2 px-4 rounded-2xl border text-xs font-semibold cursor-pointer transition-colors ${
                  isFilterSidebarOpen
                    ?'bg-neutral-800 text-white border-neutral-700'
                    :'bg-neutral-900 text-gray-400 border-white/5'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>التصفية</span>
</button>
</div>

            {/* Core Search View Layout Box (Grid map) */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-8">
              
              {/* Left Side: Dynamic Grid items */}
              <div className="order-2 md:order-1 min-w-0">
                
                {/* Search Sorting Metrics controller */}
                <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
                  <span className="text-xs text-neutral-400 font-medium">
                    {searchResults.length > 0 ?`تم العثور على ${searchResults.length} عنوان` :'لا توجد نتائج مناسبة'}
</span>
                  
                  <div className="flex items-center gap-1.5 min-w-[140px]">
                    <ArrowUpDown className="w-4 h-4 text-neutral-500" />
                    <select
                      value={fSort}
                      onChange={(e) => setFSort(e.target.value)}
                      className="bg-neutral-900 text-white border border-white/5 hover:border-white/10 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-red-500 cursor-pointer"
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
                        <div className="aspect-[2/3] w-full rounded-2xl bg-neutral-950 border border-white/5 flex flex-col justify-end p-2 animate-pulse">
                          <div className="w-full h-full bg-neutral-900 rounded-xl shimmer-bg" />
</div>
                        <div className="w-24 h-4 bg-neutral-900 rounded animate-pulse" />
                        <div className="w-16 h-3 bg-neutral-900 rounded animate-pulse" />
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
                          style={{ animationDelay: `${idx * 40}ms` }}
                          className="card-transition group cursor-pointer rounded-2xl p-2.5 pb-3.5 hover:bg-neutral-200/50 dark:hover:bg-neutral-900/60 hover:shadow-lg transition-all duration-300 select-none active:scale-[0.98]"
                        >
                          <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-neutral-900 border border-white/5 shadow-md">
                            {item.poster || item.backdrop ? (
                              <img
                                src={item.poster || item.backdrop || undefined}
                                alt={item.title}
                                loading="lazy"
                                className="w-full h-full object-cover select-none"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-neutral-950 text-neutral-600 text-center text-xs p-2 font-bold break-all line-clamp-2 leading-tight">
                                {item.title}
</div>
                            )}
                            {item.rating > 0 && (
                              <div className="absolute bottom-2 right-2 bg-black/85 backdrop-blur-md text-[#f5c518] text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-white/5">
                                <span>★</span>
                                <span>{item.rating.toFixed(1)}</span>
</div>
                            )}
</div>
                          
                          <div className="mt-2.5 px-0.5 flex flex-col text-right">
                            <span className="text-white font-bold text-xs sm:text-sm line-clamp-1 leading-tight transition-colors">
                              {item.title}
</span>
                            <span className="text-neutral-500 font-semibold text-[10px] sm:text-xs mt-1.5">
                              {item.year ||'—'}
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
                          className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-gray-300 hover:text-white border border-white/5 hover:border-white/10 px-8 py-3 rounded-full text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                        >
                          {isLoadingMore ? (
                            <>
                              <Loader className="w-4 h-4 text-red-500 animate-spin" />
                              <span>جاري المسح والتحميل...</span>
</>
                          ) : (
                            <span>عرض المزيد من العناوين</span>
                          )}
</button>
</div>
                    )}
</div>
                ) : (
                  <div className="py-24 text-center flex flex-col items-center justify-center gap-4 border border-white/5 bg-neutral-900/10 rounded-3xl">
                    <span className="text-4xl text-neutral-600">∅</span>
                    <h3 className="text-sm font-bold text-white">لم نجد أي عناوين مطابقة</h3>
                    <p className="text-xs text-gray-500 max-w-xs">
                      جرب تغيير عوامل التصفية المختارة، أو اختصر العناوين في مربع البحث للوصول لنتائج أفضل.
</p>
</div>
                )}
</div>

              {/* Right Side / Sidebar: Desktop Filter lists & Mobile panel */}
              <div
                className={`order-1 md:order-2 ${
                  isFilterSidebarOpen
                    ?'fixed inset-0 z-40 bg-black/95 pt-20 px-6 overflow-y-auto block'
                    :'hidden md:block'
                }`}
              >
                <div className="space-y-6 text-right select-none">
                  {/* Close button for mobile panel overlay */}
                  <div className="flex justify-between items-center mb-2 md:hidden">
                    <h3 className="text-lg font-extrabold text-white">خيارات التصفية</h3>
                    <button
                      onClick={() => setIsFilterSidebarOpen(false)}
                      className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      إغلاق
</button>
</div>

                  {/* Header widget */}
                  <div className="hidden md:flex justify-between items-baseline border-b border-white/5 pb-3">
                    <h3 className="text-sm font-bold text-gray-300 flex items-center gap-1.5">
                      <Filter className="w-4 h-4 text-gray-400" />
                      <span>عوامل التصفية</span>
</h3>
                    <button
                      onClick={handleResetFilters}
                      className="bg-transparent text-gray-400 hover:text-white transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1"
                      title="مسح جميع فلاتر التصفية"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-neutral-500" />
                      <span>مسح الكل</span>
</button>
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
                        className="w-full bg-neutral-900 text-white rounded-xl py-2.5 px-3 text-xs font-semibold border border-white/5 focus:outline-none focus:border-red-500 cursor-pointer"
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
                        className="w-full bg-neutral-900 text-white rounded-xl py-2.5 px-3 text-xs font-semibold border border-white/5 focus:outline-none focus:border-red-500 cursor-pointer"
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
                        className="w-full bg-neutral-900 text-white rounded-xl py-2.5 px-3 text-xs font-semibold border border-white/5 focus:outline-none focus:border-red-500 cursor-pointer"
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
                        className="w-full bg-neutral-900 text-white rounded-xl py-2.5 px-3 text-xs font-semibold border border-white/5 focus:outline-none focus:border-red-500 cursor-pointer"
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
                        className="w-full bg-neutral-900 text-white rounded-xl py-2.5 px-3 text-xs font-semibold border border-white/5 focus:outline-none focus:border-red-500 cursor-pointer"
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
                        className="w-full bg-neutral-900 text-white rounded-xl py-2.5 px-3 text-xs font-semibold border border-white/5 focus:outline-none focus:border-red-500 cursor-pointer"
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
          <div className="animate-fade-in block">
            <DetailView
              type={selectedTitle.type}
              id={selectedTitle.id}
              onBackClick={navigateToHome}
              onItemClick={handleTitleClick}
              onOpenShare={handleOpenShare}
              user={user}
              showToast={showToast}
              autoOpenWatchTogether={joinRoomCode}
              onClearAutoOpenWatchTogether={() => setJoinRoomCode('')}
            />
</div>
        )}
</main>

      {/* Global Minimalist Footer and disclaimer notes */}
      <Footer goHome={navigateToHome} setSearchMode={handleSetSearchMode} />

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
      <SearchOverlay
        isOpen={isSearchOverlayOpen}
        onClose={() => setIsSearchOverlayOpen(false)}
        onSelectTitle={handleQuickSelectTitle}
      />

      {/* Browser URL Share Dialog */}
      <ShareModal
        isOpen={isShareModalOpen}
        url={shareUrl}
        onClose={() => setIsShareModalOpen(false)}
        onToast={showToast}
      />

      {/* Google Account Profile Details Dialog Modal */}
      {isProfileModalOpen && user && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 text-right">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/85 backdrop-blur-md cursor-pointer animate-fade-in" 
            onClick={() => setIsProfileModalOpen(false)}
          />

          {/* Modal Container */}
          <div className="relative z-10 w-full max-w-sm bg-neutral-950 border border-white/5 rounded-3xl p-6 md:p-8 shadow-3xl text-center select-none animate-scale-in">
            {/* Close Trigger Button */}
            <button
              onClick={() => setIsProfileModalOpen(false)}
              className="absolute top-4 left-4 p-1.5 rounded-full text-gray-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
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
                <div className={`absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full border border-neutral-950 ${user.type ==='google' ?'bg-indigo-500' : user.type === 'email' ? 'bg-red-500' : 'bg-emerald-500'}`} />
</div>

              {/* User Bio Information */}
              <div className="space-y-1 text-center">
                <h3 className="text-lg font-extrabold text-white leading-snug">{user.name}</h3>
                {user.email && (
                  <p className="text-xs text-gray-400 font-medium font-mono select-text">{user.email}</p>
                )}
                {user.type ==='guest' ? (
                  <span className="inline-block bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full mt-1">
                    أنت مسجل حالياً كضيف
</span>
                ) : user.type === 'email' ? (
                  <span className="inline-block bg-red-500/10 border border-red-500/25 text-red-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full mt-1">
                    حساب نوار سينما
</span>
                ) : (
                  <span className="inline-block bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full mt-1">
                    حساب جوجل مفعل وموثق 
</span>
                )}
</div>
</div>

            {/* Restrict warning or list status */}
            <div className="mt-8 p-3.5 rounded-2xl bg-neutral-900/60 border border-white/5 text-right space-y-1">
              <p className="text-[10px] text-gray-500 font-bold leading-normal">إحصائيات القائمة والنشاط</p>
              <div className="text-xs text-gray-300 font-semibold leading-relaxed">
                {user.type ==='guest' ? (
                  <span className="text-amber-500 font-bold block">حساب الزائر محدود ميزات الحفظ والمشاهدة الجماعية. سجل دخولك بجوجل لتفعيلهم!</span>
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
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-all cursor-pointer text-xs"
                >
                  ربط تسجيل الدخول بجوجل 
</button>
              )}
              <button
                onClick={() => {
                  handleLogout();
                  setIsProfileModalOpen(false);
                }}
                className="w-full bg-neutral-900 border border-white/5 hover:border-white/10 text-red-400 hover:text-red-300 font-bold py-3 rounded-xl transition-all cursor-pointer text-xs flex items-center justify-center gap-2"
              >
                <span></span>
                <span>تسجيل الخروج من الحساب</span>
</button>
</div>
</div>
</div>
      )}

      {/* Floating Success Indicator Toast notifications */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[600] bg-neutral-900 border border-white/10 text-white text-xs font-semibold rounded-full py-3 px-6 shadow-2xl flex items-center gap-2.5 select-none animate-slide-up">
          <CheckCircle className="w-4 h-4 text-green-500 fill-current text-white shrink-0" />
          <span>{toastMessage}</span>
</div>
      )}

      {/* Direct inline classes style supporting some animation frames */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, 15px); }
          to { opacity: 1; transform: translate(-50%, 0); }
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
