
import { db } from './firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, getDoc, DocumentData } from 'firebase/firestore';
import type { User, UserRole } from '@/types';

const usersCollectionRef = collection(db, 'users');

export const getUsers = async (): Promise<User[]> => {
  try {
    const data = await getDocs(usersCollectionRef);
    return data.docs.map((doc) => ({ ...doc.data(), id: doc.id } as User));
  } catch (error) {
    console.error("Error fetching users: ", error);
    throw error;
  }
};

export const addUser = async (userData: Omit<User, 'id' | 'avatarUrl'> & { avatarUrl?: string }): Promise<User> => {
  try {
    const docRef = await addDoc(usersCollectionRef, {
      ...userData,
      avatarUrl: userData.avatarUrl || `https://placehold.co/40x40.png?text=${userData.name.substring(0,2).toUpperCase()}`
    });
    return { ...userData, id: docRef.id, avatarUrl: userData.avatarUrl || `https://placehold.co/40x40.png?text=${userData.name.substring(0,2).toUpperCase()}` };
  } catch (error) {
    console.error("Error adding user: ", error);
    throw error;
  }
};

export const updateUser = async (userId: string, updatedData: Partial<Omit<User, 'id'>>): Promise<void> => {
  try {
    const userDoc = doc(db, 'users', userId);
    await updateDoc(userDoc, updatedData);
  } catch (error) {
    console.error("Error updating user: ", error);
    throw error;
  }
};

export const deleteUser = async (userId: string): Promise<void> => {
  try {
    const userDoc = doc(db, 'users', userId);
    await deleteDoc(userDoc);
  } catch (error) {
    console.error("Error deleting user: ", error);
    throw error;
  }
};

export const getUserByItsOrBgkId = async (id: string): Promise<User | null> => {
  try {
    // Query for ITS ID
    const itsQuery = query(usersCollectionRef, where("itsId", "==", id));
    const itsSnapshot = await getDocs(itsQuery);
    if (!itsSnapshot.empty) {
      const userDoc = itsSnapshot.docs[0];
      return { ...userDoc.data(), id: userDoc.id } as User;
    }

    // Query for BGK ID if not found by ITS ID
    const bgkQuery = query(usersCollectionRef, where("bgkId", "==", id));
    const bgkSnapshot = await getDocs(bgkQuery);
    if (!bgkSnapshot.empty) {
      const userDoc = bgkSnapshot.docs[0];
      return { ...userDoc.data(), id: userDoc.id } as User;
    }
    
    return null; // Not found by either
  } catch (error) {
    console.error("Error fetching user by ITS/BGK ID: ", error);
    throw error;
  }
};
