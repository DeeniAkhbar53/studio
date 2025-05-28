
import { db } from './firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import type { Mohallah } from '@/types';

const mohallahsCollectionRef = collection(db, 'mohallahs');

export const getMohallahs = async (): Promise<Mohallah[]> => {
  try {
    const data = await getDocs(mohallahsCollectionRef);
    return data.docs.map((doc) => ({ ...doc.data(), id: doc.id } as Mohallah)).sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Error fetching mohallahs: ", error);
    throw error;
  }
};

export const addMohallah = async (name: string): Promise<Mohallah> => {
  try {
    const docRef = await addDoc(mohallahsCollectionRef, { 
      name,
      createdAt: serverTimestamp() // Optional: track creation time
    });
    return { id: docRef.id, name };
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
    // Consider implications: Users assigned to this Mohallah will have an orphaned mohallahId.
    // You might want to unassign users or prevent deletion if users are assigned.
    const mohallahDoc = doc(db, 'mohallahs', mohallahId);
    await deleteDoc(mohallahDoc);
  } catch (error) {
    console.error("Error deleting mohallah: ", error);
    throw error;
  }
};
