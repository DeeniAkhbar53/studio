
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

      // Client-side filtering for target audience
      if (notification.targetAudience === 'all' || notification.targetAudience === currentUserRole) {
        notifications.push(notification);
      }
    });
    return notifications;
  } catch (error) {
    console.error("Error fetching notifications: ", error);
    // Return empty array on error to prevent crashing upstream components
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
