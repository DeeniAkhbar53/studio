
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB6sOs0IdR8ov6R3szYmrCbdP2APnRBl5M",
  authDomain: "bgk-attendance-new.firebaseapp.com",
  projectId: "bgk-attendance-new",
  storageBucket: "bgk-attendance-new.firebasestorage.app",
  messagingSenderId: "451468104438",
  appId: "1:451468104438:web:961a8b4488a8fa548152d7"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { app, db };
