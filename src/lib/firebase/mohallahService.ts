
'use server';

import { db } from './firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query as firestoreQuery, orderBy, onSnapshot, Unsubscribe } from 'firebase/firestore';
import type { Mohallah } from '@/types';
import { deleteSubcollection } from './utils'; // Assuming utils.ts will be created for this

const mohallahsCollectionRef = collection(db, 'mohallahs');

// Modified to use onSnapshot for realtime updates
export const getMohallahs = (onUpdate: (mohallahs: Mohallah[]) => void): Unsubscribe => {
  const q = firestoreQuery(mohallahsCollectionRef, orderBy('name', 'asc'));
  
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const mohallahs = querySnapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id } as Mohallah));
    onUpdate(mohallahs);
  }, (error) => {
    console.error("Error fetching mohallahs with onSnapshot: ", error);
    // Optionally call onUpdate with an empty array or handle error state
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
    // To get the full object including serverTimestamp, we might need to fetch it,
    // but for simplicity, we return what we know.
    // Firestore automatically handles createdAt on the server.
    return { id: docRef.id, name } as Mohallah; 
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
    // First, delete the 'members' subcollection
    const membersPath = `mohallahs/${mohallahId}/members`;
    await deleteSubcollection(db, membersPath, 100); // Batch size 100

    // Then, delete the Mohallah document itself
    const mohallahDoc = doc(db, 'mohallahs', mohallahId);
    await deleteDoc(mohallahDoc);
  } catch (error) {
    console.error("Error deleting mohallah and its members: ", error);
    throw error;
  }
};
