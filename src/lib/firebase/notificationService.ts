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
import { addAuditLog } from './auditLogService';


const notificationsCollectionRef = collection(db, 'notifications');

export type NotificationDataForAdd = Omit<NotificationItem, 'id' | 'createdAt' | 'readBy'>;

export const addNotification = async (notificationData: NotificationDataForAdd): Promise<string> => {
  try {
    // The Cloud Function 'onNewNotificationCreated' will be triggered by this action.
    // It will handle sending the push notifications.
    const docRef = await addDoc(notificationsCollectionRef, {
      ...notificationData,
      createdAt: serverTimestamp(),
      readBy: [], // Initialize readBy as an empty array
    });
    
    const actorName = typeof window !== 'undefined' ? localStorage.getItem('userName') || 'Unknown' : 'System';
    const actorItsId = typeof window !== 'undefined' ? localStorage.getItem('userItsId') || 'Unknown' : 'System';
    await addAuditLog('notification_created', { itsId: actorItsId, name: actorName }, 'info', { title: notificationData.title, audience: notificationData.targetAudience });

    return docRef.id;
  } catch (error) {
    
    throw error;
  }
};


// Fetches notifications targeted to 'all' OR the specific user's role.
export const getNotificationsForUser = async (currentUserItsId: string, currentUserRole: UserRole): Promise<NotificationItem[]> => {
  
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
    
    
    return combinedNotifications;

  } catch (error) {
    
    if (error instanceof Error && error.message.includes("index")) {
        
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
    
    // Not re-throwing, as this is a non-critical operation for the user experience if it fails once
  }
};

export const deleteNotification = async (notificationId: string): Promise<void> => {
  try {
    const notificationDocRef = doc(db, 'notifications', notificationId);
    const docToDelete = await getDoc(notificationDocRef);
    const title = docToDelete.data()?.title || 'Unknown';

    await deleteDoc(notificationDocRef);
    
    const actorName = typeof window !== 'undefined' ? localStorage.getItem('userName') || 'Unknown' : 'System';
    const actorItsId = typeof window !== 'undefined' ? localStorage.getItem('userItsId') || 'Unknown' : 'System';
    await addAuditLog('notification_deleted', { itsId: actorItsId, name: actorName }, 'warning', { notificationId, title });

  } catch (error) {
    
    throw error;
  }
};
