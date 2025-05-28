
import { db } from './firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query as firestoreQuery, orderBy, onSnapshot, Unsubscribe, getCountFromServer } from 'firebase/firestore';
import type { Mohallah } from '@/types';
import { deleteSubcollection } from './utils'; 

const mohallahsCollectionRef = collection(db, 'mohallahs');

// Modified to use onSnapshot for realtime updates
export const getMohallahs = (onUpdate: (mohallahs: Mohallah[]) => void): Unsubscribe => {
  const q = firestoreQuery(mohallahsCollectionRef, orderBy('name', 'asc'));
  
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const mohallahs = querySnapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id } as Mohallah));
    onUpdate(mohallahs);
  }, (error) => {
    console.error("Error fetching mohallahs with onSnapshot: ", error);
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
    return { id: docRef.id, name, createdAt: new Date().toISOString() } as Mohallah; 
  } catch (error) {
    console.error("Error adding mohallah: ", error);
    throw error;
  }
};

export const updateMohallahName = async (mohallahId: string, newName: string): Promise<void> => {
  try {
    const mohallahDoc = doc(db, 'mohallahs', mohallahId);
    await updateDoc(mohallahDoc, { name: newName });
  } catch (error) {
    console.error("Error updating mohallah name: ", error);
    throw error;
  }
};

export const deleteMohallah = async (mohallahId: string): Promise<void> => {
  try {
    const membersPath = `mohallahs/${mohallahId}/members`;
    await deleteSubcollection(db, membersPath, 100); 

    const mohallahDoc = doc(db, 'mohallahs', mohallahId);
    await deleteDoc(mohallahDoc);
  } catch (error) {
    console.error("Error deleting mohallah and its members: ", error);
    throw error;
  }
};

export const getMohallahsCount = async (): Promise<number> => {
  try {
    const q = query(collection(db, 'mohallahs'));
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  } catch (error) {
    console.error('Error fetching mohallahs count:', error);
    return 0; // Return 0 on error
  }
};
