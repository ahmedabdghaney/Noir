import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  fetchSignInMethodsForEmail,
  sendEmailVerification,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDocFromServer,
} from 'firebase/firestore';
import {
  ContinueWatchingItem,
  MovieOrShow,
  PlaybackSettings,
  TitlePreference,
  ViewingHistoryItem,
} from '../types';

const firebaseConfig = {
  projectId: "ios-app-498810",
  appId: "1:645555146334:web:f06f7e0b047ebdcf576ecf",
  apiKey: "AIzaSyA1HQXnvooMHcuROqxcwJszDfTsLK5fIaE",
  authDomain: "ios-app-498810.firebaseapp.com",
  storageBucket: "ios-app-498810.firebasestorage.app",
  messagingSenderId: "645555146334"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with persistent standard configs
export const auth = getAuth(app);

// Firestore with persistent local cache (IndexedDB) so the watchlist shows
// instantly from cache on load, then syncs from the cloud in the background.
// This removes the multi-second delay when opening on another device.
export const db = initializeFirestore(
  app,
  {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  },
  "ai-studio-d038e6e0-89a6-457a-a50e-97b6aadc9e67",
);

// Test connection to Firestore instantly on bootstrap
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

// Configure Google Sign-In Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

/**
 * Initiates standard Google authentication via interactive popup
 */
export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error during Google Sign-In:", error);
    throw error;
  }
};

/**
 * Handles user sign out from Firebase
 */
export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error during logout:", error);
    throw error;
  }
};

/**
 * Translate Firebase Auth error codes into clear Arabic messages.
 */
export const translateAuthError = (err: any): string => {
  const code = err?.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'هذا البريد مسجّل مسبقاً، جرّب تسجيل الدخول';
    case 'auth/invalid-email':
      return 'صيغة البريد الإلكتروني غير صحيحة';
    case 'auth/weak-password':
      return 'كلمة السر ضعيفة، استعمل 6 خانات على الأقل';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'البريد أو كلمة السر غير صحيحة';
    case 'auth/too-many-requests':
      return 'محاولات كثيرة، جرّب بعد قليل';
    case 'auth/network-request-failed':
      return 'تعذّر الاتصال بالشبكة';
    case 'auth/missing-password':
      return 'أدخل كلمة السر';
    case 'auth/password-does-not-meet-requirements':
      return 'كلمة السر ضعيفة: لازم تحتوي حرف كبير (A-Z) وحرف صغير (a-z) و 6 خانات على الأقل';
    default:
      return err?.message || 'حدث خطأ غير متوقع';
  }
};

/**
 * Sign up with email and password. Optionally sets a display name.
 */
export const signUpWithEmail = async (email: string, password: string, displayName?: string) => {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (displayName && displayName.trim()) {
    try {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    } catch (e) {
      console.warn('Failed to set display name', e);
    }
  }
  return cred.user;
};

/**
 * Sign in with email and password.
 */
export const signInWithEmail = async (email: string, password: string) => {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
};

/**
 * Send a password reset email.
 */
export const resetPassword = async (email: string) => {
  await sendPasswordResetEmail(auth, email.trim());
};

/**
 * Check which sign-in methods are registered for an email.
 * Returns e.g. ['password'], ['google.com'], or both, or [] if no account.
 */
export const checkSignInMethods = async (email: string): Promise<string[]> => {
  return await fetchSignInMethodsForEmail(auth, email.trim());
};

// --- FIRESTORE SECURE SYNC OPERATIONS ---

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

/**
 * Standard Firestore error wrapping handler conforming to strict platform guidelines.
 */
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
       })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Fetch the authenticated user's cloud watchlist from Firestore, ordered by addition date.
 */
