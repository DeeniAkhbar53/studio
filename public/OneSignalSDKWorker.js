// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in the messagingSenderId
// IMPORTANT: Replace with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "YOUR_NEXT_PUBLIC_FIREBASE_API_KEY",
  authDomain: "YOUR_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  projectId: "YOUR_NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  storageBucket: "YOUR_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "YOUR_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "YOUR_NEXT_PUBLIC_FIREBASE_APP_ID"
};

firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so that it can handle background messages
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new message.',
    icon: payload.notification?.icon || '/images/logo.png' // Optional: Add a default icon
    // You can add more options like 'image', 'actions', etc.
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});