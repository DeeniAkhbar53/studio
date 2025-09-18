
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
  where,
} from 'firebase/firestore';
import type { SystemLog } from '@/types';

const logsCollectionRef = collection(db, 'login_logs');

// This function is for server-side use only now, called from a Cloud Function.
export const addLoginLog = async (
  message: string,
  context?: any
): Promise<string> => {
  try {
    const logEntry = {
      level: 'info' as const, // Login events are always info level
      message,
      context: context ? JSON.stringify(context, null, 2) : "No context provided.",
      timestamp: serverTimestamp(),
    };

    const docRef = await addDoc(logsCollectionRef, logEntry);
    return docRef.id;
  } catch (error) {
    console.error("CRITICAL: Failed to write to login_logs collection.", error);
    throw error;
  }
};

export const getLoginLogs = (
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
    console.error("Error fetching real-time login logs:", error);
    onError(error as Error);
  });

  return unsubscribe;
};

export const getLoginLogsForUser = async (userItsId: string): Promise<SystemLog[]> => {
    try {
        const q = query(
            logsCollectionRef,
            where('userItsId', '==', userItsId),
            orderBy('timestamp', 'desc')
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(docSnapshot => {
            const data = docSnapshot.data();
            const timestamp = data.timestamp instanceof Timestamp
                              ? data.timestamp.toDate().toISOString()
                              : new Date().toISOString();
            return { ...data, id: docSnapshot.id, timestamp } as SystemLog;
        });
    } catch (error) {
        console.error(`Error fetching login logs for user ${userItsId}:`, error);
        if (error instanceof Error && error.message.includes("index")) {
            console.error(`This operation requires a Firestore index. Please create an index for the 'login_logs' collection with 'userItsId' (ascending) and 'timestamp' (descending).`);
        }
        throw error;
    }
};


export const clearLoginLogs = async (): Promise<void> => {
    try {
        const querySnapshot = await getDocs(logsCollectionRef);
        const batch = writeBatch(db);
        querySnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
    } catch (error) {
        console.error("Error clearing login logs: ", error);
        throw error;
    }
};
