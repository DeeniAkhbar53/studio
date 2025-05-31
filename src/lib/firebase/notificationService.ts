
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

    // --- Sending Push Notifications via Firebase Console ---
    // This Next.js frontend function saves the notification to Firestore.
    // To send push notifications to user devices via Firebase Cloud Messaging (FCM),
    // you will now manually compose and send messages using the Firebase Console's
    // "Engagement" -> "Messaging" (or "Cloud Messaging") section.
    //
    // When composing a message in the Firebase Console:
    // 1. **Targeting**: You can target user segments, specific topics (if you implement topic subscriptions),
    //    or individual FCM tokens (though this is less common for broad announcements).
    //    Since user FCM tokens are stored in `mohallahs/{mohallahId}/members/{userId}/fcmTokens`,
    //    you might need to export these tokens for targeted campaigns if the console's segmentation
    //    doesn't directly meet your needs for audience selection based on the `targetAudience`
    //    field of this Firestore notification document.
    //
    // 2. **Notification Content**:
    //    - **Title**: Use the `title` from this Firestore document (e.g., notificationData.title).
    //    - **Body (Text)**: Use the `content` from this Firestore document (e.g., notificationData.content).
    //    - **Image URL (Optional)**: You can add an image URL.
    //    - **Notification Name (Optional)**: For your reference in the console.
    //
    // 3. **Custom Data (Optional but Recommended)**:
    //    In the "Additional options" -> "Custom data" section of the FCM console composer,
    //    you can add key-value pairs. This is useful for in-app navigation when a
    //    notification is clicked. For example:
    //    - Key: `url`, Value: `/dashboard/notifications`
    //    - Key: `notificationId`, Value: `docRef.id` (the ID of this Firestore document)
    //    This data will be available in your `public/firebase-messaging-sw.js` and
    //    your foreground message handler in `src/app/dashboard/layout.tsx`.
    //
    // 4. **Scheduling**: Send immediately or schedule for later.
    //
    // The `public/firebase-messaging-sw.js` file in your Next.js app handles displaying
    // system notifications if the app is in the background or closed. The foreground
    // message handler in `src/app/dashboard/layout.tsx` handles messages when the app is open.
    // --- End Manual Sending Guide ---

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

