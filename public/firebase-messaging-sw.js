
// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in the messagingSenderId.
// IMPORTANT: Replace with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "YOUR_NEXT_PUBLIC_FIREBASE_API_KEY", // Replace with your actual value
  authDomain: "YOUR_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", // Replace with your actual value
  projectId: "YOUR_NEXT_PUBLIC_FIREBASE_PROJECT_ID", // Replace with your actual value
  storageBucket: "YOUR_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", // Replace with your actual value
  messagingSenderId: "YOUR_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", // Replace with your actual value
  appId: "YOUR_NEXT_PUBLIC_FIREBASE_APP_ID" // Replace with your actual value
};

firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  // Customize notification here
  const notificationTitle = payload.notification?.title || 'New Message';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new message.',
    icon: payload.notification?.icon || '/images/logo.png', // Use your app's logo, ensure it's in public/images
    // data: payload.data // You can pass custom data to handle clicks
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
