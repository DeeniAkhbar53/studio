
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
  or, // Keep 'or' if you plan to revert to the single OR query after indexing
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
    // This Next.js app only saves the notification to Firestore.
    // A separate backend process (e.g., a Firebase Cloud Function) is needed to
    // actually send push notifications to user devices via Firebase Cloud Messaging (FCM).
    //
    // That backend Cloud Function would typically:
    // 1. **Trigger**: Listen for new documents created in the `notifications` Firestore collection.
    //    (e.g., using `functions.firestore.document('notifications/{notificationId}').onCreate()`)
    // 2. **Read Data**: Get the `title`, `content`, and `targetAudience` from the new notification document.
    //    (e.g., `const notification = snap.data();`)
    // 3. **Query Users**:
    //    - Based on `targetAudience` (e.g., 'admin', 'user', 'all'), query your user data
    //      (e.g., in `mohallahs/{mohallahId}/members`).
    //      You might need a collectionGroup query on 'members' if `targetAudience` is 'all' or a general role.
    //      Example query for a specific role:
    //      `admin.firestore().collectionGroup('members').where('role', '==', notification.targetAudience).get();`
    //      Example query for 'all':
    //      `admin.firestore().collectionGroup('members').get();`
    //    - For each targeted user, retrieve their stored FCM registration tokens from the `fcmTokens`
    //      array in their user document.
    // 4. **Collect Tokens**: Aggregate all unique FCM tokens from the targeted users.
    // 5. **Construct FCM Message**: Create an FCM message payload.
    //    Example:
    //    const message = {
    //      notification: {
    //        title: notification.title,
    //        body: notification.content,
    //      },
    //      tokens: uniqueFcmTokensArray, // Array of FCM tokens
    //    };
    // 6. **Send via Admin SDK**: Use the Firebase Admin SDK's `messaging().sendMulticast(message)`
    //    method to send the push notification to the collected FCM tokens.
    //    (e.g., `const response = await admin.messaging().sendMulticast(message);`)
    // 7. **Handle Responses/Errors**: Check `response.failureCount` for errors and log them.
    //
    // Ensure your Cloud Function has the necessary permissions and the Firebase Admin SDK is initialized.
    // --- END BACKEND ACTION REQUIRED ---

    return docRef.id;
  } catch (error) {
    console.error("Error adding notification: ", error);
    throw error;
  }
};


// Modified to fetch 'all' and specific role notifications separately and merge,
// as Firestore 'OR' queries with 'orderBy' can be complex with indexing.
// The most robust solution for 'OR' queries often involves creating composite indexes
// for each branch of the OR condition if possible, or handling the merge client-side.
export const getNotificationsForUser = async (currentUserItsId: string, currentUserRole: UserRole): Promise<NotificationItem[]> => {
  console.log(`[notificationService] getNotificationsForUser called with ITS: ${currentUserItsId}, Role: ${currentUserRole}`);
  try {
    const notificationsForAllQuery = query(
        notificationsCollectionRef,
        where('targetAudience', '==', 'all'),
        orderBy('createdAt', 'desc'),
        limit(50) // Limit to prevent fetching too many historical 'all' notifications
    );

    const notificationsForRoleQuery = query(
        notificationsCollectionRef,
        where('targetAudience', '==', currentUserRole),
        orderBy('createdAt', 'desc'),
        limit(50) // Limit for role-specific notifications
    );

    // Execute queries
    const [allSnapshot, roleSnapshot] = await Promise.all([
      getDocs(notificationsForAllQuery),
      (currentUserRole !== 'all' ? getDocs(notificationsForRoleQuery) : Promise.resolve({ docs: [] as any[] })) // Avoid querying for role 'all' again if it's the current role
    ]);

    const notificationsMap = new Map<string, NotificationItem>();

    const processSnapshot = (snapshot: any) => {
      snapshot.docs.forEach((docSnapshot: any) => {
        if (notificationsMap.has(docSnapshot.id)) return; // Avoid duplicates if a notification matches both queries

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

    // Sort combined results by createdAt descending
    combinedNotifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    console.log(`[notificationService] Fetched ${combinedNotifications.length} notifications after combining and sorting.`);
    return combinedNotifications;

  } catch (error) {
    console.error("[notificationService] Error fetching notifications for user: ", error);
    if (error instanceof Error && error.message.includes("index")) {
        console.error("[notificationService] This operation likely requires Firestore indexes. Please check your Firebase console. You might need separate indexes for ('targetAudience' == 'all', 'createdAt' DESC) and ('targetAudience' == 'yourRole', 'createdAt' DESC).");
    }
    // For safety, return empty array on error to prevent UI crashes
    return []; 
  }
};


export const markNotificationAsRead = async (notificationId: string, userItsId: string): Promise<void> => {
  try {
    const notificationDocRef = doc(db, 'notifications', notificationId);
    // Add the user's ITS ID to the readBy array.
    // arrayUnion ensures the ID is only added if it's not already present.
    await updateDoc(notificationDocRef, {
      readBy: arrayUnion(userItsId),
    });
  } catch (error) {
    console.error(`Error marking notification ${notificationId} as read for user ${userItsId}: `, error);
    // Decide if you want to throw or handle silently. Throwing might be better for debugging.
    // throw error; 
  }
};

export const deleteNotification = async (notificationId: string): Promise<void> => {
  try {
    const notificationDocRef = doc(db, 'notifications', notificationId);
    await deleteDoc(notificationDocRef);
  } catch (error) { // Added missing opening brace here
    console.error(`Error deleting notification ${notificationId}: `, error);
    throw error;
  }
};

