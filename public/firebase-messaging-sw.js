// DO NOT USE import STATEMENTS. This file is a service worker and runs in a different context.
// Use importScripts to load the Firebase SDKs.

// Firebase SDK scripts for service worker
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

// Your web app's Firebase configuration
// NOTE: These values must be hardcoded as service workers cannot access process.env
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};


// Initialize Firebase
try {
    firebase.initializeApp(firebaseConfig);
    console.log("SW: Firebase initialized successfully.");
} catch (e) {
    console.error("SW: Firebase initialization error.", e);
}


// Retrieve an instance of Firebase Messaging so that it can handle background messages.
let messaging;
try {
    messaging = firebase.messaging();
    console.log("SW: Firebase Messaging instance retrieved.");

    messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] Received background message ', payload);

        const notificationTitle = payload.notification.title;
        const notificationOptions = {
            body: payload.notification.body,
            icon: payload.notification.icon || '/logo.png', // Use icon from payload or default
            data: {
                url: payload.data.url || '/',
                notificationId: payload.data.notificationId
            }
        };

        self.registration.showNotification(notificationTitle, notificationOptions);
    });

} catch (e) {
    console.error("SW: Error getting messaging instance or setting up background handler.", e);
}


// Event listener for when a user clicks on the notification
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click Received.', event.notification.data);

  event.notification.close(); // Close the notification

  const urlToOpen = event.notification.data.url || '/';

  // This looks for an existing window and focuses it if it exists.
  // If no window is open, it opens a new one.
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      for (const client of clientList) {
        // Check if the client is already at the target URL
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If no matching client was found, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
