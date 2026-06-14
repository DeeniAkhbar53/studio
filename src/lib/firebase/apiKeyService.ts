import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc, 
  onSnapshot, 
  query, 
  orderBy,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';

export interface ApiKey {
  id: string;
  key: string;
  clientName: string;
  email: string;
  status: 'active' | 'suspended';
  requestCount: number;
  createdAt: any;
  updatedAt: any;
}

// Generate a secure random API key prefixed with bgk_live_
function generateRandomKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `bgk_live_${token}`;
}

// Listen to all API Keys (Real-time updates)
export function getApiKeys(onUpdate: (keys: ApiKey[]) => void) {
  const q = query(collection(db, 'api_keys'), orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const keys: ApiKey[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      keys.push({
        id: docSnap.id,
        key: data.key,
        clientName: data.clientName,
        email: data.email,
        status: data.status || 'active',
        requestCount: data.requestCount || 0,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      } as ApiKey);
    });
    onUpdate(keys);
  }, (error) => {
    console.error("Error fetching API keys:", error);
  });
}

// Create a new API Key
export async function createApiKey(clientName: string, email: string): Promise<string> {
  const newKey = generateRandomKey();
  
  await addDoc(collection(db, 'api_keys'), {
    key: newKey,
    clientName,
    email,
    status: 'active',
    requestCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return newKey;
}

// Toggle status of API Key
export async function toggleApiKeyStatus(keyId: string, currentStatus: 'active' | 'suspended'): Promise<void> {
  const docRef = doc(db, 'api_keys', keyId);
  const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
  
  await updateDoc(docRef, {
    status: newStatus,
    updatedAt: serverTimestamp()
  });
}

// Revoke/Delete API Key
export async function deleteApiKey(keyId: string): Promise<void> {
  const docRef = doc(db, 'api_keys', keyId);
  await deleteDoc(docRef);
}
