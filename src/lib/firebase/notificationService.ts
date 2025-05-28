
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
    return docRef.id;
  } catch (error) {
    console.error("Error adding notification: ", error);
    throw error;
  }
};

export const getNotificationsForUser = async (currentUserItsId: string, currentUserRole: UserRole): Promise<NotificationItem[]> => {
  try {
    // Base query ordered by creation time
    let q = query(notificationsCollectionRef, orderBy('createdAt', 'desc'));
    
    // More complex audience filtering might require multiple queries or client-side filtering
    // For simplicity, this example fetches notifications targeted to 'all' or the specific user's role.
    // Firestore does not support 'OR' queries across different fields directly in this manner easily.
    // A common pattern is to fetch 'all' and then filter client-side, or have separate queries.
    // For now, let's fetch all and filter on client-side in the components, or adjust query strategy later.
    // This query will fetch all notifications and then they must be filtered in the component.
    // Or use a more specific query if possible.

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

      // Client-side filtering for target audience
      if (notification.targetAudience === 'all' || notification.targetAudience === currentUserRole) {
        notifications.push(notification);
      }
    });
    return notifications;
  } catch (error) {
    console.error("Error fetching notifications: ", error);
    throw error;
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
    // Don't throw, as this might be a background task. Log and continue.
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
