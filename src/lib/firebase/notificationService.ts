
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

    // --- BACKEND ACTION REQUIRED for FCM Push Notifications ---
    // The notification is saved to Firestore. A backend process
    // (e.g., a Firebase Cloud Function triggered by new documents in 'notifications')
    // is needed to send actual push notifications via Firebase Cloud Messaging (FCM).
    //
    // This backend function would:
    // 1. Trigger when this `addNotification` function creates a new document in the `notifications` Firestore collection.
    // 2. Read the new notification document (title, content, targetAudience).
    // 3. Based on `targetAudience`:
    //    - Query your Firestore database (e.g., `mohallahs/{mohallahId}/members`) for users matching the role.
    //    - For each targeted user, retrieve their `fcmTokens` array (which contains FCM registration tokens).
    // 4. Collect all unique, valid FCM tokens from the targeted users.
    // 5. Use the Firebase Admin SDK (in your Cloud Function) to send a push notification message:
    //    - Construct a message payload with `title` and `body` from `notificationData`.
    //    - Use `admin.messaging().sendToDevice(tokens, payload)` or `sendMulticast` for multiple tokens.
    //
    // Example (Conceptual Cloud Function Logic):
    //
    //   import * as functions from 'firebase-functions';
    //   import * as admin from 'firebase-admin';
    //   admin.initializeApp();
    //
    //   export const sendPushOnNewNotification = functions.firestore
    //     .document('notifications/{notificationId}')
    //     .onCreate(async (snap, context) => {
    //       const notification = snap.data() as NotificationItem; // Type assertion
    //       if (!notification) {
    //         console.log('No notification data found');
    //         return null;
    //       }
    //
    //       const { title, content, targetAudience } = notification;
    //       let targetUsersQuery = admin.firestore().collectionGroup('members');
    //
    //       if (targetAudience !== 'all') {
    //         targetUsersQuery = targetUsersQuery.where('role', '==', targetAudience);
    //       }
    //
    //       try {
    //         const usersSnapshot = await targetUsersQuery.get();
    //         if (usersSnapshot.empty) {
    //           console.log('No users found for target audience:', targetAudience);
    //           return null;
    //         }
    //
    //         const tokens: string[] = [];
    //         usersSnapshot.forEach(doc => {
    //           const userData = doc.data();
    //           if (userData && userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
    //             tokens.push(...userData.fcmTokens);
    //           }
    //         });
    //
    //         if (tokens.length === 0) {
    //           console.log('No FCM tokens found for the target users.');
    //           return null;
    //         }
    //
    //         const uniqueTokens = [...new Set(tokens)]; // Remove duplicate tokens
    //
    //         const messagePayload = {
    //           notification: {
    //             title: title,
    //             body: content,
    //           },
    //           // You can add a 'data' payload too for custom handling in your app
    //           // data: { click_action: 'FLUTTER_NOTIFICATION_CLICK', screen: '/notifications' } // Example
    //         };
    //
    //         console.log(`Sending push notification to ${uniqueTokens.length} tokens.`);
    //         const response = await admin.messaging().sendToDevice(uniqueTokens, messagePayload);
    //         console.log('Successfully sent message:', response);
    //         // You might want to handle results for individual tokens if some fail
    //         response.results.forEach((result, index) => {
    //            const error = result.error;
    //            if (error) {
    //              console.error('Failure sending notification to', uniqueTokens[index], error);
    //              // Potentially clean up invalid tokens from user docs here
    //            }
    //         });
    //
    //       } catch (error) {
    //         console.error('Error sending push notifications:', error);
    //       }
    //       return null;
    //     });
    //
    // This Cloud Function ensures that users who have granted permission and have their FCM token stored
    // will receive the notification on their device, even if the app is not currently open.
    // --- END BACKEND ACTION REQUIRED for FCM ---

    return docRef.id;
  } catch (error) {
    console.error("Error adding notification: ", error);
    throw error;
  }
};

export const getNotificationsForUser = async (currentUserItsId: string, currentUserRole: UserRole): Promise<NotificationItem[]> => {
  try {
    const q = query(
        notificationsCollectionRef,
        or(
            where('targetAudience', '==', 'all'),
            where('targetAudience', '==', currentUserRole)
        ),
        orderBy('createdAt', 'desc'),
        limit(50) 
    );
    
    const querySnapshot = await getDocs(q);
    const notifications: NotificationItem[] = [];

    querySnapshot.forEach((docSnapshot) => {
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
      notifications.push(notification);
    });
    return notifications;
  } catch (error) {
    console.error("Error fetching notifications for user: ", error);
    if (error instanceof Error && error.message.includes("index")) {
        console.error("This operation likely requires a Firestore index. Please check your Firebase console for specific index creation links if this error persists, especially for queries involving 'targetAudience' and 'createdAt'.");
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
