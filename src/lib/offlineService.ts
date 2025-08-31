
import type { MiqaatAttendanceEntryItem, User } from '@/types';

const DB_NAME = 'MAttendanceDB';
const DB_VERSION = 2; // Increment version for schema change
const PENDING_STORE_NAME = 'pending-attendance';
const USER_CACHE_STORE_NAME = 'cached-users';

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
      if (!dbInstance.objectStoreNames.contains(PENDING_STORE_NAME)) {
        dbInstance.createObjectStore(PENDING_STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
      if (!dbInstance.objectStoreNames.contains(USER_CACHE_STORE_NAME)) {
        const userStore = dbInstance.createObjectStore(USER_CACHE_STORE_NAME, { keyPath: 'id' });
        userStore.createIndex('itsId', 'itsId', { unique: true });
        userStore.createIndex('bgkId', 'bgkId', { unique: false }); // BGK ID is optional, so not unique
      }
    };
  });
}

// --- PENDING ATTENDANCE FUNCTIONS ---

export async function savePendingAttendance(miqaatId: string, entry: MiqaatAttendanceEntryItem): Promise<void> {
  const dbInstance = await openDB();
  const transaction = dbInstance.transaction(PENDING_STORE_NAME, 'readwrite');
  const store = transaction.objectStore(PENDING_STORE_NAME);
  
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
  const transaction = dbInstance.transaction(PENDING_STORE_NAME, 'readonly');
  const store = transaction.objectStore(PENDING_STORE_NAME);

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
  const transaction = dbInstance.transaction(PENDING_STORE_NAME, 'readwrite');
  const store = transaction.objectStore(PENDING_STORE_NAME);
  
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.error('Failed to clear pending attendance:', request.error);
      reject(new Error('Could not clear offline records.'));
    };
  });
}


// --- USER CACHING FUNCTIONS ---

export async function cacheAllUsers(users: User[]): Promise<void> {
    const dbInstance = await openDB();
    const transaction = dbInstance.transaction(USER_CACHE_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(USER_CACHE_STORE_NAME);

    // Clear existing cache before writing new data
    store.clear();

    // Add all users to the store
    users.forEach(user => {
        // Only add if user has a valid ID.
        if(user.id) {
            store.put(user);
        }
    });

    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => {
            console.error('Failed to cache users:', (event.target as IDBTransaction).error);
            reject(new Error('Could not cache user data locally.'));
        };
    });
}

export async function getCachedUserByItsOrBgkId(id: string): Promise<User | null> {
    const dbInstance = await openDB();
    const transaction = dbInstance.transaction(USER_CACHE_STORE_NAME, 'readonly');
    const store = transaction.objectStore(USER_CACHE_STORE_NAME);

    // Try finding by ITS ID first
    const itsIndex = store.index('itsId');
    const itsRequest = itsIndex.get(id);

    return new Promise((resolve, reject) => {
        itsRequest.onsuccess = () => {
            if (itsRequest.result) {
                resolve(itsRequest.result);
            } else {
                // If not found by ITS ID, try by BGK ID
                const bgkIndex = store.index('bgkId');
                const bgkRequest = bgkIndex.get(id);
                bgkRequest.onsuccess = () => {
                    resolve(bgkRequest.result || null);
                };
                bgkRequest.onerror = () => {
                    console.error('Failed to get cached user by BGK ID:', bgkRequest.error);
                    reject(new Error('Failed to query local user cache by BGK ID.'));
                };
            }
        };
        itsRequest.onerror = () => {
            console.error('Failed to get cached user by ITS ID:', itsRequest.error);
            reject(new Error('Failed to query local user cache by ITS ID.'));
        };
    });
}
