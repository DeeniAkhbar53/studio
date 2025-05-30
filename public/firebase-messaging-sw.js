
// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyB6sOs0IdR8ov6R3szYmrCbdP2APnRBl5M",
  authDomain: "bgk-attendance-new.firebaseapp.com",
  projectId: "bgk-attendance-new",
  storageBucket: "bgk-attendance-new.firebasestorage.app",
  messagingSenderId: "451468104438",
  appId: "1:451468104438:web:961a8b4488a8fa548152d7"
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
