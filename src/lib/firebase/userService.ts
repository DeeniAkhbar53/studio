
'use server';

import { db } from './firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, getDoc, DocumentData, collectionGroup, writeBatch, queryEqual, getCountFromServer } from 'firebase/firestore';
import type { User, UserRole, UserDesignation } from '@/types';

// UserData type for adding should reflect the User type, minus 'id' and with optional 'avatarUrl'
export type UserDataForAdd = Omit<User, 'id' | 'avatarUrl'> & { avatarUrl?: string };

// This function adds a user to a specific Mohallah's 'members' subcollection
export const addUser = async (userData: UserDataForAdd, mohallahId: string): Promise<User> => {
  if (!mohallahId) {
    throw new Error("Mohallah ID is required to add a user.");
  }
  try {
    const membersCollectionRef = collection(db, 'mohallahs', mohallahId, 'members');

    const payloadForFirestore: any = {
      name: userData.name,
      itsId: userData.itsId,
      role: userData.role,
      mohallahId: mohallahId,
      avatarUrl: userData.avatarUrl || `https://placehold.co/40x40.png?text=${userData.name.substring(0,2).toUpperCase()}`,
      designation: userData.designation || "Member",
      pageRights: userData.pageRights || [],
    };

    if (userData.bgkId && userData.bgkId.trim() !== "") {
      payloadForFirestore.bgkId = userData.bgkId;
    }
    if (userData.team && userData.team.trim() !== "") {
      payloadForFirestore.team = userData.team;
    }
    if (userData.phoneNumber && userData.phoneNumber.trim() !== "") {
      payloadForFirestore.phoneNumber = userData.phoneNumber;
    }

    const docRef = await addDoc(membersCollectionRef, payloadForFirestore);
    return { ...payloadForFirestore, id: docRef.id } as User;
  } catch (error) {
    console.error(`Error adding user to Mohallah ${mohallahId}: `, error);
    throw error;
  }
};


// UpdatedData type for updating should be Partial of User, minus 'id'
type UserDataForUpdate = Partial<Omit<User, 'id'>>;

// This function updates a user within a specific Mohallah's 'members' subcollection
export const updateUser = async (userId: string, mohallahId: string, updatedData: UserDataForUpdate): Promise<void> => {
  if (!mohallahId) {
    throw new Error("Mohallah ID is required to update a user.");
  }
  try {
    const userDocRef = doc(db, 'mohallahs', mohallahId, 'members', userId);
    
    const updatePayload: any = { ...updatedData };
     // Explicitly remove mohallahId from payload if present, as it's path-defined
    delete updatePayload.mohallahId; 

     Object.keys(updatePayload).forEach(key => {
      const K = key as keyof UserDataForUpdate;
      if (updatePayload[K] === undefined) {
        delete updatePayload[K]; 
      }
      if (K === 'pageRights' && !Array.isArray(updatePayload[K])) {
        updatePayload[K] = [];
      }
    });

    if (updatedData.hasOwnProperty('pageRights') && updatedData.pageRights === undefined) {
        updatePayload.pageRights = [];
    }

    await updateDoc(userDocRef, updatePayload);
  } catch (error) {
    console.error(`Error updating user ${userId} in Mohallah ${mohallahId}: `, error);
    throw error;
  }
};

// This function deletes a user from a specific Mohallah's 'members' subcollection
export const deleteUser = async (userId: string, mohallahId: string): Promise<void> => {
  if (!mohallahId) {
    throw new Error("Mohallah ID is required to delete a user.");
  }
  try {
    const userDocRef = doc(db, 'mohallahs', mohallahId, 'members', userId);
    await deleteDoc(userDocRef);
  } catch (error)
{
    console.error(`Error deleting user ${userId} from Mohallah ${mohallahId}: `, error);
    throw error;
  }
};

// Fetches users. If mohallahId is provided, fetches from that Mohallah's 'members' subcollection.
// Otherwise, fetches all users across all Mohallahs using a collection group query.
export const getUsers = async (mohallahId?: string): Promise<User[]> => {
  try {
    let usersQuery;
    if (mohallahId && mohallahId !== 'all') {
      usersQuery = query(collection(db, 'mohallahs', mohallahId, 'members'));
    } else {
      usersQuery = query(collectionGroup(db, 'members'));
    }
    const data = await getDocs(usersQuery);
    return data.docs.map((doc) => ({ ...doc.data(), id: doc.id, pageRights: doc.data().pageRights || [] } as User));
  } catch (error) {
    console.error("Error fetching users: ", error);
    if (error instanceof Error && error.message.includes("index")) {
        console.error("This operation likely requires a Firestore index for the 'members' collection group. Please check your Firebase console.", error);
        throw new Error("Query failed, possibly due to a missing index. Super Admins: please ensure indexes are configured for 'members' collection group queries, or select a specific Mohallah.");
    }
    throw error;
  }
};


export const getUserByItsOrBgkId = async (id: string): Promise<User | null> => {
  try {
    const membersCollectionGroup = collectionGroup(db, 'members');
    
    const itsQuery = query(membersCollectionGroup, where("itsId", "==", id));
    const itsSnapshot = await getDocs(itsQuery);
    if (!itsSnapshot.empty) {
      const userDoc = itsSnapshot.docs[0];
      return { ...userDoc.data(), id: userDoc.id, pageRights: userDoc.data().pageRights || [], mohallahId: userDoc.data().mohallahId } as User;
    }

    const bgkQuery = query(membersCollectionGroup, where("bgkId", "==", id));
    const bgkSnapshot = await getDocs(bgkQuery);
    if (!bgkSnapshot.empty) {
      const userDoc = bgkSnapshot.docs[0];
      return { ...userDoc.data(), id: userDoc.id, pageRights: userDoc.data().pageRights || [], mohallahId: userDoc.data().mohallahId } as User;
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching user by ITS/BGK ID using collection group query: ", error);
    if (error instanceof Error && error.message.includes("index")) {
        console.error("This operation requires a Firestore index on 'itsId' and 'bgkId' for the 'members' collection group. Please check your Firebase console.");
    }
    throw error; 
  }
};

export const getUniqueTeamNames = async (): Promise<string[]> => {
  try {
    const usersSnapshot = await getDocs(collectionGroup(db, 'members'));
    const teamNames = new Set<string>();
    usersSnapshot.forEach(doc => {
      const userData = doc.data() as User;
      if (userData.team && userData.team.trim() !== "") {
        teamNames.add(userData.team.trim());
      }
    });
    return Array.from(teamNames).sort();
  } catch (error) {
    console.error("Error fetching unique team names using collection group query: ", error);
     if (error instanceof Error && error.message.includes("index")) {
        console.error("This operation may require a Firestore index on 'team' for the 'members' collection group if you plan to query/filter by it broadly. For now, it scans all members.");
    }
    throw error;
  }
};

export const getUsersCount = async (mohallahId?: string): Promise<number> => {
  try {
    let q;
    if (mohallahId) {
      q = query(collection(db, 'mohallahs', mohallahId, 'members'));
    } else {
      q = query(collectionGroup(db, 'members'));
    }
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  } catch (error) {
    console.error('Error fetching users count:', error);
    if (error instanceof Error && error.message.includes("index") && !mohallahId) {
         console.error("Counting all members requires collection group query support or indexes.");
    }
    return 0; // Return 0 on error
  }
};
