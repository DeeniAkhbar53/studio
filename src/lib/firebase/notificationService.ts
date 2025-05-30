
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

    // --- BACKEND ACTION REQUIRED ---
    // The notification is saved to Firestore. A backend process
    // (e.g., a Firebase Cloud Function triggered by new documents in 'notifications')
    // is needed to send actual push notifications via OneSignal.
    //
    // This backend function would:
    // 1. Trigger when this `addNotification` function creates a new document in the `notifications` Firestore collection.
    // 2. Read the new notification document (title, content, targetAudience).
    // 3. Based on `targetAudience`:
    //    - Query your Firestore database (e.g., `mohallahs/{mohallahId}/members`) for users matching the role.
    //    - For each targeted user, retrieve their `oneSignalPlayerIds` array.
    // 4. Collect all unique Player IDs from the targeted users.
    // 5. Use the OneSignal Server REST API (with your OneSignal App ID and REST API Key):
    //    - Send a notification using the `include_player_ids` parameter, providing the array of collected Player IDs.
    //    - Set the notification `headings` (title) and `contents` (message body) from `notificationData`.
    //
    // Example OneSignal API call structure (conceptual, for your Cloud Function):
    //
    //   const oneSignalAppId = "YOUR_ONESIGNAL_APP_ID"; // Store securely in Cloud Function config
    //   const oneSignalRestApiKey = "YOUR_ONESIGNAL_REST_API_KEY"; // Store securely
    //
    //   const message = {
    //     app_id: oneSignalAppId,
    //     headings: { en: notificationData.title },
    //     contents: { en: notificationData.content },
    //     include_player_ids: ["array_of_player_ids_from_firestore_for_target_audience"],
    //     // You can also use segments defined in OneSignal if you prefer:
    //     // included_segments: ["Subscribed Users"], // For all
    //     // or specific segments: included_segments: ["AdminsSegment"],
    //   };
    //
    //   const response = await fetch('https://onesignal.com/api/v1/notifications', {
    //     method: 'POST',
    //     headers: {
    //       'Content-Type': 'application/json; charset=utf-8',
    //       'Authorization': `Basic ${oneSignalRestApiKey}`
    //     },
    //     body: JSON.stringify(message)
    //   });
    //   const responseData = await response.json();
    //   console.log("OneSignal API Response:", responseData);
    //
    // This ensures that users who have granted permission and have their Player ID stored
    // will receive the notification on their device, even if the app is not currently open.
    // --- END BACKEND ACTION REQUIRED ---

    return docRef.id;
  } catch (error) {
    console.error("Error adding notification: ", error);
    throw error;
  }
};

export const getNotificationsForUser = async (currentUserItsId: string, currentUserRole: UserRole): Promise<NotificationItem[]> => {
  try {
    // Base query ordered by creation date
    let baseQuery = query(notificationsCollectionRef, orderBy('createdAt', 'desc'));
    
    // Add filtering based on targetAudience
    // This requires composite indexes if you combine `where` with `orderBy` on a different field,
    // or if you use multiple `where` clauses on different fields.
    // Firestore often guides you to create these indexes via console error messages.
    // For now, let's fetch potentially more and filter client-side if complex,
    // or rely on simple 'all' vs specific role.
    const q = query(
        notificationsCollectionRef,
        or(
            where('targetAudience', '==', 'all'),
            where('targetAudience', '==', currentUserRole)
        ),
        orderBy('createdAt', 'desc'),
        limit(50) // Limit to a reasonable number for the header/notification page
    );
    
    const querySnapshot = await getDocs(q);
    const notifications: NotificationItem[] = [];

    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      // Ensure createdAt is handled correctly whether it's a Timestamp or already a string
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
      notifications.push(notification);
    });
    return notifications;
  } catch (error) {
    console.error("Error fetching notifications for user: ", error);
    if (error instanceof Error && error.message.includes("index")) {
        console.error("This operation likely requires a Firestore index. Please check your Firebase console for specific index creation links if this error persists, especially for queries involving 'targetAudience' and 'createdAt'.");
    }
    return []; // Return empty array on error to prevent app crashes
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
    // Do not re-throw, allow the app to continue
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
