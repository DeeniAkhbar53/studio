
import type { MiqaatAttendanceEntryItem } from '@/types';

const DB_NAME = 'MAttendanceDB';
const DB_VERSION = 1;
const STORE_NAME = 'pending-attendance';

interface OfflineAttendanceRecord {
  id: number;
  miqaatId: string;
  entry: MiqaatAttendanceEntryItem;
}

let db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject(new Error('Failed to open IndexedDB.'));
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

export async function savePendingAttendance(miqaatId: string, entry: MiqaatAttendanceEntryItem): Promise<void> {
  const dbInstance = await openDB();
  const transaction = dbInstance.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  
  return new Promise((resolve, reject) => {
    const record = { miqaatId, entry };
    const request = store.add(record);
    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.error('Failed to save pending attendance:', request.error);
      reject(new Error('Could not save attendance record offline.'));
    };
  });
}

export async function getPendingAttendance(): Promise<OfflineAttendanceRecord[]> {
  const dbInstance = await openDB();
  const transaction = dbInstance.transaction(STORE_NAME, 'readonly');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as OfflineAttendanceRecord[]);
    request.onerror = () => {
      console.error('Failed to get pending attendance:', request.error);
      reject(new Error('Could not retrieve offline records.'));
    };
  });
}

export async function clearPendingAttendance(): Promise<void> {
  const dbInstance = await openDB();
  const transaction = dbInstance.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.error('Failed to clear pending attendance:', request.error);
      reject(new Error('Could not clear offline records.'));
    };
  });
}
