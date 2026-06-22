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
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  getDocFromServer,
} from 'firebase/firestore';
import { MovieOrShow } from '../types';

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

// Use the designated custom firestore databaseId from configuration or default database for custom user project
export const db = firebaseConfig.projectId === "ios-app-498810" 
  ? getFirestore(app) 
  : getFirestore(app, "ai-studio-d038e6e0-89a6-457a-a50e-97b6aadc9e67");

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