export const fetchFirestoreWatchlist = async (userId: string): Promise<MovieOrShow[]> => {
  const pathSpec = `users/${userId}/watchlist`;
  try {
    const q = collection(db, 'users', userId, 'watchlist');
    const querySnapshot = await getDocs(q);
    const list: any[] = [];
    querySnapshot.forEach((docSnap) => {
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
    return normalizedList;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, pathSpec);
    return [];
  }
};

/**
 * Add an item to the authenticated user's cloud watchlist inside Firestore.
 */
export const addToFirestoreWatchlist = async (userId: string, item: Omit<MovieOrShow, 'date' | 'overview'>): Promise<void> => {
  const itemId = `${item.type}_${item.id}`;
  const pathSpec = `users/${userId}/watchlist/${itemId}`;
  try {
    const docRef = doc(db, 'users', userId, 'watchlist', itemId);
    await setDoc(docRef, {
      id: Number(item.id),
      type: item.type,
      title: item.title,
      poster: item.poster || '',
      backdrop: item.backdrop || '',
      rating: Number(item.rating || 0),
      year: String(item.year || ''),
      genres: Array.isArray(item.genres) ? item.genres : [],
      addedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, pathSpec);
  }
};

/**
 * Send an email verification link to the current authenticated user.
 */
export const sendVerification = async () => {
  if (auth.currentUser) {
    await sendEmailVerification(auth.currentUser);
  }
};

/**
 * Remove an item from the authenticated user's cloud watchlist inside Firestore.
 */
export const removeFromFirestoreWatchlist = async (userId: string, type: 'movie' | 'tv', id: number): Promise<void> => {
  const itemId = `${type}_${id}`;
  const pathSpec = `users/${userId}/watchlist/${itemId}`;
  try {
    const docRef = doc(db, 'users', userId, 'watchlist', itemId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, pathSpec);
  }
};

export interface ContinueWatchingCloudItem extends ContinueWatchingItem {}

const normalizeContinueWatchingDoc = (data: any): ContinueWatchingCloudItem => ({
  id: Number(data.id),
  type: data.type as 'movie' | 'tv',
  title: data.title || '',
  overview: '',
  poster: data.poster || null,
  backdrop: data.backdrop || null,
  rating: Number(data.rating || 0),
  year: String(data.year || ''),
  date: '',
  genres: Array.isArray(data.genres) ? data.genres : [],
  progress: Math.max(0, Math.min(100, Number(data.progress || 0))),
  positionSeconds: Math.max(0, Number(data.positionSeconds || 0)),
  durationSeconds: Math.max(0, Number(data.durationSeconds || 0)),
  season: Math.max(0, Number(data.season || 0)),
  episode: Math.max(0, Number(data.episode || 0)),
  updatedAtMs:
    typeof data.updatedAt?.toMillis === 'function'
      ? data.updatedAt.toMillis()
      : Number(data.updatedAt?.seconds || 0) * 1000,
});

export const fetchFirestoreContinueWatching = async (
  userId: string,
): Promise<ContinueWatchingCloudItem[]> => {
  const pathSpec = `users/${userId}/continueWatching`;
  try {
    const snapshot = await getDocs(collection(db, 'users', userId, 'continueWatching'));
    const items = snapshot.docs
      .map((docSnap) => normalizeContinueWatchingDoc(docSnap.data()))
      .filter(
        (item) =>
          item.id &&
          (item.type === 'movie' || item.type === 'tv') &&
          item.title &&
          item.positionSeconds > 0 &&
          item.durationSeconds > 0,
      );
    return items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, pathSpec);
    return [];
  }
};

export const saveFirestoreContinueWatching = async (
  userId: string,
  item: ContinueWatchingItem,
): Promise<void> => {
  const itemId = `${item.type}_${item.id}`;
  const pathSpec = `users/${userId}/continueWatching/${itemId}`;
  try {
    await setDoc(doc(db, 'users', userId, 'continueWatching', itemId), {
      id: Number(item.id),
      type: item.type,
      title: item.title || '',
      poster: item.poster || '',
      backdrop: item.backdrop || '',
      rating: Number(item.rating || 0),
      year: String(item.year || ''),
      genres: Array.isArray(item.genres) ? item.genres : [],
      progress: Math.max(0, Math.min(100, Number(item.progress || 0))),
      positionSeconds: Math.max(0, Number(item.positionSeconds || 0)),
      durationSeconds: Math.max(0, Number(item.durationSeconds || 0)),
      season: Math.max(0, Number(item.season || 0)),
      episode: Math.max(0, Number(item.episode || 0)),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, pathSpec);
  }
};

export const removeFromFirestoreContinueWatching = async (
  userId: string,
  type: 'movie' | 'tv',
  id: number,
): Promise<void> => {
  const itemId = `${type}_${id}`;
  const pathSpec = `users/${userId}/continueWatching/${itemId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'continueWatching', itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, pathSpec);
  }
};

export const subscribeFirestoreContinueWatching = (
  userId: string,
  onItems: (items: ContinueWatchingCloudItem[]) => void,
  onError?: (error: unknown) => void,
): (() => void) =>
  onSnapshot(
    collection(db, 'users', userId, 'continueWatching'),
    (snapshot) => {
      const items = snapshot.docs
        .map((docSnap) => normalizeContinueWatchingDoc(docSnap.data()))
        .filter(
          (item) =>
            item.id &&
            (item.type === 'movie' || item.type === 'tv') &&
            item.title &&
            item.positionSeconds > 0 &&
            item.durationSeconds > 0,
        )
        .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onItems(items);
    },
    (error) => {
      console.error('Continue watching snapshot subscription error:', error);
      onError?.(error);
    },
  );

export const mergeLocalContinueWatchingIntoCloud = async (
  userId: string,
  localItems: ContinueWatchingItem[],
): Promise<void> => {
  const cloudItems = await fetchFirestoreContinueWatching(userId);
  const cloudByKey = new Map(
    cloudItems.map((item) => [`${item.type}_${item.id}`, item] as const),
  );

  await Promise.all(
    localItems.map(async (item) => {
      const cloudItem = cloudByKey.get(`${item.type}_${item.id}`);
      if (!cloudItem || item.updatedAtMs > cloudItem.updatedAtMs) {
        await saveFirestoreContinueWatching(userId, item);
      }
    }),
  );
};

const normalizeViewingHistoryDoc = (data: any): ViewingHistoryItem => ({
  id: Number(data.id),
  type: data.type as 'movie' | 'tv',
  title: data.title || '',
  overview: '',
  poster: data.poster || null,
  backdrop: data.backdrop || null,
  rating: Number(data.rating || 0),
  year: String(data.year || ''),
  date: '',
  genres: Array.isArray(data.genres) ? data.genres : [],
  progress: Math.max(0, Math.min(100, Number(data.progress || 0))),
  positionSeconds: Math.max(0, Number(data.positionSeconds || 0)),
  durationSeconds: Math.max(0, Number(data.durationSeconds || 0)),
  season: Math.max(0, Number(data.season || 0)),
  episode: Math.max(0, Number(data.episode || 0)),
  completed: Boolean(data.completed),
  watchCount: Math.max(1, Number(data.watchCount || 1)),
  lastWatchedAtMs:
    typeof data.lastWatchedAt?.toMillis === 'function'
      ? data.lastWatchedAt.toMillis()
      : Number(data.lastWatchedAt?.seconds || 0) * 1000,
});

export const fetchFirestoreViewingHistory = async (
  userId: string,
): Promise<ViewingHistoryItem[]> => {
  const snapshot = await getDocs(collection(db, 'users', userId, 'viewingHistory'));
  return snapshot.docs
    .map((item) => normalizeViewingHistoryDoc(item.data()))
    .filter((item) => item.id && item.title)
    .sort((a, b) => b.lastWatchedAtMs - a.lastWatchedAtMs);
};

export const saveFirestoreViewingHistory = async (
  userId: string,
  item: ViewingHistoryItem,
): Promise<void> => {
  const itemId = `${item.type}_${item.id}`;
  await setDoc(doc(db, 'users', userId, 'viewingHistory', itemId), {
    id: Number(item.id),
    type: item.type,
    title: item.title || '',
    poster: item.poster || '',
    backdrop: item.backdrop || '',
    rating: Number(item.rating || 0),
    year: String(item.year || ''),
    genres: Array.isArray(item.genres) ? item.genres : [],
    progress: Math.max(0, Math.min(100, Number(item.progress || 0))),
    positionSeconds: Math.max(0, Number(item.positionSeconds || 0)),
    durationSeconds: Math.max(0, Number(item.durationSeconds || 0)),
    season: Math.max(0, Number(item.season || 0)),
    episode: Math.max(0, Number(item.episode || 0)),
    completed: Boolean(item.completed),
    watchCount: Math.max(1, Math.floor(Number(item.watchCount || 1))),
    lastWatchedAt: serverTimestamp(),
  });
};

export const removeFromFirestoreViewingHistory = async (
  userId: string,
  type: 'movie' | 'tv',
  id: number,
): Promise<void> => {
  await deleteDoc(doc(db, 'users', userId, 'viewingHistory', `${type}_${id}`));
};

export const subscribeFirestoreViewingHistory = (
  userId: string,
  onItems: (items: ViewingHistoryItem[]) => void,
  onError?: (error: unknown) => void,
): (() => void) =>
  onSnapshot(
    collection(db, 'users', userId, 'viewingHistory'),
    (snapshot) => {
      onItems(
        snapshot.docs
          .map((item) => normalizeViewingHistoryDoc(item.data()))
          .filter((item) => item.id && item.title)
          .sort((a, b) => b.lastWatchedAtMs - a.lastWatchedAtMs),
      );
    },
    (error) => onError?.(error),
  );

export const mergeLocalViewingHistoryIntoCloud = async (
  userId: string,
  localItems: ViewingHistoryItem[],
): Promise<void> => {
  const cloud = await fetchFirestoreViewingHistory(userId);
  const cloudByKey = new Map(cloud.map((item) => [`${item.type}_${item.id}`, item] as const));
  await Promise.all(
    localItems.map(async (item) => {
      const cloudItem = cloudByKey.get(`${item.type}_${item.id}`);
      if (!cloudItem || item.lastWatchedAtMs > cloudItem.lastWatchedAtMs) {
        await saveFirestoreViewingHistory(userId, item);
      }
    }),
  );
};

export const subscribeFirestoreTitlePreferences = (
  userId: string,
  onPreferences: (preferences: Record<string, TitlePreference>) => void,
): (() => void) =>
  onSnapshot(collection(db, 'users', userId, 'titlePreferences'), (snapshot) => {
    const preferences: Record<string, TitlePreference> = {};
    snapshot.docs.forEach((item) => {
      const value = item.data().value;
      if (value === 'like' || value === 'dislike') preferences[item.id] = value;
    });
    onPreferences(preferences);
  });

export const saveFirestoreTitlePreference = async (
  userId: string,
  type: 'movie' | 'tv',
  id: number,
  value: TitlePreference | null,
): Promise<void> => {
  const itemId = `${type}_${id}`;
  const ref = doc(db, 'users', userId, 'titlePreferences', itemId);
  if (!value) {
    await deleteDoc(ref);
    return;
  }
  await setDoc(ref, {
    id: Number(id),
    type,
    value,
    updatedAt: serverTimestamp(),
  });
};

export const subscribeFirestorePlaybackSettings = (
  userId: string,
  onSettings: (settings: PlaybackSettings) => void,
): (() => void) =>
  onSnapshot(doc(db, 'users', userId, 'settings', 'playback'), (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.data();
    onSettings({
      autoplayNext: data.autoplayNext !== false,
      subtitleSize: Math.max(50, Math.min(250, Number(data.subtitleSize || 50))),
      subtitleOffset: Math.max(-10, Math.min(10, Number(data.subtitleOffset || 0))),
      updatedAtMs:
        typeof data.updatedAt?.toMillis === 'function' ? data.updatedAt.toMillis() : 0,
    });
  });

export const saveFirestorePlaybackSettings = async (
  userId: string,
  settings: Omit<PlaybackSettings, 'updatedAtMs'>,
): Promise<void> => {
  await setDoc(doc(db, 'users', userId, 'settings', 'playback'), {
    autoplayNext: Boolean(settings.autoplayNext),
    subtitleSize: Math.max(50, Math.min(250, Number(settings.subtitleSize || 50))),
    subtitleOffset: Math.max(-10, Math.min(10, Number(settings.subtitleOffset || 0))),
    updatedAt: serverTimestamp(),
  });
};
