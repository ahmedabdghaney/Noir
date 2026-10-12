/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import { lazy, Suspense, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, Star, Loader, Filter, Trash2, ArrowUpDown, ChevronDown, CheckCircle, Eye, EyeOff, X, ArrowLeft, Home } from 'lucide-react';
import LogoIcon from './components/LogoIcon';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import {
  auth,
  loginWithGoogle,
  logoutUser,
  signInWithEmail,
  signUpWithEmail,
  resetPassword,
  checkSignInMethods,
  translateAuthError,
  fetchFirestoreWatchlist,
  db,
  sendVerification,
  removeFromFirestoreWatchlist,
  addToFirestoreWatchlist,
  mergeLocalContinueWatchingIntoCloud,
  removeFromFirestoreContinueWatching,
  saveFirestoreContinueWatching,
  subscribeFirestoreContinueWatching,
  mergeLocalViewingHistoryIntoCloud,
  removeFromFirestoreViewingHistory,
  saveFirestorePlaybackSettings,
  saveFirestoreTitlePreference,
  saveFirestoreViewingHistory,
  subscribeFirestorePlaybackSettings,
  subscribeFirestoreTitlePreferences,
  subscribeFirestoreViewingHistory,
} from './lib/firebase';
import {
  ContinueWatchingItem,
  MovieOrShow,
  TitlePreference,
  ViewingHistoryItem,
} from './types';
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
  getPosterUrl,
  getBackdropUrl,
  resizeTmdbImage,
} from './lib/tmdb';

// Component Imports
import CategoryRow from './components/CategoryRow';
import Sidebar from './components/Sidebar';
import Hero from './components/Hero';
import MovieRow from './components/MovieRow';
import StudiosRow from './components/StudiosRow';
import OnboardingFlow from './components/OnboardingFlow';
import PullToRefresh from './components/PullToRefresh';
import { getCategoryByKey } from './lib/categories';
import { getStudioByKey } from './lib/studios';
import ContinueWatchingRow from './components/ContinueWatchingRow';
import SearchOverlay from './components/SearchOverlay';
import ShareModal from './components/ShareModal';
import MobileNav from './components/MobileNav';
import Footer from './components/Footer';
import WatchlistButton from './components/WatchlistButton';
import TvHome from './components/TvHome';
import TvNavigation from './components/TvNavigation';
import {
  subscribeHidden, subscribeManualItems, subscribeCustomSections, subscribeSectionOrder,
  subscribeHeroHidden, toggleHeroHidden, subscribeHeroExtra, subscribeHeroOrder, HeroExtra,
  toggleHidden,
  itemKey, ManualItem, CustomSection,
} from './lib/adminStore';

