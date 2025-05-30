
'use server';

import { db } from './firebase';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  Timestamp,
  arrayUnion,
  where,
  limit
} from 'firebase/firestore';
import type { NotificationItem, UserRole } from '@/types';

const notificationsCollectionRef = collection(db, 'notifications');

export type NotificationDataForAdd = Omit<NotificationItem, 'id' | 'createdAt' | 'readBy'>;

export const addNotification = async (notificationData: NotificationDataForAdd): Promise<string> => {
  try {
    const docRef = await addDoc(notificationsCollectionRef, {
      ...notificationData,
      createdAt: serverTimestamp(),
      readBy: [], // Initialize readBy as an empty array
    });

    // --- CRITICAL: BACKEND ACTION REQUIRED for OS-Level Push Notifications via FCM ---
    // This Next.js frontend function only saves the notification to Firestore.
    // To actually send push notifications to user devices via Firebase Cloud Messaging (FCM),
    // a separate backend process (typically a Firebase Cloud Function) is ESSENTIAL.
    //
    // That backend Cloud Function would:
    // 1. **Trigger**: Be configured to trigger whenever a new document is created in this
    //    `notifications` Firestore collection.
    //    (e.g., using `functions.firestore.document('notifications/{notificationId}').onCreate()`).
    //
    // 2. **Read Notification Data**: Get the `title`, `content`, and `targetAudience`
    //    from the newly created notification document in Firestore.
    //
    // 3. **Query Target Users & Fetch FCM Tokens**:
    //    - Based on `targetAudience` (e.g., 'admin', 'user', 'all'), query your user data
    //      (e.g., in `mohallahs/{mohallahId}/members` using collection group queries if needed).
    //    - For each targeted user, retrieve their stored FCM registration tokens from the
    //      `fcmTokens` array in their user document.
    //
    // 4. **Collect Unique FCM Tokens**: Aggregate all unique FCM tokens from the targeted users.
    //
    // 5. **Construct FCM Message (using Firebase Admin SDK)**:
    //    Create an FCM message payload. To trigger a display notification via the
    //    service worker (`public/firebase-messaging-sw.js`) when the app is
    //    in the background/closed, this payload MUST include a `notification` object.
    //    Example payload for the Admin SDK's `sendToDevice` or `sendMulticast` methods:
    //    ```javascript
    //    // const admin = require('firebase-admin'); // In your Cloud Function
    //    const message = {
    //      tokens: uniqueFcmTokensArray, // Array of FCM tokens
    //      notification: {
    //        title: notificationData.title, // From the Firestore document
    //        body: notificationData.content,  // From the Firestore document
    //        icon: '/logo.png', // Optional: Path to an icon in your /public folder
    //      },
    //      data: { // Optional: any custom data you want to send for in-app handling
    //        url: '/dashboard/notifications', // e.g., to open a specific page on click
    //        notificationId: docRef.id,
    //      }
    //    };
    //    ```
    //
    // 6. **Send via Firebase Admin SDK**: Use the Firebase Admin SDK's messaging methods
    //    (e.g., `admin.messaging().sendEachForMulticast(message)` or `admin.messaging().sendToDevice(...)`)
    //    to send the push notification.
    //
    // 7. **Handle Responses/Errors**: Check the response from the Admin SDK for errors
    //    (e.g., invalid tokens) and handle them appropriately (e.g., logging, cleaning up invalid tokens).
    //
    // Ensure your Cloud Function has the necessary permissions and the Firebase Admin SDK is initialized.
    // The `public/firebase-messaging-sw.js` file in your Next.js app will handle displaying
    // this system notification if the app is in the background or closed.
    // The `src/app/dashboard/layout.tsx` handles foreground messages.
    // --- END BACKEND ACTION REQUIRED ---

    return docRef.id;
  } catch (error) {
    console.error("Error adding notification to Firestore: ", error);
    throw error;
  }
};


