
'use server';

import { db } from './firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, getDoc, DocumentData, collectionGroup, writeBatch, queryEqual, getCountFromServer, arrayUnion } from 'firebase/firestore';
import type { User, UserRole, UserDesignation } from '@/types';

export type UserDataForAdd = Omit<User, 'id' | 'avatarUrl' | 'fcmTokens' | 'oneSignalPlayerIds'> & { avatarUrl?: string };

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
      mohallahId: mohallahId, // Storing mohallahId within the member document for easier querying
      avatarUrl: userData.avatarUrl || `https://placehold.co/40x40.png?text=${userData.name.substring(0,2).toUpperCase()}`,
      designation: userData.designation || "Member",
      pageRights: userData.pageRights || [],
      oneSignalPlayerIds: [], // Initialize OneSignal Player IDs array
      fcmTokens: [], // Initialize FCM tokens array, can be removed if fcm is fully replaced
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

type UserDataForUpdate = Partial<Omit<User, 'id' | 'fcmTokens' | 'oneSignalPlayerIds'>>;

export const updateUser = async (userId: string, mohallahId: string, updatedData: UserDataForUpdate): Promise<void> => {
  if (!mohallahId) {
    throw new Error("Mohallah ID is required to update a user.");
  }
  try {
    const userDocRef = doc(db, 'mohallahs', mohallahId, 'members', userId);
    
    const updatePayload: any = { ...updatedData };
    delete updatePayload.mohallahId; // MohallahId should not be changed via this function

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

export const deleteUser = async (userId: string, mohallahId: string): Promise<void> => {
  if (!mohallahId) {
    throw new Error("Mohallah ID is required to delete a user.");
  }
  try {
    const userDocRef = doc(db, 'mohallahs', mohallahId, 'members', userId);
    await deleteDoc(userDocRef);
  } catch (error) {
    console.error(`Error deleting user ${userId} from Mohallah ${mohallahId}: `, error);
    throw error;
  }
};

export const getUsers = async (mohallahId?: string): Promise<User[]> => {
  try {
    let usersQuery;
    if (mohallahId && mohallahId !== 'all') {
      usersQuery = query(collection(db, 'mohallahs', mohallahId, 'members'));
    } else {
      // This query requires a composite index on the 'members' collection group
      // if you add sorting or more complex filters.
      // For just fetching all, it might work but can be slow with many users.
      usersQuery = query(collectionGroup(db, 'members'));
    }
    const data = await getDocs(usersQuery);
    return data.docs.map((doc) => ({ 
      ...doc.data(), 
      id: doc.id, 
      pageRights: doc.data().pageRights || [],
      oneSignalPlayerIds: doc.data().oneSignalPlayerIds || [],
      fcmTokens: doc.data().fcmTokens || [],
    } as User));
  } catch (error) {
    console.error("Error fetching users: ", error);
    if (error instanceof Error && error.message.includes("index")) {
        console.error("This operation likely requires a Firestore index for the 'members' collection group. Please check your Firebase console.", error);
        throw new Error("Query failed, possibly due to a missing system index. Super Admins: please ensure indexes are configured for 'members' collection group queries, or select a specific Mohallah.");
    }
    throw error;
  }
};

export const getUserByItsOrBgkId = async (id: string): Promise<User | null> => {
  try {
    const membersCollectionGroup = collectionGroup(db, 'members');
    
    // Query for ITS ID
    const itsQuery = query(membersCollectionGroup, where("itsId", "==", id));
    const itsSnapshot = await getDocs(itsQuery);
    if (!itsSnapshot.empty) {
      const userDoc = itsSnapshot.docs[0];
      return { 
        ...userDoc.data(), 
        id: userDoc.id, 
        pageRights: userDoc.data().pageRights || [], 
        mohallahId: userDoc.data().mohallahId, // Ensure mohallahId is part of the User object from DB
        oneSignalPlayerIds: userDoc.data().oneSignalPlayerIds || [],
        fcmTokens: userDoc.data().fcmTokens || [],
      } as User;
    }

    // Query for BGK ID if not found by ITS ID
    const bgkQuery = query(membersCollectionGroup, where("bgkId", "==", id));
    const bgkSnapshot = await getDocs(bgkQuery);
    if (!bgkSnapshot.empty) {
      const userDoc = bgkSnapshot.docs[0];
      return { 
        ...userDoc.data(), 
        id: userDoc.id, 
        pageRights: userDoc.data().pageRights || [], 
        mohallahId: userDoc.data().mohallahId,
        oneSignalPlayerIds: userDoc.data().oneSignalPlayerIds || [],
        fcmTokens: userDoc.data().fcmTokens || [],
      } as User;
    }
    
    // If no user found by either ID
    return null;
  } catch (error) {
    console.error('Error fetching user by ITS/BGK ID using collection group query: ', error);
    if (error instanceof Error && error.message.includes("index")) {
        console.error("This operation requires Firestore indexes on 'itsId' and 'bgkId' for the 'members' collection group. Please check your Firebase console.");
    }
    return null; 
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
    return 0; 
  }
};

// Function to update user with OneSignal Player ID
export const updateUserOneSignalPlayerId = async (userId: string, mohallahId: string, playerId: string): Promise<void> => {
  if (!mohallahId || !userId) {
    console.error("Mohallah ID and User ID are required to update OneSignal Player ID.");
    return;
  }
  try {
    const userDocRef = doc(db, 'mohallahs', mohallahId, 'members', userId);
    await updateDoc(userDocRef, {
      oneSignalPlayerIds: arrayUnion(playerId)
    });
    console.log(`OneSignal Player ID ${playerId} added for user ${userId} in Mohallah ${mohallahId}`);
  } catch (error) {
    console.error(`Error updating OneSignal Player ID for user ${userId} in Mohallah ${mohallahId}: `, error);
    // Potentially throw the error if the caller needs to know it failed
    // throw error;
  }
};
