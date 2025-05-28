
'use server';

import { db } from './firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, getDoc, DocumentData, collectionGroup, writeBatch, queryEqual } from 'firebase/firestore';
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

    // Construct the payload for Firestore, omitting undefined or empty optional fields
    const payloadForFirestore: any = {
      name: userData.name,
      itsId: userData.itsId,
      role: userData.role,
      mohallahId: mohallahId, // Denormalize mohallahId within the member document for collectionGroup queries
      avatarUrl: userData.avatarUrl || `https://placehold.co/40x40.png?text=${userData.name.substring(0,2).toUpperCase()}`,
      designation: userData.designation || "Member", // Default designation
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
    // designation is already handled with a default

    const docRef = await addDoc(membersCollectionRef, payloadForFirestore);
    return { ...userData, id: docRef.id, avatarUrl: payloadForFirestore.avatarUrl, mohallahId } as User;
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
    // Remove mohallahId from updatedData if present, as it shouldn't be changed here.
    // The user's mohallah is determined by the subcollection they are in.
    delete updatePayload.mohallahId; 

     Object.keys(updatePayload).forEach(key => {
      if (updatePayload[key as keyof UserDataForUpdate] === undefined) {
        delete updatePayload[key as keyof UserDataForUpdate]; 
      }
    });
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
    if (mohallahId && mohallahId !== 'all') { // Handle 'all' specifically if used as a filter value
      usersQuery = query(collection(db, 'mohallahs', mohallahId, 'members'));
    } else {
      // Collection group query for 'members' across all 'mohallahs'
      usersQuery = query(collectionGroup(db, 'members'));
    }
    const data = await getDocs(usersQuery);
    return data.docs.map((doc) => ({ ...doc.data(), id: doc.id } as User));
  } catch (error) {
    console.error("Error fetching users: ", error);
    // If it's an index error for collection group, provide a more specific message
    if (error instanceof Error && error.message.includes("index")) {
        console.error("This operation likely requires a Firestore index for the 'members' collection group. Please check your Firebase console.", error);
        // Potentially throw a custom error or return an empty array with a status
        throw new Error("Firestore query failed, possibly due to a missing index. Super Admins: please ensure Firestore indexes are configured for 'members' collection group queries.");
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
      return { ...userDoc.data(), id: userDoc.id } as User;
    }

    const bgkQuery = query(membersCollectionGroup, where("bgkId", "==", id));
    const bgkSnapshot = await getDocs(bgkQuery);
    if (!bgkSnapshot.empty) {
      const userDoc = bgkSnapshot.docs[0];
      return { ...userDoc.data(), id: userDoc.id } as User;
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching user by ITS/BGK ID using collection group query: ", error);
    if (error instanceof Error && error.message.includes("index")) {
        console.error("This operation requires a Firestore index on 'itsId' and 'bgkId' for the 'members' collection group. Please check your Firebase console.");
    }
    throw error; // Re-throw to be handled by calling function
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
