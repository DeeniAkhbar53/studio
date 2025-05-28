
import { db } from './firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, getDoc, DocumentData } from 'firebase/firestore';
import type { User, UserRole, UserDesignation } from '@/types';

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

// UserData type for adding should reflect the User type, minus 'id' and with optional 'avatarUrl'
type UserDataForAdd = Omit<User, 'id' | 'avatarUrl'> & { avatarUrl?: string };

export const addUser = async (userData: UserDataForAdd): Promise<User> => {
  try {
    const userPayload: any = { ...userData };
    if (!userPayload.avatarUrl) {
      userPayload.avatarUrl = `https://placehold.co/40x40.png?text=${userData.name.substring(0,2).toUpperCase()}`;
    }
    // Ensure optional fields like designation are included if provided
    if (userData.designation) {
        userPayload.designation = userData.designation;
    }

    const docRef = await addDoc(usersCollectionRef, userPayload);
    return { ...userData, id: docRef.id, avatarUrl: userPayload.avatarUrl } as User;
  } catch (error) {
    console.error("Error adding user: ", error);
    throw error;
  }
};

// UpdatedData type for updating should be Partial of User, minus 'id'
type UserDataForUpdate = Partial<Omit<User, 'id'>>;

export const updateUser = async (userId: string, updatedData: UserDataForUpdate): Promise<void> => {
  try {
    const userDoc = doc(db, 'users', userId);
    const updatePayload: any = { ...updatedData };
     Object.keys(updatePayload).forEach(key => {
      if (updatePayload[key] === undefined) {
        delete updatePayload[key]; // Don't send undefined fields to Firestore
      }
    });
    await updateDoc(userDoc, updatePayload);
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
    const itsQuery = query(usersCollectionRef, where("itsId", "==", id));
    const itsSnapshot = await getDocs(itsQuery);
    if (!itsSnapshot.empty) {
      const userDoc = itsSnapshot.docs[0];
      return { ...userDoc.data(), id: userDoc.id } as User;
    }

    const bgkQuery = query(usersCollectionRef, where("bgkId", "==", id));
    const bgkSnapshot = await getDocs(bgkQuery);
    if (!bgkSnapshot.empty) {
      const userDoc = bgkSnapshot.docs[0];
      return { ...userDoc.data(), id: userDoc.id } as User;
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching user by ITS/BGK ID: ", error);
    throw error;
  }
};

export const getUniqueTeamNames = async (): Promise<string[]> => {
  try {
    const usersSnapshot = await getDocs(usersCollectionRef);
    const teamNames = new Set<string>();
    usersSnapshot.forEach(doc => {
      const userData = doc.data() as User;
      if (userData.team && userData.team.trim() !== "") {
        teamNames.add(userData.team.trim());
      }
    });
    return Array.from(teamNames).sort();
  } catch (error) {
    console.error("Error fetching unique team names: ", error);
    throw error;
  }
};
