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
    // The notification is saved to Firestore. Now, a backend process
    // (e.g., a Firebase Cloud Function triggered by new documents in 'notifications')
    // is needed to send actual push notifications via OneSignal.
    //
    // This backend function would:
    // 1. Read the new notification document (title, content, targetAudience).
    // 2. Based on `targetAudience`:
    //    - Query the 'members' subcollections under 'mohallahs' for users matching the role.
    //    - (If storing Player IDs): Retrieve the `oneSignalPlayerIds` for each targeted user.
    // 3. Use the OneSignal Server REST API (with your OneSignal App ID and REST API Key) to:
    //    - Send a notification to all subscribed users (if not storing/using Player IDs for targeting).
    //    - OR, send notifications to specific Player IDs.
    //    - OR, send to segments you've defined in your OneSignal dashboard.
    // Example OneSignal API call structure (conceptual):
    //   fetch('https://onesignal.com/api/v1/notifications', {
    //     method: 'POST',
    //     headers: {
    //       'Content-Type': 'application/json; charset=utf-8',
    //       'Authorization': 'Basic YOUR_ONESIGNAL_REST_API_KEY'
    //     },
    //     body: JSON.stringify({
    //       app_id: "YOUR_ONESIGNAL_APP_ID",
    //       headings: { en: notificationData.title },
    //       contents: { en: notificationData.content },
    //       // included_segments: ["Subscribed Users"], // For all
    //       // OR
    //       // include_player_ids: ["array_of_player_ids_from_firestore"], // For specific users
    //       // OR filter by tags if you set tags on users via OneSignal SDK
    //     })
    //   });
    // --- END BACKEND ACTION REQUIRED ---

    return docRef.id;
  } catch (error) {
    console.error("Error adding notification: ", error);
    throw error;
  }
};

export const getNotificationsForUser = async (currentUserItsId: string, currentUserRole: UserRole): Promise<NotificationItem[]> => {
  try {
    let q = query(notificationsCollectionRef, orderBy('createdAt', 'desc'));
    
    const querySnapshot = await getDocs(q);
    const notifications: NotificationItem[] = [];

    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString();
      
      const notification: NotificationItem = {
        id: docSnapshot.id,
        title: data.title,
        content: data.content,
        createdAt: createdAt,
        targetAudience: data.targetAudience,
        createdBy: data.createdBy,
        readBy: Array.isArray(data.readBy) ? data.readBy : [],
      };

      if (notification.targetAudience === 'all' || notification.targetAudience === currentUserRole) {
        notifications.push(notification);
      }
    });
    return notifications;
  } catch (error) {
    console.error("Error fetching notifications: ", error);
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