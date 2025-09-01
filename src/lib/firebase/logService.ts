
import { db } from './firebase';
import {
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  Unsubscribe,
  writeBatch,
} from 'firebase/firestore';
import type { SystemLog } from '@/types';

const logsCollectionRef = collection(db, 'system_logs');

// This function is not exported as it's intended for server-side use (e.g., Cloud Functions)
// or specific, intentional client-side logging.
export const addSystemLog = async (
  level: 'info' | 'warning' | 'error',
  message: string,
  context?: any
): Promise<string> => {
  try {
    const logEntry: Omit<SystemLog, 'id' | 'timestamp'> = {
      level,
      message,
      context: context ? JSON.stringify(context, null, 2) : "No context provided.",
      timestamp: new Date().toISOString(), // Pre-fill for immediate use, server will overwrite
    };

    const docRef = await addDoc(logsCollectionRef, {
      ...logEntry,
      timestamp: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("CRITICAL: Failed to write to system_logs collection.", error);
    // In a real app, you might have a fallback logging mechanism here.
    throw error;
  }
};

export const getSystemLogs = (
  onUpdate: (logs: SystemLog[]) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  const q = query(logsCollectionRef, orderBy('timestamp', 'desc'));

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const logs = querySnapshot.docs.map(docSnapshot => {
      const data = docSnapshot.data();
      const timestamp = data.timestamp instanceof Timestamp
                        ? data.timestamp.toDate().toISOString()
                        : new Date().toISOString();
      return { ...data, id: docSnapshot.id, timestamp } as SystemLog;
    });
    onUpdate(logs);
  }, (error) => {
    console.error("Error fetching real-time system logs:", error);
    onError(error as Error);
  });

  return unsubscribe;
};

export const clearSystemLogs = async (): Promise<void> => {
    try {
        const querySnapshot = await getDocs(logsCollectionRef);
        const batch = writeBatch(db);
        querySnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
    } catch (error) {
        console.error("Error clearing system logs: ", error);
        throw error;
    }
};
