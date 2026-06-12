import { db, getYearPath } from './firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query as firestoreQuery, orderBy, onSnapshot, Unsubscribe, getCountFromServer, query, getDoc } from 'firebase/firestore';
import type { Mohallah } from '@/types';
import { deleteSubcollection } from './utils'; 
import { addAuditLog } from './auditLogService';


const mohallahsCollectionRef = collection(db, getYearPath('mohallahs'));

// Modified to use onSnapshot for realtime updates
export const getMohallahs = (onUpdate: (mohallahs: Mohallah[]) => void): Unsubscribe => {
  const q = firestoreQuery(mohallahsCollectionRef, orderBy('name', 'asc'));
  
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const mohallahs = querySnapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id } as Mohallah));
    onUpdate(mohallahs);
  }, (error) => {
    
    onUpdate([]); 
  });

  return unsubscribe;
};

export const addMohallah = async (name: string): Promise<Mohallah> => {
  try {
    const docRef = await addDoc(mohallahsCollectionRef, { 
      name,
      createdAt: serverTimestamp()
    });

    const actorName = typeof window !== 'undefined' ? localStorage.getItem('userName') || 'Unknown' : 'System';
    const actorItsId = typeof window !== 'undefined' ? localStorage.getItem('userItsId') || 'Unknown' : 'System';
    await addAuditLog('mohallah_created', { itsId: actorItsId, name: actorName }, 'info', { mohallahName: name });


    return { id: docRef.id, name, createdAt: new Date().toISOString() } as Mohallah; 
  } catch (error) {
    
    throw error;
  }
};

export const updateMohallahName = async (mohallahId: string, newName: string): Promise<void> => {
  try {
    const mohallahDoc = doc(db, getYearPath('mohallahs'), mohallahId);
    const originalDoc = await getDoc(mohallahDoc);

    await updateDoc(mohallahDoc, { name: newName });

    const actorName = typeof window !== 'undefined' ? localStorage.getItem('userName') || 'Unknown' : 'System';
    const actorItsId = typeof window !== 'undefined' ? localStorage.getItem('userItsId') || 'Unknown' : 'System';
    await addAuditLog('mohallah_updated', { itsId: actorItsId, name: actorName }, 'info', { mohallahId, oldName: originalDoc.data()?.name, newName });

  } catch (error) {
    
    throw error;
  }
};

export const deleteMohallah = async (mohallahId: string): Promise<void> => {
  try {
    const mohallahDoc = doc(db, getYearPath('mohallahs'), mohallahId);
    const docToDelete = await getDoc(mohallahDoc);
    const mohallahName = docToDelete.data()?.name || 'Unknown';

    const membersPath = `${getYearPath('mohallahs')}/${mohallahId}/members`;
    await deleteSubcollection(db, membersPath, 100); 

    await deleteDoc(mohallahDoc);
    
    const actorName = typeof window !== 'undefined' ? localStorage.getItem('userName') || 'Unknown' : 'System';
    const actorItsId = typeof window !== 'undefined' ? localStorage.getItem('userItsId') || 'Unknown' : 'System';
    await addAuditLog('mohallah_deleted', { itsId: actorItsId, name: actorName }, 'critical', { mohallahId, mohallahName });

  } catch (error) {
    
    throw error;
  }
};

export const getMohallahsCount = async (): Promise<number> => {
  try {
    const q = query(collection(db, getYearPath('mohallahs')));
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  } catch (error) {
    
    // Return 0 on error instead of re-throwing
    return 0; 
  }
};

export const getLegacyMohallahs = async (): Promise<Mohallah[]> => {
  try {
    const q = query(collection(db, 'mohallahs'), orderBy('name', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    } as Mohallah));
  } catch (error) {
    console.error("Failed to fetch legacy mohallahs:", error);
    return [];
  }
};

    
