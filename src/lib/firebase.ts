import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
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
