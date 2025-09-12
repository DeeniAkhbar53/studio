

'use server';

import { db } from './firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, getDoc, DocumentData, collectionGroup, writeBatch, queryEqual, getCountFromServer, arrayUnion, FieldValue } from 'firebase/firestore';
import type { User, UserRole, UserDesignation } from '@/types';

export type UserDataForAdd = Omit<User, 'id' | 'avatarUrl' | 'fcmTokens' > & { avatarUrl?: string };


export const addUser = async (userData: UserDataForAdd, mohallahId: string): Promise<User> => {
  if (!mohallahId) {
    throw new Error("Mohallah ID is required to add a user.");
  }
  try {
    const membersCollectionRef = collection(db, 'mohallahs', mohallahId, 'members');

    const payloadForFirestore: any = {
      name: userData.name,
      itsId: userData.itsId,
      email: userData.email || null, // Add email
      role: userData.role,
      mohallahId: mohallahId, // Storing mohallahId in the member document for collectionGroup queries
      avatarUrl: userData.avatarUrl || `https://placehold.co/40x40.png?text=${userData.name.substring(0,2).toUpperCase()}`,
      designation: userData.designation || "Member",
      pageRights: userData.pageRights || [],
      managedTeams: userData.managedTeams || [],
      fcmTokens: [], // Initialize FCM tokens array
    };
    
    if (userData.password) {
        payloadForFirestore.password = userData.password;
    }

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

type UserDataForUpdate = Partial<Omit<User, 'id'>>; 

export const updateUser = async (userId: string, mohallahId: string, updatedData: UserDataForUpdate): Promise<void> => {
  if (!mohallahId) {
    throw new Error("Mohallah ID is required to update a user.");
  }
  try {
    const userDocRef = doc(db, 'mohallahs', mohallahId, 'members', userId);
    
    const updatePayload: any = { ...updatedData };
    // MohallahId cannot be changed via this function; it's part of the document path
    delete updatePayload.mohallahId; 
    delete updatePayload.id; // id also cannot be changed
    
    // Explicitly handle password: if it's an empty string, don't include it in update.
    // This allows admins to update other details without changing the password.
    // The form should be responsible for sending undefined if password is not being changed.
    if (updatedData.password === '') {
        delete updatePayload.password;
    }


     Object.keys(updatePayload).forEach(key => {
      const K = key as keyof UserDataForUpdate;
      if (updatePayload[K] === undefined) {
        delete updatePayload[K]; 
      }
      if (K === 'pageRights' && !Array.isArray(updatePayload[K])) {
        updatePayload[K] = [];
      }
      if (K === 'fcmTokens' && !Array.isArray(updatePayload[K])) {
        updatePayload[K] = []; // Ensure fcmTokens is always an array or omitted
      }
      if (K === 'managedTeams' && !Array.isArray(updatePayload[K])) {
        updatePayload[K] = [];
      }
    });

    if (updatedData.hasOwnProperty('pageRights') && updatedData.pageRights === undefined) {
        updatePayload.pageRights = [];
    }
    if (updatedData.hasOwnProperty('fcmTokens') && updatedData.fcmTokens === undefined) { // Handle fcmTokens
        updatePayload.fcmTokens = [];
    }
    if (updatedData.hasOwnProperty('managedTeams') && updatedData.managedTeams === undefined) {
      updatePayload.managedTeams = [];
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
      console.log(`Fetching users for specific Mohallah ID: ${mohallahId}`);
      usersQuery = query(collection(db, 'mohallahs', mohallahId, 'members'));
    } else {
      console.log("Fetching all users using collectionGroup query for 'members'.");
      usersQuery = query(collectionGroup(db, 'members'));
    }
    const data = await getDocs(usersQuery);
    return data.docs.map((doc) => ({ 
      ...doc.data(), 
      id: doc.id, 
      pageRights: doc.data().pageRights || [],
      managedTeams: doc.data().managedTeams || [],
      fcmTokens: doc.data().fcmTokens || [], // Ensure fcmTokens is included
    } as User));
  } catch (error) {
    console.error("Error fetching users: ", error);
    if (error instanceof Error && error.message.includes("index")) {
        console.error("Query failed, possibly due to a missing system index. Super Admins: please ensure indexes are configured for 'members' collection group queries, or select a specific Mohallah.", error);
        throw new Error("Query failed, possibly due to a missing system index. Super Admins: please ensure indexes are configured for 'members' collection group queries, or select a specific Mohallah.");
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
      return { 
        ...userDoc.data(), 
        id: userDoc.id, 
        pageRights: userDoc.data().pageRights || [], 
        managedTeams: userDoc.data().managedTeams || [],
        mohallahId: userDoc.data().mohallahId, // This is the ID of the Mohallah the user belongs to
        fcmTokens: userDoc.data().fcmTokens || [], // Ensure fcmTokens is included
      } as User;
    }

    const bgkQuery = query(membersCollectionGroup, where("bgkId", "==", id));
    const bgkSnapshot = await getDocs(bgkQuery);
    if (!bgkSnapshot.empty) {
      const userDoc = bgkSnapshot.docs[0];
      return { 
        ...userDoc.data(), 
        id: userDoc.id, 
        pageRights: userDoc.data().pageRights || [],
        managedTeams: userDoc.data().managedTeams || [],
        mohallahId: userDoc.data().mohallahId,
        fcmTokens: userDoc.data().fcmTokens || [], // Ensure fcmTokens is included
      } as User;
    }
    
    return null;
  } catch (error) {
    console.error('CRITICAL: Error fetching user by ITS/BGK ID using collection group query: ', error);
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
    console.error('CRITICAL: Error fetching users count:', error);
    if (error instanceof Error && error.message.includes("index") && !mohallahId) {
         console.error("Counting all members requires collection group query support or indexes.");
    }
    return 0; 
  }
};

// Function to update user with FCM Token
export const updateUserFcmToken = async (userItsId: string, userMohallahId: string, token: string): Promise<void> => {
    try {
        const user = await getUserByItsOrBgkId(userItsId);
        if (!user || !user.mohallahId) {
            console.error(`User with ITS ID ${userItsId} not found or has no Mohallah ID.`);
            return;
        }

        const userDocRef = doc(db, 'mohallahs', user.mohallahId, 'members', user.id);
        
        await updateDoc(userDocRef, {
            fcmTokens: arrayUnion(token)
        });
        console.log(`FCM token updated for user ${userItsId}`);

    } catch (error) {
        console.error(`Error updating FCM token for user ${userItsId}: `, error);
    }
};
