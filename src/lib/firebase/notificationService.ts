
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
  or,
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
      readBy: [],
    });

    // --- BACKEND ACTION REQUIRED for OS-Level Push Notifications via FCM ---
    // This Next.js app only saves the notification to Firestore.
    // A separate backend process (e.g., a Firebase Cloud Function) is needed to
    // actually send push notifications to user devices via Firebase Cloud Messaging (FCM).
    //
    // That backend Cloud Function would typically:
    // 1. **Trigger**: Listen for new documents created in the `notifications` Firestore collection
    //    (e.g., using `functions.firestore.document('notifications/{notificationId}').onCreate()`).
    // 2. **Read Data**: Get the `title`, `content`, and `targetAudience` from the new notification document.
    // 3. **Query Users**:
    //    - Based on `targetAudience` (e.g., 'admin', 'user', 'all'), query your user data
    //      (e.g., in `mohallahs/{mohallahId}/members`). You might need a collectionGroup query on 'members'.
    //    - For each targeted user, retrieve their stored FCM registration tokens from the `fcmTokens`
    //      array in their user document.
    // 4. **Collect Tokens**: Aggregate all unique FCM tokens from the targeted users.
    // 5. **Construct FCM Message**: Create an FCM message payload using the Firebase Admin SDK.
    //    Crucially, to trigger a display notification via the service worker when the app is
    //    in the background/closed, this payload should include a `notification` object.
    //    Example payload for the Admin SDK's `sendToDevice` or `sendMulticast` methods:
    //    const message = {
    //      tokens: uniqueFcmTokensArray, // Array of FCM tokens
    //      notification: {
    //        title: notificationData.title,
    //        body: notificationData.content,
    //        // Optional: icon: '/images/logo.png' // Path relative to your deployed site's root
    //      },
    //      data: { // Optional: any custom data you want to send
    //        // e.g., url: '/dashboard/notifications'
    //      }
    //    };
    // 6. **Send via Admin SDK**: Use the Firebase Admin SDK's messaging methods
    //    (e.g., `admin.messaging().sendMulticast(message)`) to send the push notification.
    // 7. **Handle Responses/Errors**: Check `response.failureCount` for errors and log them.
    //
    // Ensure your Cloud Function has the necessary permissions and the Firebase Admin SDK is initialized.
    // The `public/firebase-messaging-sw.js` file in your Next.js app will handle displaying
    // this system notification if the app is in the background or closed.
    // The `src/app/dashboard/layout.tsx` handles foreground messages.
    // --- END BACKEND ACTION REQUIRED ---

    return docRef.id;
  } catch (error) {
    console.error("Error adding notification: ", error);
    throw error;
  }
};


// Fetches notifications targeted to 'all' OR the specific user's role.
export const getNotificationsForUser = async (currentUserItsId: string, currentUserRole: UserRole): Promise<NotificationItem[]> => {
  console.log(`[notificationService] getNotificationsForUser called with ITS: ${currentUserItsId}, Role: ${currentUserRole}`);
  try {
    const notificationsForAllQuery = query(
        notificationsCollectionRef,
        where('targetAudience', '==', 'all'),
        orderBy('createdAt', 'desc'),
        limit(50)
    );

    const notificationsForRoleQuery = query(
        notificationsCollectionRef,
        where('targetAudience', '==', currentUserRole),
        orderBy('createdAt', 'desc'),
        limit(50)
    );

    const [allSnapshot, roleSnapshot] = await Promise.all([
      getDocs(notificationsForAllQuery),
      (currentUserRole !== 'all' ? getDocs(notificationsForRoleQuery) : Promise.resolve({ docs: [] as any[] }))
    ]);

    const notificationsMap = new Map<string, NotificationItem>();

    const processSnapshot = (snapshot: any) => {
      snapshot.docs.forEach((docSnapshot: any) => {
        if (notificationsMap.has(docSnapshot.id)) return;

        const data = docSnapshot.data();
        const createdAt = data.createdAt instanceof Timestamp
                          ? data.createdAt.toDate().toISOString()
                          : typeof data.createdAt === 'string'
                            ? data.createdAt
                            : new Date().toISOString();

        const notification: NotificationItem = {
          id: docSnapshot.id,
          title: data.title,
          content: data.content,
          createdAt: createdAt,
          targetAudience: data.targetAudience as 'all' | UserRole,
          createdBy: data.createdBy,
          readBy: Array.isArray(data.readBy) ? data.readBy : [],
        };
        notificationsMap.set(docSnapshot.id, notification);
      });
    };

    processSnapshot(allSnapshot);
    processSnapshot(roleSnapshot);

    const combinedNotifications = Array.from(notificationsMap.values());
    combinedNotifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    console.log(`[notificationService] Fetched ${combinedNotifications.length} notifications after combining and sorting for ITS: ${currentUserItsId}.`);
    return combinedNotifications;

  } catch (error) {
    console.error("[notificationService] Error fetching notifications for user: ", error);
    if (error instanceof Error && error.message.includes("index")) {
        console.error("[notificationService] This operation likely requires Firestore indexes. Please check your Firebase console. You might need separate indexes for ('targetAudience' ASC, 'createdAt' DESC) on the 'notifications' collection.");
    }
    return [];
  }
};


export const markNotificationAsRead = async (notificationId: string, userItsId: string): Promise<void> => {
  try {
    const notificationDocRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationDocRef, {
      readBy: arrayUnion(userItsId),
    });
  } catch (error) {
    console.error(`Error marking notification ${notificationId} as read for user ${userItsId}: `, error);
    // Not re-throwing, as this is a non-critical operation for the user experience
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
