
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// Firebase Messaging is initialized in the component/layout where it's needed
// to ensure it only runs on the client side.

// Your web app's Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const db = getFirestore(app);

export function getActiveYear(): string {
  if (typeof window !== 'undefined') {
    const match = document.cookie.match(/(?:^|; )active_year=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : (process.env.NEXT_PUBLIC_ACTIVE_YEAR || "1448H");
  } else {
    try {
      const { cookies } = require('next/headers');
      const cookieStore = cookies();
      const activeYear = cookieStore.get('active_year')?.value;
      return activeYear || (process.env.NEXT_PUBLIC_ACTIVE_YEAR || "1448H");
    } catch (e) {
      return process.env.NEXT_PUBLIC_ACTIVE_YEAR || "1448H";
    }
  }
}

export function getYearPath(subPath: string): string {
  if (subPath.startsWith('years/')) return subPath;
  const activeYear = getActiveYear();
  return `years/${activeYear}/${subPath}`;
}

// NOTE: We are removing the messaging export from here to avoid server-side execution issues.
// getMessaging will be called directly in the client-side component (DashboardLayout)
// which ensures it only runs in the browser where it is supported.

export { app, db };
