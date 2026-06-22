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
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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

// Use the designated custom firestore databaseId from configuration
export const db = getFirestore(app, "ai-studio-d038e6e0-89a6-457a-a50e-97b6aadc9e67");

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