// Fetches notifications targeted to 'all' OR the specific user's role.
export const getNotificationsForUser = async (currentUserItsId: string, currentUserRole: UserRole): Promise<NotificationItem[]> => {
  console.log(`[notificationService] getNotificationsForUser called with ITS: ${currentUserItsId}, Role: ${currentUserRole}`);
  try {
    // Query for 'all'
    const notificationsForAllQuery = query(
        notificationsCollectionRef,
        where('targetAudience', '==', 'all'),
        orderBy('createdAt', 'desc'),
        limit(50) // Limit results for performance
    );

    // Query for specific role (if not 'all' to avoid duplicate data if role is somehow 'all')
    let notificationsForRoleQuery = null;
    if (currentUserRole !== 'all') {
        notificationsForRoleQuery = query(
            notificationsCollectionRef,
            where('targetAudience', '==', currentUserRole),
            orderBy('createdAt', 'desc'),
            limit(50) // Limit results for performance
        );
    }

    const [allSnapshot, roleSnapshot] = await Promise.all([
      getDocs(notificationsForAllQuery),
      notificationsForRoleQuery ? getDocs(notificationsForRoleQuery) : Promise.resolve({ docs: [] as any[] })
    ]);

    const notificationsMap = new Map<string, NotificationItem>();

    const processSnapshot = (snapshot: any) => {
      snapshot.docs.forEach((docSnapshot: any) => {
        // Avoid adding duplicates if a notification somehow matched both queries
        if (notificationsMap.has(docSnapshot.id)) return;

        const data = docSnapshot.data();
        const createdAt = data.createdAt instanceof Timestamp
                          ? data.createdAt.toDate().toISOString()
                          : typeof data.createdAt === 'string'
                            ? data.createdAt
                            : new Date().toISOString(); // Fallback, should not happen

        const notification: NotificationItem = {
          id: docSnapshot.id,
          title: data.title,
          content: data.content,
          createdAt: createdAt,
          targetAudience: data.targetAudience as UserRole | 'all',
          createdBy: data.createdBy,
          readBy: Array.isArray(data.readBy) ? data.readBy : [],
        };
        notificationsMap.set(docSnapshot.id, notification);
      });
    };

    processSnapshot(allSnapshot);
    if (roleSnapshot) { // Check if roleSnapshot exists (it would be null if currentUserRole was 'all')
        processSnapshot(roleSnapshot);
    }

    const combinedNotifications = Array.from(notificationsMap.values());

    // Sort by createdAt date, most recent first, as merging might disturb order
    combinedNotifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    console.log(`[notificationService] Fetched ${combinedNotifications.length} notifications after combining and sorting for ITS: ${currentUserItsId}.`);
    return combinedNotifications;

  } catch (error) {
    console.error("[notificationService] Error fetching notifications for user: ", error);
    if (error instanceof Error && error.message.includes("index")) {
        console.error("[notificationService] This operation likely requires Firestore indexes. Please check your Firebase console. You might need an index for ('targetAudience' ASC, 'createdAt' DESC) on the 'notifications' collection.");
    }
    return []; // Return empty array on error to prevent app crash
  }
};


export const markNotificationAsRead = async (notificationId: string, userItsId: string): Promise<void> => {
  try {
    const notificationDocRef = doc(db, 'notifications', notificationId);
    // Atomically add the user's ITS ID to the 'readBy' array.
    // arrayUnion ensures the ID is only added if it's not already present.
    await updateDoc(notificationDocRef, {
      readBy: arrayUnion(userItsId),
    });
  } catch (error) {
    console.error(`Error marking notification ${notificationId} as read for user ${userItsId}: `, error);
    // Not re-throwing, as this is a non-critical operation for the user experience if it fails once
  }
};

export const deleteNotification = async (notificationId: string): Promise<void> => {
  try {
    const notificationDocRef = doc(db, 'notifications', notificationId);
    await deleteDoc(notificationDocRef);
  } catch (error) {
    console.error(`Error deleting notification ${notificationId}: `, error);
    throw error;
  }
};
