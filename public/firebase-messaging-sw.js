// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

// IMPORTANT: Replace with your actual Firebase project configuration
// These values should be replaced with your actual Firebase config
// It's recommended to manage these via a build process or environment variables for service workers,
// but for simplicity in this setup, ensure they are hardcoded correctly.
const firebaseConfig = {
  apiKey: "YOUR_NEXT_PUBLIC_FIREBASE_API_KEY",
  authDomain: "YOUR_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  projectId: "YOUR_NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  storageBucket: "YOUR_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "YOUR_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "YOUR_NEXT_PUBLIC_FIREBASE_APP_ID"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
} else {
  firebase.app(); // if already initialized, use that one
}

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  // Determine notification content:
  // Prioritize payload.notification, then fallback to payload.data, then to generic defaults.
  const notificationTitle = payload.notification?.title || payload.data?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have a new message.',
    icon: payload.notification?.icon || payload.data?.icon || '/logo.png', // Ensure you have a logo.png in your public folder
    data: payload.data // Pass along any data for click actions
  };

  // Optional: Add click action to open a specific URL when notification is clicked
  // This example assumes your payload.data might contain a 'url' field.
  // self.addEventListener('notificationclick', function(event) {
  //   event.notification.close(); // Close the notification
  //   const openUrl = event.notification.data?.url || '/';
  //   event.waitUntil(
  //     clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
  //       // Check if there is already a window/tab open with the target URL
  //       for (var i = 0; i < windowClients.length; i++) {
  //         var client = windowClients[i];
  //         if (client.url === openUrl && 'focus' in client) {
  //           return client.focus();
  //         }
  //       }
  //       // If not, then open the target URL in a new window/tab.
  //       if (clients.openWindow) {
  //         return clients.openWindow(openUrl);
  //       }
  //     })
  //   );
  // });


  return self.registration.showNotification(notificationTitle, notificationOptions);
});