const DetailView = lazy(() => import('./components/DetailView'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const CategoryPage = lazy(() => import('./components/CategoryPage'));
const StudioPage = lazy(() => import('./components/StudioPage'));
const ViewingHistoryPage = lazy(() => import('./components/ViewingHistoryPage'));

function DeferredViewFallback() {
  return (
    <div className="flex min-h-[55vh] items-center justify-center text-white/55" aria-label="Opening page">
      <Loader className="h-8 w-8 animate-spin text-[#A0C9CB]" />
    </div>
  );
}

// Static Configuration Constants
const COUNTRIES = [
  ['US','United States'],
  ['GB','United Kingdom'],
  ['FR','France'],
  ['JP','Japan'],
  ['KR','South Korea'],
  ['IN','India'],
  ['EG','Egypt'],
  ['DE','Germany'],
  ['IT','Italy'],
  ['ES','Spain'],
];

const LANGS = [
  ['en','English'],
  ['ar','Arabic'],
  ['fr','French'],
  ['ja','Japanese'],
  ['ko','Korean'],
  ['es','Spanish'],
  ['hi','Hindi'],
  ['de','German'],
];

const RATINGS = [
  ['8','8+ stars'],
  ['7','7+ stars'],
  ['6','6+ stars'],
];

function resolveArtworkUrl(value: string | null | undefined, kind: 'poster' | 'backdrop') {
  if (!value) return null;
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const path = value.startsWith('/') ? value : `/${value}`;
  return kind === 'backdrop' ? getBackdropUrl(path) : getPosterUrl(path);
}

const RUNTIMES = [
  ['lt90','Under 90 minutes'],
  ['90_120','90–120 minutes'],
  ['gt120','Over 2 hours'],
];

const YEARS = (() => {
  const current = new Date().getFullYear();
  return Array.from({ length: 15 }, (_, i) => String(current - i));
})();

const GENRE_ALIASES: Record<string, string> = {
  action: 'Action',
  adventure: 'Adventure',
  animation: 'Animation',
  comedy: 'Comedy',
  crime: 'Crime',
  documentary: 'Documentary',
  drama: 'Drama',
  family: 'Family',
  fantasy: 'Fantasy',
  history: 'History',
  horror: 'Horror',
  music: 'Music',
  mystery: 'Mystery',
  romance: 'Romance',
  'science fiction': 'Science Fiction',
  thriller: 'Thriller',
  war: 'War',
  western: 'Western',
  'action & adventure': 'Action & Adventure',
  'sci-fi & fantasy': 'Sci-Fi & Fantasy',
  kids: 'Kids',
  reality: 'Reality',
};

function normalizeGenreName(name: string) {
  const normalized = name.trim().toLowerCase();
  return GENRE_ALIASES[normalized] || name.trim();
}

export default function App() {
  // Navigation & View State
  const [activeView, setActiveView] = useState<'home' | 'search' | 'detail' | 'watchlist' | 'history' | 'category' | 'studio' | 'admin'>('home');
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null);
  const [categoryAllMode, setCategoryAllMode] = useState(false);
  const [selectedStudioKey, setSelectedStudioKey] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<'movie' | 'tv'>('movie');
  const [selectedTitle, setSelectedTitle] = useState<{ type: 'movie' | 'tv'; id: number } | null>(null);
  // الموسم/الحلقة المقروءة من الـ URL (تُمرَّر لـ DetailView كقيمة ابتدائية)
  const [selectedEpisodeRoute, setSelectedEpisodeRoute] = useState<{ season: number; episode: number } | null>(null);
  const [joinRoomCode, setJoinRoomCode] = useState<string>('');
  const [autoPlayRequested, setAutoPlayRequested] = useState(false);
  const homeScrollRef = useRef(Number(localStorage.getItem('noir_home_scroll') || 0));
  const scrollSaveFrameRef = useRef<number | null>(null);
  const previousViewRef = useRef(activeView);
  const pendingSearchFocusIndexRef = useRef<number | null>(null);
  const profileHistoryButtonRef = useRef<HTMLButtonElement>(null);

  // User Profile Modal active state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSendingVerification, setIsSendingVerification] = useState(false);

  useEffect(() => {
    if (!isProfileModalOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsProfileModalOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    if (!document.documentElement.classList.contains('noir-tv-app')) {
      return () => window.removeEventListener('keydown', handleEscape);
    }
    const frame = window.requestAnimationFrame(() => {
      profileHistoryButtonRef.current?.focus({ preventScroll: true });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isProfileModalOpen]);

  // Watchlist custom filter & sorting options
  const [watchlistFilter, setWatchlistFilter] = useState<'all' | 'movie' | 'tv'>('all');

  // Authentication Management State
  const [user, setUser] = useState<{ name: string; email?: string; photoURL?: string; type: 'guest' | 'google' | 'email' } | null>(() => {
    const guestUser = { name: 'Guest', type: 'guest' as const };
    try {
      const stored = localStorage.getItem('noir_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed;
      }
      localStorage.setItem('noir_user', JSON.stringify(guestUser));
      return guestUser;
    } catch {
      return guestUser;
    }
  });
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authMethod, setAuthMethod] = useState<'guest' | 'google' | 'email' | null>(null);

  // Email auth form state
  const [authView, setAuthView] = useState<'menu' | 'signin' | 'signup' | 'reset'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(
    () => localStorage.getItem('noir_onboarding_pending') === '1',
  );

  // Bookmark / Watchlist feeds
  const [watchlist, setWatchlist] = useState<MovieOrShow[]>([]);
  const [showSyncHelper, setShowSyncHelper] = useState(false);
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([]);
  const [viewingHistory, setViewingHistory] = useState<ViewingHistoryItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('noir_viewing_history') || '[]');
    } catch {
      return [];
    }
  });
  const [titlePreferences, setTitlePreferences] = useState<Record<string, TitlePreference>>(() => {
    try {
      return JSON.parse(localStorage.getItem('noir_title_preferences') || '{}');
    } catch {
      return {};
    }
  });
  const [autoResumeRequested, setAutoResumeRequested] = useState(false);

  // Continue Watching is cached locally for instant rendering, then reconciled
  // with the signed-in user's Firestore collection.
  const loadContinueWatching = () => {
    try {
      const listStr = localStorage.getItem('noir_continue_watching_list');
      if (!listStr) {
        setContinueWatching([]);
        return;
      }
      const list: ContinueWatchingItem[] = JSON.parse(listStr);
      const validList = list.filter(
        (item) =>
          (item.type === 'movie' || item.type === 'tv') &&
          item.id &&
          item.title &&
          item.title.trim() &&
          item.title !== 'Untitled' &&
          Number(item.positionSeconds) > 0 &&
          Number(item.durationSeconds) > 0 &&
          Number(item.progress) < 95,
      );
      if (validList.length !== list.length) {
        localStorage.setItem('noir_continue_watching_list', JSON.stringify(validList));
      }
      setContinueWatching(validList.sort((a, b) => b.updatedAtMs - a.updatedAtMs));
    } catch (error) {
      console.error('Error loading continue watching list:', error);
      setContinueWatching([]);
    }
  };

  const readLocalContinueWatchingForMerge = (userId: string) => {
    try {
      const cacheOwner = localStorage.getItem('noir_continue_watching_owner');
      if (cacheOwner && cacheOwner !== userId) return [];
      const raw = localStorage.getItem('noir_continue_watching_list');
      const items: ContinueWatchingItem[] = raw ? JSON.parse(raw) : [];
      return items
        .filter(
          (item) =>
            item &&
            item.id &&
            (item.type === 'movie' || item.type === 'tv') &&
            item.title &&
            item.title !== 'Untitled' &&
            Number(item.positionSeconds) > 0 &&
            Number(item.durationSeconds) > 0 &&
            Number(item.progress) < 95,
        )
        .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
    } catch {
      return [];
    }
  };

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
    let unsubscribeContinueWatching: (() => void) | null = null;
    let unsubscribeViewingHistory: (() => void) | null = null;
    let unsubscribeTitlePreferences: (() => void) | null = null;
    let unsubscribePlaybackSettings: (() => void) | null = null;
    let authEffectActive = true;

    const startContinueWatchingSync = async (userId: string) => {
      try {
        await mergeLocalContinueWatchingIntoCloud(
          userId,
          readLocalContinueWatchingForMerge(userId),
        );
      } catch (error) {
        console.error('Failed to merge local continue watching history:', error);
      }

      if (!authEffectActive || auth.currentUser?.uid !== userId) return;
      unsubscribeContinueWatching?.();
      unsubscribeContinueWatching = subscribeFirestoreContinueWatching(
        userId,
        (cloudItems) => {
          const activeItems = cloudItems.filter((item) => item.progress < 95);

          activeItems.forEach((item) => {
            localStorage.setItem(
              `noir_progress_${item.type}_${item.id}`,
              String(item.progress),
            );
          });
          localStorage.setItem(
            'noir_continue_watching_list',
            JSON.stringify(activeItems),
          );
          localStorage.setItem('noir_continue_watching_owner', userId);
          setContinueWatching(activeItems);
          window.dispatchEvent(new Event('progress_updated'));
        },
        () => loadContinueWatching(),
      );
    };

    const startPersonalizationSync = async (userId: string) => {
      let localHistory: ViewingHistoryItem[] = [];
      let localPreferences: Record<string, TitlePreference> = {};
      try {
        const historyOwner = localStorage.getItem('noir_viewing_history_owner');
        const preferencesOwner = localStorage.getItem('noir_title_preferences_owner');
        localHistory = historyOwner && historyOwner !== userId
          ? []
          : JSON.parse(localStorage.getItem('noir_viewing_history') || '[]');
        localPreferences = preferencesOwner && preferencesOwner !== userId
          ? {}
          : JSON.parse(localStorage.getItem('noir_title_preferences') || '{}');
      } catch {
        localHistory = [];
        localPreferences = {};
      }

      try {
        await mergeLocalViewingHistoryIntoCloud(userId, localHistory);
        await Promise.all(
          Object.entries(localPreferences).map(([key, value]) => {
            const [type, rawId] = key.split('_');
            const id = Number(rawId);
            if ((type !== 'movie' && type !== 'tv') || !Number.isFinite(id)) {
              return Promise.resolve();
            }
            return saveFirestoreTitlePreference(userId, type, id, value);
          }),
        );
      } catch (error) {
        console.error('Failed to merge personalization data:', error);
      }

      if (!authEffectActive || auth.currentUser?.uid !== userId) return;
      unsubscribeViewingHistory?.();
      unsubscribeTitlePreferences?.();
      unsubscribePlaybackSettings?.();

      unsubscribeViewingHistory = subscribeFirestoreViewingHistory(
        userId,
        (items) => {
          const limited = items.slice(0, 100);
          localStorage.setItem('noir_viewing_history', JSON.stringify(limited));
          localStorage.setItem('noir_viewing_history_owner', userId);
          setViewingHistory(limited);
        },
        (error) => console.error('Viewing history sync failed:', error),
      );
      unsubscribeTitlePreferences = subscribeFirestoreTitlePreferences(
        userId,
        (preferences) => {
          localStorage.setItem('noir_title_preferences', JSON.stringify(preferences));
          localStorage.setItem('noir_title_preferences_owner', userId);
          setTitlePreferences(preferences);
        },
      );
      unsubscribePlaybackSettings = subscribeFirestorePlaybackSettings(
        userId,
        (settings) => {
          localStorage.setItem('noir_autoplay_next', String(settings.autoplayNext));
          localStorage.setItem('noir_sub_size', String(settings.subtitleSize));
          localStorage.setItem('noir_sub_offset', String(settings.subtitleOffset));
          window.dispatchEvent(
            new CustomEvent('noir_playback_settings_sync', { detail: settings }),
          );
        },
      );
    };

    // Background auto-login for iframe environments where IndexedDB/Storage persistence is restricted
    const attemptAutoLogin = async () => {
      const storedCreds = localStorage.getItem('noir_credentials');
      if (storedCreds) {
        try {
          const { email, password } = JSON.parse(storedCreds);
          if (email && password && !auth.currentUser) {
            await signInWithEmail(email, password);
          }
        } catch (err) {
          console.error("Background auto-login failed: ", err);
          localStorage.removeItem('noir_credentials');
          localStorage.removeItem('noir_user');
          const guestUser = { name: 'Guest', type: 'guest' as const };
          localStorage.setItem('noir_user', JSON.stringify(guestUser));
          setUser(guestUser);
          loadWatchlist();
        }
      }
    };
    attemptAutoLogin();

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      // Unsubscribe previous watchlist listener if exists
      if (unsubscribeWatchlist) {
        unsubscribeWatchlist();
        unsubscribeWatchlist = null;
      }
      if (unsubscribeContinueWatching) {
        unsubscribeContinueWatching();
        unsubscribeContinueWatching = null;
      }
      unsubscribeViewingHistory?.();
      unsubscribeViewingHistory = null;
      unsubscribeTitlePreferences?.();
      unsubscribeTitlePreferences = null;
      unsubscribePlaybackSettings?.();
      unsubscribePlaybackSettings = null;

      if (firebaseUser) {
        const isEmailOnly = firebaseUser.providerData?.[0]?.providerId === 'password';
        const userData = {
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Noir user',
          email: firebaseUser.email || undefined,
          photoURL: firebaseUser.photoURL || undefined,
          type: (isEmailOnly ? 'email' : 'google') as 'email' | 'google',
        };
        const continueWatchingOwner = localStorage.getItem('noir_continue_watching_owner');
        if (continueWatchingOwner && continueWatchingOwner !== firebaseUser.uid) {
          setContinueWatching([]);
        }
        const viewingHistoryOwner = localStorage.getItem('noir_viewing_history_owner');
        if (viewingHistoryOwner && viewingHistoryOwner !== firebaseUser.uid) {
          setViewingHistory([]);
        }
        const titlePreferencesOwner = localStorage.getItem('noir_title_preferences_owner');
        if (titlePreferencesOwner && titlePreferencesOwner !== firebaseUser.uid) {
          setTitlePreferences({});
        }
        localStorage.setItem('noir_user', JSON.stringify(userData));
        setUser(userData);
        setIsAuthLoading(false);
        setAuthMethod(null);
        void startContinueWatchingSync(firebaseUser.uid);
        void startPersonalizationSync(firebaseUser.uid);

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
        setIsAuthLoading(false);
        setAuthMethod(null);
        // Skip immediate logout if we are in the middle of a background credentials auto-login
        const storedCreds = localStorage.getItem('noir_credentials');
        if (storedCreds) {
          return;
        }

        const stored = localStorage.getItem('noir_user');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed.type === 'google' || parsed.type === 'email') {
              const guestUser = { name: 'Guest', type: 'guest' as const };
              localStorage.setItem('noir_user', JSON.stringify(guestUser));
              setUser(guestUser);
              loadWatchlist();
            }
          } catch {
            const guestUser = { name: 'Guest', type: 'guest' as const };
            localStorage.setItem('noir_user', JSON.stringify(guestUser));
            setUser(guestUser);
            loadWatchlist();
          }
        } else {
          loadWatchlist();
        }
      }
    });

    return () => {
      authEffectActive = false;
      unsubscribeAuth();
      if (unsubscribeWatchlist) {
        unsubscribeWatchlist();
      }
      if (unsubscribeContinueWatching) {
        unsubscribeContinueWatching();
      }
      unsubscribeViewingHistory?.();
      unsubscribeTitlePreferences?.();
      unsubscribePlaybackSettings?.();
    };
  }, []);

  // Home Lists Feeds State
  const [trendingWeek, setTrendingWeek] = useState<MovieOrShow[]>([]);
  const [nowPlaying, setNowPlaying] = useState<MovieOrShow[]>([]);
  const [popularTV, setPopularTV] = useState<MovieOrShow[]>([]);
  const [popularMovies, setPopularMovies] = useState<MovieOrShow[]>([]);
  const [upcoming, setUpcoming] = useState<MovieOrShow[]>([]);

  // بيانات الإدارة (مشتركة لكل الزوار) — إخفاء، عناصر يدوية، أقسام مخصصة
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [heroHiddenIds, setHeroHiddenIds] = useState<string[]>([]);
  const [heroExtra, setHeroExtra] = useState<HeroExtra[]>([]);
  const [heroOrder, setHeroOrder] = useState<string[]>([]);
  const [manualItems, setManualItems] = useState<ManualItem[]>([]);
  const [customSections, setCustomSections] = useState<CustomSection[]>([]);
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  // نتائج أقسام Genre التلقائية: key القسم -> عناصره من TMDB
  const [genreSectionData, setGenreSectionData] = useState<Record<string, MovieOrShow[]>>({});
  const [isHomeLoading, setIsHomeLoading] = useState(true);

  // Reusable home feed reload (used on mount + pull-to-refresh)
  const refreshHome = useCallback(async () => {
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
    }
  }, []);

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
        const firebaseUser = await loginWithGoogle();
        const userData = {
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Noir user',
          email: firebaseUser.email || undefined,
          photoURL: firebaseUser.photoURL || undefined,
          type: 'google' as const,
        };
        const continueWatchingOwner = localStorage.getItem('noir_continue_watching_owner');
        if (continueWatchingOwner && continueWatchingOwner !== firebaseUser.uid) {
          setContinueWatching([]);
        }
        localStorage.setItem('noir_user', JSON.stringify(userData));
        setUser(userData);
        showToast('Signed in with Google successfully');
      } catch (error: any) {
        console.error("Google login failed: ", error);
        const errMsg = translateAuthError(error);
        if (error?.code === 'auth/operation-not-allowed') {
          showToast('Failed: please enable Google sign-in in the Firebase console');
        } else {
          showToast(`Google sign-in failed: ${errMsg}`);
        }
      } finally {
        setIsAuthLoading(false);
        setAuthMethod(null);
      }
    } else {
      setTimeout(() => {
        const newUser = { name: 'Valued guest', type: 'guest' as const };
        const continueWatchingOwner = localStorage.getItem('noir_continue_watching_owner');
        if (continueWatchingOwner && continueWatchingOwner !== 'guest') {
          localStorage.removeItem('noir_continue_watching_list');
          setContinueWatching([]);
        }
        localStorage.setItem('noir_continue_watching_owner', 'guest');
        localStorage.setItem('noir_user', JSON.stringify(newUser));
        setUser(newUser);
        setIsAuthLoading(false);
        setAuthMethod(null);
        showToast('Welcome to Noir Cinema as a guest');
      }, 850);
    }
  };

  const handleEmailSignIn = async () => {
    if (!authEmail || !authPassword) {
      setAuthError('Enter your email and password');
      return;
    }
    setAuthError('');
    setIsAuthLoading(true);
    setAuthMethod('email');
    try {
      await signInWithEmail(authEmail, authPassword);
      // Save credentials for persistent session in sandboxed iframe environment
      localStorage.setItem('noir_credentials', JSON.stringify({ email: authEmail, password: authPassword }));
      showToast('Welcome back');
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
    if (!authEmail || !authPassword || !authName) {
      setAuthError('Please fill in all fields');
      return;
    }
    if (authPassword.length < 6) {
      setAuthError('Password must be at least 6 characters');
      return;
    }
    if (!/[A-Z]/.test(authPassword)) {
      setAuthError('Password must contain an uppercase letter (A-Z)');
      return;
    }
    if (!/[a-z]/.test(authPassword)) {
      setAuthError('Password must contain a lowercase letter (a-z)');
      return;
    }
    setAuthError('');
    setIsAuthLoading(true);
    setAuthMethod('email');
    try {
      localStorage.setItem('noir_onboarding_pending', '1');
      await signUpWithEmail(authEmail, authPassword, authName);
      // Save credentials for persistent session in sandboxed iframe environment
      localStorage.setItem('noir_credentials', JSON.stringify({ email: authEmail, password: authPassword }));
      setShowOnboarding(true);
      showToast('Your account has been created, welcome');
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

  const handleResetPassword = async () => {
    if (!authEmail) {
      setAuthError('Enter your email address');
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
          setAuthError('This email is registered via Google, please sign in with the Google button');
          return;
        }
      } catch {
        // Ignore — fall through to sending reset
      }
      await resetPassword(authEmail);
      showToast('If this email is registered, a reset link will be sent (check your spam)');
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
    const guestUser = { name: 'Guest', type: 'guest' as const };
    localStorage.setItem('noir_user', JSON.stringify(guestUser));
    localStorage.removeItem('noir_credentials');
    setUser(guestUser);
    showToast('Signed out successfully');
  };

  const handleSendVerificationEmail = async () => {
    setIsSendingVerification(true);
    try {
      await sendVerification();
      showToast('A verification link has been sent to your email (check junk/spam)');
    } catch (e: any) {
      console.error(e);
      showToast('Failed to send the verification link, please try again later');
    } finally {
      setIsSendingVerification(false);
    }
  };

  const rememberHomeScroll = () => {
    if (activeView !== 'home') return;
    const position = Math.max(0, window.scrollY);
    homeScrollRef.current = position;
    localStorage.setItem('noir_home_scroll', String(position));
  };

  const handleViewWatchlist = () => {
    rememberHomeScroll();
    setIsSearchOverlayOpen(false);
    setActiveView('watchlist');
    setSelectedTitle(null);
    window.location.hash ='#watchlist';
  };

  const handleViewHistory = () => {
    rememberHomeScroll();
    setIsSearchOverlayOpen(false);
    setIsProfileModalOpen(false);
    setActiveView('history');
    setSelectedTitle(null);
    window.location.hash = '#history';
  };

  // loadWatchlist definition was moved to the state section above for better initialization.

  // Setup Dynamic URL Hash routing system
  useEffect(() => {
    const handleHashRouting = () => {
      const hash = window.location.hash || (() => {
        const episodeMatch = window.location.pathname.match(/^\/tv\/(\d+)\/s(\d+)\/e(\d+)\/?$/);
        if (episodeMatch) return `#tv/${episodeMatch[1]}/s${episodeMatch[2]}/e${episodeMatch[3]}`;
        const titleMatch = window.location.pathname.match(/^\/(movie|tv)\/(\d+)\/?$/);
        return titleMatch ? `#${titleMatch[1]}/${titleMatch[2]}` : '';
      })();
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
      } else if (hash === '#history') {
        setActiveView('history');
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
          setAutoPlayRequested(new URLSearchParams(window.location.search).get('play') === '1');
          setActiveView('detail');
        } else if (tvMatch) {
          setSelectedTitle({ type: 'tv', id: Number(tvMatch[1]) });
          setAutoPlayRequested(new URLSearchParams(window.location.search).get('play') === '1');
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
    setIsHomeLoading(true);
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

    // Load initial continue watching feed and register sync listener
    loadContinueWatching();
    const handleProgressUpdate = (event: Event) => {
      loadContinueWatching();
      const detail = (event as CustomEvent<{
        item?: ContinueWatchingItem;
        type?: 'movie' | 'tv';
        id?: number;
        remove?: boolean;
      }>).detail;
      const firebaseUser = auth.currentUser;
      if (!firebaseUser || !detail) return;

      if (detail.item) {
        void saveFirestoreContinueWatching(
          firebaseUser.uid,
          detail.item,
        ).catch((error) =>
          console.error('Failed to save continue watching item:', error),
        );
      } else if (detail.remove && detail.type && detail.id != null) {
        void removeFromFirestoreContinueWatching(
          firebaseUser.uid,
          detail.type,
          detail.id,
        ).catch((error) =>
          console.error('Failed to remove completed playback progress:', error),
        );
      }
    };
    window.addEventListener('progress_updated', handleProgressUpdate);
    const handleViewingHistoryUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{
        item?: ViewingHistoryItem;
        type?: 'movie' | 'tv';
        id?: number;
        remove?: boolean;
      }>).detail;
      if (!detail) return;
      if (detail.item) {
        if (auth.currentUser) {
          localStorage.setItem('noir_viewing_history_owner', auth.currentUser.uid);
        }
        setViewingHistory((current) => [
          detail.item!,
          ...current.filter(
            (item) => !(item.type === detail.item!.type && item.id === detail.item!.id),
          ),
        ].slice(0, 100));
      } else if (detail.remove && detail.type && detail.id != null) {
        setViewingHistory((current) =>
          current.filter((item) => !(item.type === detail.type && item.id === detail.id)),
        );
      }
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) return;
      if (detail.item) {
        void saveFirestoreViewingHistory(firebaseUser.uid, detail.item).catch((error) =>
          console.error('Failed to save viewing history:', error),
        );
      } else if (detail.remove && detail.type && detail.id != null) {
        void removeFromFirestoreViewingHistory(
          firebaseUser.uid,
          detail.type,
          detail.id,
        ).catch((error) => console.error('Failed to remove viewing history:', error));
      }
    };
    const handlePlaybackSettingsUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{
        autoplayNext: boolean;
        subtitleSize: number;
        subtitleOffset: number;
      }>).detail;
      const firebaseUser = auth.currentUser;
      if (!firebaseUser || !detail) return;
      void saveFirestorePlaybackSettings(firebaseUser.uid, detail).catch((error) =>
        console.error('Failed to save playback settings:', error),
      );
    };
    window.addEventListener('viewing_history_updated', handleViewingHistoryUpdate);
    window.addEventListener('noir_playback_settings_updated', handlePlaybackSettingsUpdate);

    return () => {
      window.removeEventListener('hashchange', handleHashRouting);
      window.removeEventListener('watchlist_updated', loadWatchlist);
      window.removeEventListener('progress_updated', handleProgressUpdate);
      window.removeEventListener('viewing_history_updated', handleViewingHistoryUpdate);
      window.removeEventListener('noir_playback_settings_updated', handlePlaybackSettingsUpdate);
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

  // جلب محتوى أقسام Genre التلقائية من TMDB (تتحدّث لما تتغير الأقسام)
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

  // Keep the home browsing position, like a streaming app, while other views start at the top.
  useEffect(() => {
    const saveHomePosition = () => {
      if (document.documentElement.classList.contains('noir-tv-app')) return;
      if (activeView !== 'home' || scrollSaveFrameRef.current != null) return;
      scrollSaveFrameRef.current = window.requestAnimationFrame(() => {
        scrollSaveFrameRef.current = null;
        const position = Math.max(0, window.scrollY);
        homeScrollRef.current = position;
        localStorage.setItem('noir_home_scroll', String(position));
      });
    };
    window.addEventListener('scroll', saveHomePosition, { passive: true });
    return () => {
      window.removeEventListener('scroll', saveHomePosition);
      if (scrollSaveFrameRef.current != null) {
        window.cancelAnimationFrame(scrollSaveFrameRef.current);
        scrollSaveFrameRef.current = null;
      }
    };
  }, [activeView]);

  useEffect(() => {
    const previousView = previousViewRef.current;
    previousViewRef.current = activeView;
    const t = setTimeout(() => {
      if (
        document.documentElement.classList.contains('noir-tv-app') &&
        document.documentElement.dataset.tvFocusRestorePending === 'true'
      ) {
        return;
      }
      if (activeView === 'home') {
        const top = homeScrollRef.current;
        window.scrollTo({ top, behavior: 'auto' });
      } else if (previousView !== activeView || selectedTitle) {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    }, activeView === 'home' ? 120 : 0);
    return () => clearTimeout(t);
  }, [activeView, selectedTitle, isHomeLoading]);

  // Master Query search resolver (handles discover vs search parameters)
  const triggerSearchQuery = async (append = false) => {
    const nextPage = append ? searchPage + 1 : 1;
    if (append) {
      if (isLoadingMore || nextPage > searchTotalPages) return;
      pendingSearchFocusIndexRef.current = searchResults.length;
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

  useEffect(() => {
    const index = pendingSearchFocusIndexRef.current;
    if (
      index == null ||
      !document.documentElement.classList.contains('noir-tv-app') ||
      searchResults.length <= index
    ) return;

    pendingSearchFocusIndexRef.current = null;
    const frame = window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-search-result-index="${index}"]`)
        ?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [searchResults.length]);

  // Global redirection tool
  const navigateToHome = () => {
    setIsSearchOverlayOpen(false);
    setAutoPlayRequested(false);
    if (activeView === 'home') {
      homeScrollRef.current = 0;
      localStorage.setItem('noir_home_scroll', '0');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
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
    const applyNavigation = () => {
      rememberHomeScroll();
      setIsSearchOverlayOpen(false);
      setSearchMode(mode);
      setActiveView('search');
      setSelectedTitle(null);
      window.location.hash = mode ==='tv' ?'#tv' :'#movies';
    };
    const transitionDocument = document as Document & {
      startViewTransition?: (callback: () => void | Promise<void>) => unknown;
    };
    applyNavigation();
  };

  const handleTitleClick = (item: MovieOrShow) => {
    rememberHomeScroll();
    setAutoResumeRequested(false);
    setAutoPlayRequested(false);
    window.location.hash =`#${item.type}/${item.id}`;
  };

  const handleTitlePreference = (
    item: MovieOrShow,
    preference: TitlePreference,
  ) => {
    const key = `${item.type}_${item.id}`;
    const nextPreference = titlePreferences[key] === preference ? null : preference;
    const next = { ...titlePreferences };
    if (nextPreference) next[key] = nextPreference;
    else delete next[key];

    setTitlePreferences(next);
    localStorage.setItem('noir_title_preferences', JSON.stringify(next));
    if (auth.currentUser) {
      localStorage.setItem('noir_title_preferences_owner', auth.currentUser.uid);
      void saveFirestoreTitlePreference(
        auth.currentUser.uid,
        item.type,
        item.id,
        nextPreference,
      ).catch((error) => console.error('Failed to save title preference:', error));
    }
  };

  const handlePlayTitle = (item: MovieOrShow) => {
    rememberHomeScroll();
    const playUrl = new URL(window.location.href);
    playUrl.searchParams.set('play', '1');
    playUrl.hash = `#${item.type}/${item.id}`;
    window.open(playUrl.toString(), '_blank');
  };

  const handleContinueWatchingClick = (item: ContinueWatchingItem) => {
    rememberHomeScroll();
    setAutoPlayRequested(false);
    setAutoResumeRequested(true);
    if (item.type === 'tv' && item.season > 0 && item.episode > 0) {
      window.location.hash = `#tv/${item.id}/s${item.season}/e${item.episode}`;
      return;
    }
    window.location.hash = `#${item.type}/${item.id}`;
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
        } as any).catch((e) => console.error('Failed to add to cloud watchlist:', e));
      }
    }
  };

  const removeContinueWatchingItem = (item: MovieOrShow) => {
    const next = continueWatching.filter(
      (current) => !(current.id === item.id && current.type === item.type),
    );
    setContinueWatching(next);
    localStorage.setItem('noir_continue_watching_list', JSON.stringify(next));
    localStorage.removeItem(`noir_progress_${item.type}_${item.id}`);

    const firebaseUser = auth.currentUser;
    if (firebaseUser) {
      void removeFromFirestoreContinueWatching(
        firebaseUser.uid,
        item.type,
        item.id,
      ).catch((error) =>
        console.error('Failed to remove continue watching item from cloud:', error),
      );
    }
  };

  const removeViewingHistoryItem = (item: ViewingHistoryItem) => {
    const next = viewingHistory.filter(
      (current) => !(current.id === item.id && current.type === item.type),
    );
    setViewingHistory(next);
    localStorage.setItem('noir_viewing_history', JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('viewing_history_updated', {
      detail: { type: item.type, id: item.id, remove: true },
    }));
  };

  const restartContinueWatchingItem = (item: ContinueWatchingItem) => {
    removeContinueWatchingItem(item);
    handlePlayTitle(item);
  };

  const handleQuickSelectTitle = (type: 'movie' | 'tv', id: number) => {
    rememberHomeScroll();
    setAutoPlayRequested(false);
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
    showToast('All filters cleared');
  };

  const authScreen = !user ? (() => {
    const isTvAuth = document.documentElement.classList.contains('noir-tv-app');
    const col1Posters = [
      'https://images.unsplash.com/photo-1542204172-e7052809a862?q=80&w=350&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=350&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=350&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=350&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=350&auto=format&fit=crop'
    ];

    const col2Posters = [
      'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=350&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1574375927938-d5a98e8edd86?q=80&w=350&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=350&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?q=80&w=350&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1524985069026-dd2f4049773a?q=80&w=350&auto=format&fit=crop'
    ];

    const col1PostersReverse = [...col1Posters].reverse();

    return (
      <div className={`noir-tv-auth-screen noir-auth-shell relative min-h-screen text-white flex items-center justify-center font-sans overflow-hidden select-none ${
        isTvAuth ? 'bg-[#08080a] p-10' : 'bg-[#070707] p-3.5 sm:p-6 md:p-10'
      }`}>

        {!isTvAuth && (
          <button type="button" className="noir-auth-back" onClick={() => handleLogin('guest')} aria-label="Back to site">
            <ArrowLeft />
          </button>
        )}

        {/* Main Double-Pane Card Layout */}
        <div className={`noir-auth-frame relative z-10 w-full border border-white/[0.08] shadow-2xl overflow-hidden grid grid-cols-1 animate-pop-in ${
          isTvAuth
            ? 'max-w-xl min-h-0 rounded-[32px] bg-[#101012]'
            : 'max-w-5xl min-h-[620px] rounded-[18px] bg-[#0c0c0c] lg:grid-cols-12'
        }`} dir="ltr">

          {/* LEFT COLUMN: Tilted & Scrolling Movie Covers Pattern */}
          <div className={`noir-auth-poster ${isTvAuth ? 'hidden' : 'hidden lg:flex'} lg:col-span-5 relative flex-col justify-between p-12 overflow-hidden bg-[#080808] border-r border-white/[0.07]`}>
            {/* Tilted Poster Grid container rotated 30 degrees */}
            <div className="noir-auth-poster-grid absolute inset-0 z-0 pointer-events-none select-none opacity-25">
              <div className="noir-auth-poster-columns absolute -inset-10 flex gap-4 rotate-[30deg] scale-125 justify-center">
                {/* Column 1: Moves upward */}
                <div className="flex flex-col gap-4 animate-marquee-up shrink-0">
                  {[...col1Posters, ...col1Posters].map((url, index) => (
                    <div key={`col1-${index}`} className="w-28 h-40 bg-stone-950 rounded-2xl overflow-hidden border border-white/10 shadow-lg shrink-0">
                      <img src={url} alt="Cover" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  ))}
                </div>

                {/* Column 2: Moves downward */}
                <div className="flex flex-col gap-4 animate-marquee-down shrink-0">
                  {[...col2Posters, ...col2Posters].map((url, index) => (
                    <div key={`col2-${index}`} className="w-28 h-40 bg-stone-950 rounded-2xl overflow-hidden border border-white/10 shadow-lg shrink-0">
                      <img src={url} alt="Cover" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  ))}
                </div>

                {/* Column 3: Moves upward */}
                <div className="flex flex-col gap-4 animate-marquee-up shrink-0">
                  {[...col1PostersReverse, ...col1PostersReverse].map((url, index) => (
                    <div key={`col3-${index}`} className="w-28 h-40 bg-stone-950 rounded-2xl overflow-hidden border border-white/10 shadow-lg shrink-0">
                      <img src={url} alt="Cover" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Dark gradient overlay over posters for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent z-1" />

            {/* Content Top */}
            <div className="relative z-10" dir="ltr">
              <div className="flex items-center gap-2.5 mb-8 justify-end">
                <span className="text-lg font-black tracking-tight text-white m-0">Noir <span className="text-[#A0C9CB]">Cinema</span></span>
                <div className="w-10 h-10 rounded-xl bg-[#A0C9CB] flex items-center justify-center shadow-lg shadow-[#A0C9CB]/30">
                  <LogoIcon className="w-5 h-5 text-white shrink-0" />
                </div>
              </div>

              <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2 block">Simple and delightful</span>
              <h2 className="text-2xl font-extrabold text-white leading-snug">Your gateway to watch movies and shows together with your friends in one tap</h2>
            </div>

            {/* Empty space at bottom layout to replace deleted tech stack footer */}
            <div className="relative z-10" />
          </div>

          {/* RIGHT COLUMN: Stylish Login / Signup Input Form */}
          <div className={`noir-auth-form col-span-1 flex flex-col justify-center select-none relative z-10 ${
            isTvAuth ? 'p-12 bg-[#101012]' : 'lg:col-span-7 p-7 sm:p-12 md:p-16 bg-[#0c0c0c]'
          }`} dir="ltr">
            {isTvAuth && (
              <div className="mb-8 flex items-center justify-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#A0C9CB]">
                  <LogoIcon className="h-6 w-6 text-white" />
                </div>
                <span className="text-xl font-black text-white">Noir Cinema</span>
              </div>
            )}

            {/* Form Header */}
            <div className={`noir-auth-form-header ${isTvAuth ? 'mb-7 text-center' : 'text-center mb-8'}`}>
              <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                {authView === 'signin' && (isTvAuth ? 'Sign in with Google' : 'Welcome back to Noir')}
                {authView === 'signup' && 'Create your Noir account'}
                {authView === 'reset' && 'Reset password'}
              </h1>
              <p className="text-gray-400 text-sm mt-2 leading-relaxed font-medium">
                {authView === 'signin' && (
                  isTvAuth
                    ? 'Use your Google account to continue and sync your list and watch history.'
                    : 'Enter your email and password to keep watching.'
                )}
                {authView === 'signup' && 'Fill in the details below to create your new account.'}
                {authView === 'reset' && 'Enter your email and we will send a reset link.'}
              </p>
            </div>

            {/* Actual Input form fields */}
            <div className="noir-auth-fields flex flex-col gap-4 w-full">

              {/* Name Field (Sign up only) */}
              {authView === 'signup' && (
                <div className="flex flex-col gap-1.5 text-left w-full">
                  <label className="sr-only">Username</label>
                  <input
                    type="text"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="Username"
                    className="w-full bg-[#151515] border border-white/[0.09] hover:border-white/20 focus:border-[#A0C9CB]/70 outline-none text-white text-sm font-medium py-3.5 px-4 rounded-xl transition-all text-left placeholder-gray-500 focus:ring-1 focus:ring-[#A0C9CB]/20"
                    dir="ltr"
                  />
                </div>
              )}

              {/* Email address field */}
              {!isTvAuth && <div className="flex flex-col gap-1.5 text-left w-full">
                <label className="sr-only">Email address</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full bg-[#151515] border border-white/[0.09] hover:border-white/20 focus:border-[#A0C9CB]/70 outline-none text-white text-sm font-medium py-3.5 px-4 rounded-xl transition-all text-left placeholder-gray-500 focus:ring-1 focus:ring-[#A0C9CB]/20"
                  dir="ltr"
                />
              </div>}

              {/* Password field with built-in "Forgot password" Link inside the label row */}
              {!isTvAuth && authView !== 'reset' && (
                <div className="flex flex-col gap-1.5 w-full">
                  <div className="flex items-center justify-between mr-1 ml-1 text-xs">
                    <label className="sr-only">Password</label>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full bg-[#151515] border border-white/[0.09] hover:border-white/20 focus:border-[#A0C9CB]/70 outline-none text-white text-sm font-medium py-3.5 pr-4 pl-11 rounded-xl transition-all text-left placeholder-gray-500"
                      dir="ltr"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (authView === 'signin') handleEmailSignIn();
                          else if (authView === 'signup') handleEmailSignUp();
                        }
                      }}
                    />
                    {!isTvAuth && (
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer p-1"
                        title={showPassword ? 'Hide' : 'Show'}
                      >
                        {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Form Validation Errors alerts */}
              {authError && (
                <div className="text-[#A0C9CB] text-xs font-semibold bg-[#A0C9CB]/10 border border-[#A0C9CB]/20 rounded-xl py-3 px-4 text-left leading-relaxed animate-fade-in">
                  {authError}
                </div>
              )}

              {/* Submit Action Button */}
              {!isTvAuth && <button
                onClick={() => {
                  if (authView === 'signin') handleEmailSignIn();
                  else if (authView === 'signup') handleEmailSignUp();
                  else if (authView === 'reset') handleResetPassword();
                }}
                disabled={isAuthLoading}
                  className="w-full flex items-center justify-center gap-2 bg-[#A0C9CB] hover:bg-[#A0C9CB] disabled:opacity-50 text-white font-bold py-3.5 px-6 rounded-xl transition-all cursor-pointer text-sm mt-2 shadow-[0_12px_30px_-16px_rgba(160,201,203,.9)]"
              >
                {isAuthLoading && authMethod === 'email' ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>
                    {authView === 'signin' && 'Sign in'}
                    {authView === 'signup' && 'Create account'}
                    {authView === 'reset' && 'Send reset link'}
                  </span>
                )}
              </button>}

              {/* Switch View Trigger Text link */}
              {!isTvAuth && <div className="text-center text-xs my-2.5">
                {authView === 'signin' && (
                  <>
                    <span className="text-gray-500 font-medium">Don't have an account? </span>
                    <button
                      onClick={() => { setAuthView('signup'); setAuthError(''); setAuthPassword(''); }}
                      className="text-[#A0C9CB] hover:text-[#A0C9CB] font-bold transition-colors cursor-pointer"
                    >
                      Create a new account
                    </button>
                  </>
                )}
                {authView === 'signup' && (
                  <>
                    <span className="text-gray-500 font-medium">Already have an account? </span>
                    <button
                      onClick={() => { setAuthView('signin'); setAuthError(''); setAuthPassword(''); }}
                      className="text-[#A0C9CB] hover:text-[#A0C9CB] font-bold transition-colors cursor-pointer"
                    >
                      Sign in
                    </button>
                  </>
                )}
                {authView === 'reset' && (
                  <button
                    onClick={() => { setAuthView('signin'); setAuthError(''); }}
                    className="text-gray-400 hover:text-white font-semibold transition-colors cursor-pointer text-[11px]"
                  >
                    ← Back to Sign in
                  </button>
                )}
              </div>}

              {/* Apple TV keeps the system account action; web follows the compact reference form. */}
              {isTvAuth && authView !== 'reset' && (
                <button
                  onClick={() => handleLogin('google')}
                  disabled={isAuthLoading}
                  autoFocus={isTvAuth}
                  className={`w-full flex items-center justify-center bg-white/[0.07] hover:bg-white/[0.12] border border-white/10 disabled:opacity-50 text-white font-bold cursor-pointer transition-all ${
                    isTvAuth
                      ? 'gap-3 rounded-full px-7 py-5 text-lg'
                      : 'gap-2.5 rounded-2xl px-4 py-3.5 text-sm'
                  }`}
                >
                  {isAuthLoading && authMethod === 'google' ? (
                    <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
                  ) : (
                    <svg className={`${isTvAuth ? 'h-6 w-6' : 'h-[14px] w-[14px]'} shrink-0`} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  <span>{isTvAuth ? 'Continue with Google' : 'Sign in with Google'}</span>
                </button>
              )}

            </div>

            {/* Bottom mini disclaimer footer */}
            {!isTvAuth && (
              <div className="noir-auth-legal mt-10 pt-4 border-t border-white/5 flex items-center justify-center gap-1.5 text-[11px] text-gray-500">
                <span>Full terms of use and security apply © {new Date().getFullYear()} Noir Cinema</span>
              </div>
            )}
          </div>

        </div>

        {/* Toast notifications on the login screen */}
        {toastMessage && (
          <div className="fixed bottom-6 left-0 right-0 z-[600] flex justify-center pointer-events-none px-4">
            <div className="pointer-events-auto glass-strong text-white text-xs font-semibold rounded-2xl py-3 px-5 shadow-2xl flex items-center gap-2.5 select-none animate-slide-up [direction:ltr]">
              <LogoIcon className="w-4 h-4 text-[#A0C9CB] shrink-0" />
              <span>{toastMessage}</span>
            </div>
          </div>
        )}

        <style>{`
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(15px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes marqueeUp {
            0% { transform: translateY(0); }
            100% { transform: translateY(-50%); }
          }
          @keyframes marqueeDown {
            0% { transform: translateY(-50%); }
            100% { transform: translateY(0); }
          }
          .animate-slide-up { animation: slideUp 0.3s ease-out forwards; }
          .animate-marquee-up { animation: marqueeUp 24s linear infinite; }
          .animate-marquee-down { animation: marqueeDown 24s linear infinite; }
        `}</style>
      </div>
    );
  })() : null;

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
      poster: resizeTmdbImage(m.poster, 'w342'),
      backdrop: resizeTmdbImage(m.backdrop, 'w780'),
      rating: m.rating,
      year: m.year,
      date: m.year ? `${m.year}-01-01` : '',
      genres: m.genres,
    };
  }, []);

  const selectedManualItem = useMemo(() => {
    if (!selectedTitle) return null;
    return manualItems.find((item) => {
      if (item.type !== selectedTitle.type) return false;
      if (item.tmdbId) return item.tmdbId === selectedTitle.id;
      return manualToMovie(item).id === selectedTitle.id;
    }) || null;
  }, [manualItems, manualToMovie, selectedTitle]);

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
    { key: 'trending', title: 'Trending This Week', items: trendingWeek },
    { key: 'upcoming', title: 'Coming Soon', items: upcoming },
    { key: 'nowPlaying', title: 'New in Theaters', items: nowPlaying },
    { key: 'popularTV', title: 'Recommended Shows', items: popularTV },
    { key: 'popularMovies', title: 'Popular Movies', items: popularMovies },
  ], [trendingWeek, upcoming, nowPlaying, popularTV, popularMovies]);

  // بناء كل أقسام Home بشكل موحّد، ثم ترتيبها حسب sectionOrder من الداشبورد.
  // كل قسم: { key, title, items }. الأقسام الفاضية تُحذف عند العرض.
  const renderableSections = useMemo(() => {
    // الأصلية
    const native: { key: string; title: string; items: MovieOrShow[] }[] = [
      { key: 'trending', title: 'Trending This Week', items: applyHidden(trendingWeek) },
      { key: 'upcoming', title: 'Coming Soon', items: applyHidden(upcoming) },
      { key: 'nowPlaying', title: 'New in Theaters', items: applyHidden(nowPlaying) },
      { key: 'popularTV', title: 'Recommended Shows', items: applyHidden(popularTV) },
      { key: 'popularMovies', title: 'Popular Movies', items: applyHidden(popularMovies) },
    ];

    // المخصصة: يدوية + تصنيف. للتصنيف ندمج العناصر اليدوية فوق نتائج TMDB.
    const custom = customSections.map((sec) => {
      const manual = manualBySection[sec.key] || [];
      let items: MovieOrShow[] = manual;
      if (sec.kind === 'genre') {
        const genreItems = applyHidden(genreSectionData[sec.key] || []);
        // العناصر اليدوية أولاً، بعدها Genre (بدون تكرار)
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

  const preferenceGenreScores = useMemo(() => {
    const scores = new Map<string, number>();
    const addGenres = (item: MovieOrShow, weight: number) => {
      item.genres.forEach((genre) => {
        const normalized = normalizeGenreName(genre);
        scores.set(normalized, (scores.get(normalized) || 0) + weight);
      });
    };

    viewingHistory.slice(0, 20).forEach((item, index) => {
      addGenres(item, Math.max(1, 5 - Math.floor(index / 5)));
    });
    continueWatching.slice(0, 10).forEach((item) => addGenres(item, 3));
    watchlist.slice(0, 15).forEach((item) => addGenres(item, 2));

    const candidateItems = [
      ...viewingHistory,
      ...continueWatching,
      ...watchlist,
      ...renderableSections.flatMap((section) => section.items),
    ];
    const uniqueCandidates = new Map(
      candidateItems.map((item) => [`${item.type}_${item.id}`, item] as const),
    );
    uniqueCandidates.forEach((item, key) => {
      const preference = titlePreferences[key];
      if (preference === 'like') addGenres(item, 8);
      if (preference === 'dislike') addGenres(item, -8);
    });
    return scores;
  }, [continueWatching, renderableSections, titlePreferences, viewingHistory, watchlist]);

  const topTenItems = useMemo(() => {
    const seen = new Set<string>();
    return [...trendingWeek, ...popularMovies, ...popularTV]
      .filter((item) => {
        const key = `${item.type}_${item.id}`;
        if (seen.has(key) || titlePreferences[key] === 'dislike') return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 10);
  }, [popularMovies, popularTV, titlePreferences, trendingWeek]);

  const personalizedRenderableSections = useMemo(() => {
    if (preferenceGenreScores.size === 0) return renderableSections;
    const affinity = (items: MovieOrShow[]) => items.slice(0, 12).reduce(
      (total, item) => total + item.genres.reduce(
        (genreTotal, genre) =>
          genreTotal + Math.max(0, preferenceGenreScores.get(normalizeGenreName(genre)) || 0),
        0,
      ),
      0,
    );
    return [...renderableSections].sort((a, b) => affinity(b.items) - affinity(a.items));
  }, [preferenceGenreScores, renderableSections]);

  const tvHomeSections = useMemo(() => {
    const sections: { key: string; title: string; subtitle?: string; items: MovieOrShow[] }[] = [];
    if (topTenItems.length) {
      sections.push({
        key: 'top-ten',
        title: 'TOP 10 Today',
        subtitle: 'The most popular and watched right now',
        items: topTenItems,
      });
    }
    if ((manualBySection.manual?.length ?? 0) > 0) {
      sections.push({
        key: 'manual',
        title: 'Noir Exclusive',
        items: manualBySection.manual,
      });
    }
    personalizedRenderableSections.forEach((section) => {
      sections.push({ key: section.key, title: section.title, items: section.items });
    });
    return sections;
  }, [
    manualBySection,
    personalizedRenderableSections,
    topTenItems,
  ]);

  if (authScreen) {
    return authScreen;
  }

  if (user && showOnboarding) {
    return (
      <OnboardingFlow
        initialName={user.name}
        onComplete={() => {
          localStorage.removeItem('noir_onboarding_pending');
          localStorage.setItem('noir_onboarding_complete', '1');
          setShowOnboarding(false);
        }}
      />
    );
  }

  const isTvApp = document.documentElement.classList.contains('noir-tv-app');
  const isPlayerWindow = !isTvApp && new URLSearchParams(window.location.search).get('play') === '1';
  const browseHeroBg = resizeTmdbImage(searchResults[0]?.backdrop || heroItems[0]?.backdrop || null, 'w1280');

  return (
    <div className={`min-h-screen text-white flex flex-row font-sans relative tracking-normal antialiased ${
      isTvApp ? 'bg-[#08080a]' : 'bg-[#05070b]'
    } ${isPlayerWindow ? 'noir-player-window' : ''}`}>

      {/* Desktop cinematic top navigation */}
      {!isTvApp && !isPlayerWindow && (
        <Sidebar
          activeView={activeView}
          searchMode={searchMode}
          setSearchMode={handleSetSearchMode}
          goHome={navigateToHome}
          openSearchOverlay={() => setIsSearchOverlayOpen((open) => !open)}
          isSearchOpen={isSearchOverlayOpen}
          onViewWatchlist={handleViewWatchlist}
          onViewHistory={handleViewHistory}
          onLogout={handleLogout}
          onLogin={() => {
            localStorage.removeItem('noir_user');
            setAuthView('signin');
            setUser(null);
          }}
          onSignUp={() => {
            localStorage.removeItem('noir_user');
            setAuthView('signup');
            setUser(null);
          }}
          user={user}
          onOpenProfile={() => setIsProfileModalOpen(true)}
        />
      )}

      {isTvApp && (
        <TvNavigation
          activeView={activeView}
          searchMode={searchMode}
          isSearchOpen={isSearchOverlayOpen}
          goHome={navigateToHome}
          openSearch={() => setIsSearchOverlayOpen(true)}
          setSearchMode={handleSetSearchMode}
          openWatchlist={handleViewWatchlist}
          user={user}
          openProfile={() => setIsProfileModalOpen(true)}
        />
      )}

      {!isTvApp && !isPlayerWindow && activeView === 'home' && (
        <button type="button" className="noir-mobile-corner-brand lg:hidden" onClick={navigateToHome} aria-label="Noir home">
          <LogoIcon />
        </button>
      )}

      {!isTvApp && !isPlayerWindow && activeView !== 'home' && (
        <div className="noir-global-back" dir="ltr">
          <button type="button" onClick={() => { if (window.history.length > 1) window.history.back(); else navigateToHome(); }} aria-label="Back"><ArrowLeft /></button>
          <span />
          <button type="button" onClick={navigateToHome} aria-label="Home"><Home /></button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">

      {/* Main Orchestration Views Switcher */}
      <main className={`flex-grow selection:bg-[#A0C9CB]/30 ${isPlayerWindow ? 'p-0' : isTvApp ? ((activeView === 'home' || activeView === 'detail') ? 'pb-0 pt-0' : 'pb-0 pt-24') : `pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0 ${(activeView === 'home' || activeView === 'detail' || activeView === 'search') ? 'pt-0' : 'pt-14 lg:pt-[68px]'}`}`}>
        {activeView ==='home' && (
          isTvApp ? (
            <TvHome
              heroItems={heroItems}
              continueWatching={continueWatching}
              sections={tvHomeSections}
              onSelect={handleTitleClick}
              onContinue={handleContinueWatchingClick}
              onPlay={handlePlayTitle}
              isSaved={isInWatchlist}
              onToggleSave={toggleWatchlistItem}
            />
          ) : (
          <PullToRefresh onRefresh={refreshHome}>
          <div className="animate-fade-in">
            {/* Display Hero slider */}
            <Hero
              trendingItems={heroItems}
              onPlayClick={handlePlayTitle}
              onInfoClick={(item) => handleTitleClick(item)}
              onTrailerClick={(item) => handleTitleClick(item)}
              isSaved={isInWatchlist}
              onToggleSave={toggleWatchlistItem}
            />

            {/* Custom Horizontal Cinema Rows */}
            <div className="pt-8 md:pt-12 pb-8 md:pb-14">
              {topTenItems.length > 0 && (
                <MovieRow
                  title="TOP 10 on Noir"
                  subtitle="The most watched titles right now"
                  items={topTenItems}
                  ranked
                  onItemClick={handleTitleClick}
                  isSaved={isInWatchlist}
                  onToggleSave={toggleWatchlistItem}
                  compactSaveButton
                />
              )}

              {continueWatching.length > 0 && (
                <div id="continue-watching-section" className="scroll-mt-20">
                  <ContinueWatchingRow
                    title="Continue Watching"
                    items={continueWatching}
                    onItemClick={handleContinueWatchingClick}
                    isSaved={isInWatchlist}
                    onToggleSave={toggleWatchlistItem}
                    compactSaveButton
                    onRemove={removeContinueWatchingItem}
                    onRestart={restartContinueWatchingItem}
                  />
                </div>
              )}

              <StudiosRow
                title="Only on"
                onSelectTitle={handleTitleClick}
                isSaved={isInWatchlist}
                onToggleSave={toggleWatchlistItem}
              />

              {/* Noir Exclusive — العناصر المضافة يدوياً بلا قسم مخصص (يظهر أول دائماً) */}
              {(manualBySection['manual']?.length ?? 0) > 0 && (
                <MovieRow
                  title="Noir Exclusive"
                  items={manualBySection['manual']}
                  onItemClick={handleTitleClick}
                  isSaved={isInWatchlist}
                  onToggleSave={toggleWatchlistItem}
                  compactSaveButton
                />
              )}

              {/* كل الأقسام مرتّبة حسب الداشبورد (أصلية + مخصصة)، الفاضية تُحذف */}
              {personalizedRenderableSections.map((sec, i) => (
                sec.items.length > 0 && (
                  <div key={sec.key}>
                    <MovieRow
                      title={sec.title}
                      items={sec.items}
                      onItemClick={handleTitleClick}
                      isSaved={isInWatchlist}
                      onToggleSave={toggleWatchlistItem}
                      compactSaveButton
                    />
                  </div>
                )
              ))}

              <CategoryRow onSelect={(key) => { window.location.hash = `#category/${key}`; }} />

              {isHomeLoading && (
                <>
                  <MovieRow title="Preparing your recommendations" items={[]} onItemClick={handleTitleClick} />
                  <MovieRow title="Most Watched" items={[]} onItemClick={handleTitleClick} />
                </>
              )}
</div>
</div>
          </PullToRefresh>
          )
        )}

        {/* Dedicated Watchlist View */}
        {activeView ==='watchlist' && (() => {
          // Keep this page intentionally simple: one useful content filter only.
          let processedItems = [...watchlist];
          if (!isTvApp && (watchlistFilter === 'movie' || watchlistFilter === 'tv')) {
            processedItems = processedItems.filter(item => item.type === watchlistFilter);
          }

          return (
            <div className="mx-auto max-w-[1800px] px-4 py-10 sm:px-6 lg:px-8 xl:px-10 lg:py-14 animate-fade-in text-left">
              {/* Header section on Dedicated Watchlist View */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12 select-none">
                <div className="space-y-3">
                  <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight">
                    My List
</h1>
                  <p className="text-white/45 text-sm">Everything you saved in one place.</p>
</div>

                {!isTvApp && watchlist.length > 0 && (
                  <div className="flex items-center justify-start md:justify-end">
                    {/* Filter Segmented Control */}
                    <div className="flex bg-white/[0.045] border border-white/[0.07] p-1 rounded-2xl">
                      <button
                        onClick={() => setWatchlistFilter('all')}
                        className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                          watchlistFilter ==='all' ?'bg-[#A0C9CB] text-black' :'text-white/50 hover:text-white'
                        }`}
                      >
                        All
</button>
                      <button
                        onClick={() => setWatchlistFilter('movie')}
                        className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                          watchlistFilter ==='movie' ?'bg-[#A0C9CB] text-black' :'text-white/50 hover:text-white'
                        }`}
                      >
                        Movies
</button>
                      <button
                        onClick={() => setWatchlistFilter('tv')}
                        className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                          watchlistFilter ==='tv' ?'bg-[#A0C9CB] text-black' :'text-white/50 hover:text-white'
                        }`}
                      >
                        TV Shows
</button>
</div>
</div>
                )}
</div>

              {watchlist.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center bg-stone-950 border border-white/5 rounded-3xl mt-6 min-h-[300px]">
                  <span className="text-5xl mb-4"></span>
                  <h3 className="text-lg font-bold text-white mb-2">Your list is empty!</h3>
                  <p className="text-xs text-gray-400 max-w-sm leading-relaxed">
                    Browse movies and shows on the home page and add them with the save button on the title details.
</p>
                  <button
                    onClick={navigateToHome}
                    className="mt-6 bg-white hover:bg-white/90 text-black text-xs font-bold px-6 py-3 rounded-full cursor-pointer transition-all"
                  >
                    Go home and browse titles
</button>
</div>
              ) : processedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center bg-stone-950 border border-white/5 rounded-3xl mt-6 min-h-[250px]">
                  <span className="text-4xl mb-3"></span>
                  <h3 className="text-base font-bold text-white mb-1">No matching results!</h3>
                  <p className="text-xs text-gray-400 max-w-sm">
                    We could not find any titles matching the selected filters in your list.
</p>
</div>
              ) : (
                <div className="grid grid-cols-1 gap-x-4 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {processedItems.map((item, idx) => {
                    const artwork = resolveArtworkUrl(item.backdrop, 'backdrop') || resolveArtworkUrl(item.poster, 'poster');
                    const progressKey =`noir_progress_${item.type}_${item.id}`;
                    const storedProgress = localStorage.getItem(progressKey);
                    const progress = storedProgress ? Number(storedProgress) : 0;

                    return (
                      <div
                        key={`${item.type}-${item.id}`}
                        onClick={() => handleTitleClick(item)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleTitleClick(item);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        data-tv-card={isTvApp ? '' : undefined}
                        aria-label={`Open ${item.title}`}
                        style={{ animationDelay: `${idx * 40}ms` }}
                        className="group/card card-transition card-cinematic cursor-pointer select-none"
                      >
                        <div data-tv-card-artwork className="relative aspect-video overflow-hidden rounded-[18px] bg-black border border-white/[0.06]">
                          <WatchlistButton
                            saved
                            onToggle={() => toggleWatchlistItem(item)}
                            className="absolute top-2 right-2 z-20"
                          />
                          {artwork ? (
                            <img
                              src={artwork}
                              alt={item.title}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover select-none"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center p-3 text-stone-600 bg-stone-950">
                              <span className="text-[10px] sm:text-xs font-semibold text-center leading-normal break-all line-clamp-2">
                                {item.title}
</span>
</div>
                          )}

                          {/* Watch progression indicator */}
                          {progress > 0 && (
                            <div className="absolute bottom-0 left-0 right-0 z-20 h-1 bg-black/40">
                              <div
                                className="h-full bg-[#A0C9CB] transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              />
</div>
                          )}
</div>

                        <div className="px-1 pt-3 text-left">
                          <p className="text-white text-sm font-bold line-clamp-1">{item.title}</p>
                          <p className="mt-1 text-[11px] font-medium text-white/40">
                            {item.type === 'movie' ? 'Movie' : 'TV Show'} · {item.year || '—'}
                          </p>
                        </div>

</div>
                    );
                  })}
</div>
              )}
</div>
          );
        })()}

        {activeView === 'history' && (
          <Suspense fallback={<DeferredViewFallback />}>
            <ViewingHistoryPage
              items={viewingHistory}
              onItemClick={handleTitleClick}
              onRemove={removeViewingHistoryItem}
            />
          </Suspense>
        )}


        {activeView ==='search' && (
          <div className="noir-discovery-page noir-section-swipe-in">
            {/* Movy-style hero with a drifting poster collage */}
            <div className="noir-movies-hero">
              <div
                className="noir-movies-hero-bg"
                style={{ backgroundImage: browseHeroBg ? `url(${browseHeroBg})` : undefined }}
              />
              <div className="noir-movies-hero-scrim" />
              <div className="noir-movies-hero-copy">
                <h1>{searchMode === 'tv' ? 'Shows' : 'Movies'}</h1>
                <p>{searchMode === 'tv' ? 'Discover the latest and greatest series' : 'Discover the latest and greatest films'}</p>
              </div>
            </div>

            <div className="pb-16">
              {!isTvApp && !fQuery.trim() && searchResults.length > 0 && (
                <MovieRow
                  title={searchMode === 'movie' ? 'Trending Movies' : 'Trending Shows'}
                  items={searchResults.slice(0, 14)}
                  onItemClick={handleTitleClick}
                  isSaved={isInWatchlist}
                  onToggleSave={toggleWatchlistItem}
                  compactSaveButton
                />
              )}

              {/* Movy-style filter chips */}
              {!isTvApp && (
                <div className="noir-filter-bar">
                  <div className="noir-filter-chips">
                    {!fQuery.trim() && (
                      <>
                        <div className="noir-chip">
                          <select
                            value={Array.from(selectedGenres)[0] || ''}
                            onChange={(e) => {
                              const id = Number(e.target.value);
                              const next = new Set<number>();
                              if (id > 0) next.add(id);
                              setSelectedGenres(next);
                            }}
                          >
                            <option value="">Genres</option>
                            {MOVIE_GENRES.map((g) => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                          <ChevronDown />
                        </div>
                        <div className="noir-chip">
                          <select value={selectedYear || ''} onChange={(e) => setSelectedYear(e.target.value || null)}>
                            <option value="">Years</option>
                            {YEARS.map((y) => (
                              <option key={y} value={y}>{y}</option>
                            ))}
                          </select>
                          <ChevronDown />
                        </div>
                        <div className="noir-chip">
                          <select value={selectedCountry || ''} onChange={(e) => setSelectedCountry(e.target.value || null)}>
                            <option value="">Countries</option>
                            {COUNTRIES.map(([val, label]) => (
                              <option key={val} value={val}>{label}</option>
                            ))}
                          </select>
                          <ChevronDown />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="noir-chip noir-chip-sort">
                    <select value={fSort} onChange={(e) => setFSort(e.target.value)}>
                      <option value="trend">Most popular</option>
                      <option value="rating">Top rated</option>
                      <option value="year">Newest</option>
                      <option value="az">A-Z</option>
                    </select>
                    <ChevronDown />
                  </div>
                </div>
              )}

              {isSearching ? (
                <div className="noir-movies-grid">
                  {Array.from({ length: 18 }).map((_, i) => (
                    <div key={i} className="aspect-video w-full rounded-[10px] bg-[#121212] border border-white/5 overflow-hidden animate-pulse">
                      <div className="w-full h-full bg-stone-900 shimmer-bg" />
                    </div>
                  ))}
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-10">
                  <div className="noir-movies-grid">
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
                        role="button"
                        tabIndex={0}
                        data-tv-card={isTvApp ? '' : undefined}
                        data-search-result-index={idx}
                        aria-label={`Open ${item.title}`}
                        style={{ animationDelay: `${idx * 35}ms` }}
                        className="noir-browse-card group/card card-transition cursor-pointer select-none"
                      >
                        <div data-tv-card-artwork className="noir-browse-art relative aspect-video overflow-hidden">
                          {item.backdrop || item.poster ? (
                            <img
                              src={item.backdrop || item.poster || undefined}
                              alt={item.title}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover select-none"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center p-3 text-stone-600 bg-stone-950">
                              <span className="text-[10px] sm:text-xs font-semibold text-center leading-normal break-all line-clamp-2">
                                {item.title}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="noir-browse-meta">
                          <p className="noir-bm-title">{item.title}</p>
                          <p className="noir-bm-meta">
                            {item.rating > 0 && <><Star className="inline h-3 w-3 -mt-0.5 fill-current text-[var(--noir-accent)]" /> {item.rating.toFixed(1)} · </>}{item.year || '—'} · {item.type === 'movie' ? 'Movie' : 'TV Show'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {searchPage < searchTotalPages && (
                    <div className="flex justify-center pt-2">
                      <button
                        onClick={() => triggerSearchQuery(true)}
                        disabled={isLoadingMore}
                        data-tv-load-more={isTvApp ? '' : undefined}
                        className="noir-glass-btn flex items-center gap-2 text-white px-8 py-3 rounded-full text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isLoadingMore ? (
                          <>
                            <Loader className="w-4 h-4 text-[#A0C9CB] animate-spin" />
                            <span>Loading...</span>
                          </>
                        ) : (
                          <span>Show more titles</span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="noir-browse-edge py-24 text-center flex flex-col items-center justify-center gap-4 border border-white/5 bg-stone-900/10 rounded-3xl">
                  <span className="text-4xl text-stone-600">∅</span>
                  <h3 className="text-sm font-bold text-white">No matching titles found</h3>
                  <p className="text-xs text-gray-500 max-w-xs">
                    Try changing the selected filters for better results.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeView ==='detail' && selectedTitle && (
          <div className="animate-fade-in block">
            <Suspense fallback={<DeferredViewFallback />}>
            <DetailView
              type={selectedTitle.type}
              id={selectedTitle.id}
              initialSeason={selectedEpisodeRoute?.season}
              initialEpisode={selectedEpisodeRoute?.episode}
              onEpisodeChange={handleEpisodeRouteChange}
              onItemClick={handleTitleClick}
              onOpenShare={handleOpenShare}
              user={user}
              showToast={showToast}
              autoOpenWatchTogether={joinRoomCode}
              onClearAutoOpenWatchTogether={() => setJoinRoomCode('')}
              autoResume={autoResumeRequested}
              onAutoResumeConsumed={() => setAutoResumeRequested(false)}
              autoStart={autoPlayRequested}
              onAutoStartConsumed={() => setAutoPlayRequested(false)}
              watchlist={watchlist}
              onToggleWatchlistItem={toggleWatchlistItem}
              preference={titlePreferences[`${selectedTitle.type}_${selectedTitle.id}`]}
              onPreference={handleTitlePreference}
              introEndSeconds={selectedManualItem?.introEndSeconds || 0}
              manualData={(() => {
                // عنصر يدوي محض: نمرّر بياناته بدل طلب TMDB.
                const m = selectedManualItem;
                if (!m || m.tmdbId) return null;
                return {
                  title: m.title, overview: m.overview, poster: m.poster, backdrop: m.backdrop,
                  rating: m.rating, year: m.year, genres: m.genres, director: m.director,
                  country: m.country, language: m.language,
                };
              })()}
            />
            </Suspense>
</div>
        )}

        {activeView ==='category' && selectedCategoryKey && getCategoryByKey(selectedCategoryKey) && (
          <Suspense fallback={<DeferredViewFallback />}>
            <CategoryPage
              category={getCategoryByKey(selectedCategoryKey)!}
              onItemClick={handleTitleClick}
              showAllMode={categoryAllMode}
              onOpenAll={(key) => { window.location.hash = `#category/${key}/all`; }}
              isSaved={isInWatchlist}
              onToggleSave={toggleWatchlistItem}
            />
          </Suspense>
        )}

        {activeView ==='studio' && selectedStudioKey && getStudioByKey(selectedStudioKey) && (
          <Suspense fallback={<DeferredViewFallback />}>
            <StudioPage
              studio={getStudioByKey(selectedStudioKey)!}
              onItemClick={handleTitleClick}
              isSaved={isInWatchlist}
              onToggleSave={toggleWatchlistItem}
            />
          </Suspense>
        )}

        {activeView ==='admin' && (
          <Suspense fallback={<DeferredViewFallback />}>
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

      {/* Global Minimalist Footer and disclaimer notes */}
      {!isTvApp && !isPlayerWindow && activeView !== 'admin' && (
        <Footer goHome={navigateToHome} setSearchMode={handleSetSearchMode} />
      )}

      </div>{/* end main content wrapper */}

      {/* iOS/Android style bottom navigation bar on touchscreens */}
      {!isTvApp && !isPlayerWindow && (
        <MobileNav
          activeView={activeView}
          searchMode={searchMode}
          goHome={navigateToHome}
          setSearchMode={handleSetSearchMode}
          openAnime={() => { window.location.hash = '#category/animation'; }}
          openSearchOverlay={() => setIsSearchOverlayOpen((open) => !open)}
          isSearchOpen={isSearchOverlayOpen}
          user={user}
          onViewWatchlist={handleViewWatchlist}
          onViewHistory={handleViewHistory}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          onLogout={handleLogout}
          onLogin={() => {
            localStorage.removeItem('noir_user');
            setAuthView('signin');
            setUser(null);
          }}
        />
      )}

      {/* Cmd+K QuickSearch predicting suggestions overlay */}
      {!isPlayerWindow && <SearchOverlay
        isOpen={isSearchOverlayOpen}
        onClose={() => setIsSearchOverlayOpen(false)}
        onSelectTitle={handleQuickSelectTitle}
        isSaved={isInWatchlist}
        onToggleSave={toggleWatchlistItem}
        onBrowseCategory={(key) => {
          setIsSearchOverlayOpen(false);
          window.location.hash = `#category/${key}`;
        }}
      />}

      {/* Browser URL Share Dialog */}
      {!isTvApp && !isPlayerWindow && <ShareModal
        isOpen={isShareModalOpen}
        url={shareUrl}
        onClose={() => setIsShareModalOpen(false)}
        onToast={showToast}
      />}

      {/* Google Account Profile Details Dialog Modal */}
      {isProfileModalOpen && user && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 text-left" role="dialog" aria-modal="true" aria-label="Profile">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/85 backdrop-blur-md cursor-pointer animate-fade-in"
            onClick={() => setIsProfileModalOpen(false)}
          />

          {/* Modal Container */}
          <div className={`relative z-10 w-full border border-white/10 rounded-md p-6 md:p-8 shadow-3xl text-center select-none animate-scale-in ${
            isTvApp ? 'max-w-lg bg-[#101012]' : 'max-w-sm bg-[#141414]'
          }`}>
            {!isTvApp && (
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className="absolute top-4 left-4 hidden h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-white/8 hover:text-white lg:flex"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            )}
            {/* Profile Avatar Frame */}
            <div className="flex flex-col items-center gap-4 mt-2">
              <div className="w-20 h-20 rounded-md bg-white/5 border border-white/10 shadow-xl overflow-hidden relative flex items-center justify-center">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#00858B] text-white font-extrabold text-2xl uppercase">
                    {user.name.slice(0, 2)}
</div>
                )}
                <div className={`absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full border border-stone-950 ${user.type ==='google' ?'bg-indigo-500' : user.type === 'email' ? 'bg-[#A0C9CB]' : 'bg-emerald-500'}`} />
</div>

              {/* User Bio Information */}
              <div className="space-y-1 text-center">
                <h3 className="text-lg font-extrabold text-white leading-snug">{user.name}</h3>
                {user.email && (
                  <p className="text-xs text-gray-400 font-medium font-mono select-text">{user.email}</p>
                )}
                {user.type ==='guest' ? (
                  <span className="inline-block bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full mt-1">
                    You are currently signed in as a guest
</span>
                ) : user.type === 'email' ? (
                  <div className="flex flex-col items-center gap-2 mt-1">
                    <span className="inline-block bg-[#A0C9CB]/10 border border-[#A0C9CB]/25 text-[#A0C9CB] text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                      Noir Cinema account
                    </span>
                    {auth.currentUser?.emailVerified === false && (
                      <div className="mt-1 flex flex-col items-center gap-1.5 p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl max-w-[240px] mx-auto">
                        <p className="text-[10px] text-amber-400 font-bold leading-normal">
                          Email not verified ⚠️
                        </p>
                        <p className="text-[9px] text-gray-400 leading-normal">
                          The cloud blocks saving for unverified accounts to protect your data.
                        </p>
                        {!isTvApp && <button
                          onClick={handleSendVerificationEmail}
                          disabled={isSendingVerification}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 underline font-extrabold cursor-pointer disabled:opacity-50"
                        >
                          {isSendingVerification ? 'Sending...' : 'Send verification email'}
                        </button>}
                      </div>
                    )}
                  </div>
                ) : !isTvApp ? (
                  <span className="inline-block bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full mt-1">
                    Google account active and verified
</span>
                ) : null}
</div>
</div>



            {/* Restrict warning or list status */}
            <div className="mt-8 p-3.5 rounded-sm bg-black/35 border border-white/5 text-left space-y-1">
              <p className="text-[10px] text-gray-500 font-bold leading-normal">List and activity stats</p>
              <div className="text-xs text-gray-300 font-semibold leading-relaxed">
                {user.type ==='guest' ? (
                  <span className="text-amber-500 font-bold block">Guest accounts have limited saving and watch-party features. Sign in with Google to enable them!</span>
                ) : (
                  <span>Total titles added to your list: <strong className="text-[#A0C9CB]">{watchlist.length} titles</strong></span>
                )}
</div>
</div>

            {/* Action buttons */}
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsProfileModalOpen(false);
                  handleViewWatchlist();
                }}
                className="w-full bg-white/8 border border-white/8 hover:bg-white/14 text-white font-bold py-3 rounded-sm transition-colors cursor-pointer text-xs flex items-center justify-center gap-2"
              >
                <span>My list</span>
                <span className="text-white/45">({watchlist.length})</span>
              </button>
              <button
                ref={profileHistoryButtonRef}
                data-tv-autofocus={isTvApp ? '' : undefined}
                onClick={handleViewHistory}
                className="w-full bg-white/8 border border-white/8 hover:bg-white/14 text-white font-bold py-3 rounded-sm transition-colors cursor-pointer text-xs flex items-center justify-center gap-2"
              >
                <span>Watch history</span>
                <span className="text-white/45">({viewingHistory.length})</span>
              </button>
              {user.type ==='guest' && !isTvApp && (
                <button
                  onClick={() => {
                    setIsProfileModalOpen(false);
                    localStorage.removeItem('noir_user');
                    setUser(null);
                  }}
                  className="w-full bg-white hover:bg-white/85 text-black font-bold py-3 rounded-sm transition-all cursor-pointer text-xs"
                >
                  Link Google sign-in
</button>
              )}
              <button
                onClick={() => {
                  handleLogout();
                  setIsProfileModalOpen(false);
                }}
                className="w-full bg-black/40 border border-white/8 hover:border-[#A0C9CB]/60 text-[#A0C9CB] hover:text-[#55DADD] font-bold py-3 rounded-sm transition-all cursor-pointer text-xs flex items-center justify-center gap-2"
              >
                <span></span>
                <span>Sign out</span>
</button>
</div>
</div>
</div>
      )}

      {/* Floating Success Indicator Toast notifications */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-6 left-0 right-0 z-[600] flex justify-center pointer-events-none px-4">
          <div className="pointer-events-auto glass-strong text-white text-xs font-semibold rounded-full py-3 px-6 shadow-2xl flex items-center gap-2.5 select-none animate-slide-up [direction:ltr]">
            <LogoIcon className="w-4 h-4 text-[#A0C9CB] shrink-0" />
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
