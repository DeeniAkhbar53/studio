

'use server';

import { db } from './firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, getDoc, DocumentData, collectionGroup, writeBatch, queryEqual, getCountFromServer, arrayUnion, FieldValue, serverTimestamp, Timestamp, orderBy } from 'firebase/firestore';
import type { User, UserRole, UserDesignation, DuaAttendance } from '@/types';

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
    
    throw error;
  }
};

export const getUsers = async (mohallahId?: string): Promise<User[]> => {
  try {
    let usersQuery;
    if (mohallahId && mohallahId !== 'all') {
      
      usersQuery = query(collection(db, 'mohallahs', mohallahId, 'members'));
    } else {
      
      usersQuery = query(collectionGroup(db, 'members'));
    }
    const data = await getDocs(usersQuery);
    return data.docs.map((doc) => {
        const docData = doc.data();
        const lastLogin = docData.lastLogin instanceof Timestamp 
                        ? docData.lastLogin.toDate().toISOString() 
                        : docData.lastLogin;

        return { 
            ...docData, 
            id: doc.id,
            lastLogin, 
            pageRights: docData.pageRights || [],
            managedTeams: docData.managedTeams || [],
            fcmTokens: docData.fcmTokens || [],
        } as User
    });
  } catch (error) {
    
    if (error instanceof Error && error.message.includes("index")) {
        
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
      const userData = userDoc.data();
      const lastLogin = userData.lastLogin instanceof Timestamp ? userData.lastLogin.toDate().toISOString() : userData.lastLogin;
      return { 
        ...userData, 
        id: userDoc.id,
        lastLogin,
        pageRights: userData.pageRights || [],
        managedTeams: userData.managedTeams || [],
        mohallahId: userDoc.ref.parent.parent?.id,
        fcmTokens: userData.fcmTokens || [], // Ensure fcmTokens is included
      } as User;
    }

    const bgkQuery = query(membersCollectionGroup, where("bgkId", "==", id));
    const bgkSnapshot = await getDocs(bgkQuery);
    if (!bgkSnapshot.empty) {
      const userDoc = bgkSnapshot.docs[0];
      const userData = userDoc.data();
      const lastLogin = userData.lastLogin instanceof Timestamp ? userData.lastLogin.toDate().toISOString() : userData.lastLogin;
      return { 
        ...userData, 
        id: userDoc.id,
        lastLogin,
        pageRights: userData.pageRights || [],
        managedTeams: userData.managedTeams || [],
        mohallahId: userDoc.ref.parent.parent?.id,
        fcmTokens: userData.fcmTokens || [], // Ensure fcmTokens is included
      } as User;
    }
    
    return null;
  } catch (error) {
    
    if (error instanceof Error && error.message.includes("index")) {
        
    }
    return null; 
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
    
    if (error instanceof Error && error.message.includes("index") && !mohallahId) {
         
    }
    return 0; 
  }
};

// Function to update user with FCM Token
export const updateUserFcmToken = async (userItsId: string, userMohallahId: string, token: string): Promise<void> => {
    try {
        const user = await getUserByItsOrBgkId(userItsId);
        if (!user || !user.mohallahId) {
            
            return;
        }

        const userDocRef = doc(db, 'mohallahs', user.mohallahId, 'members', user.id);
        
        await updateDoc(userDocRef, {
            fcmTokens: arrayUnion(token)
        });
        

    } catch (error) {
        
    }
};

// New function to update the lastLogin timestamp and create a log entry
export const updateUserLastLogin = async (user: User): Promise<void> => {
    try {
        if (!user.id || !user.mohallahId) {
            throw new Error("User ID and Mohallah ID are required to update last login.");
        }
        
        const batch = writeBatch(db);

        // 1. Update the user's lastLogin field
        const userDocRef = doc(db, 'mohallahs', user.mohallahId, 'members', user.id);
        batch.update(userDocRef, {
            lastLogin: serverTimestamp()
        });

        // 2. Create a new document in the login_logs collection
        const logDocRef = doc(collection(db, 'login_logs'));
        batch.set(logDocRef, {
            level: 'info',
            message: `${user.name} - logged in.`,
            userItsId: user.itsId, // Direct field for querying
            timestamp: serverTimestamp(),
        });
        
        await batch.commit();

    } catch (error) {
        
        // We don't re-throw here because failing to log a login should not prevent the user from logging in.
    }
};


export const getUniqueTeamNames = async (): Promise<string[]> => {
    try {
        const allUsers = await getUsers();
        const teamNames = new Set<string>();
        allUsers.forEach(user => {
            if (user.team) {
                teamNames.add(user.team);
            }
        });
        return Array.from(teamNames).sort();
    } catch (error) {
        
        return [];
    }
};

export const getDuaAttendanceForUser = async (userItsId: string): Promise<DuaAttendance[]> => {
    try {
        const userDocRef = doc(db, 'users', userItsId);
        const duaAttendanceColRef = collection(userDocRef, 'duaAttendance');
        const q = query(duaAttendanceColRef, orderBy('weekId', 'desc'));
        
        const querySnapshot = await getDocs(q);
        const history: DuaAttendance[] = [];
        querySnapshot.forEach(docSnapshot => {
            const data = docSnapshot.data();
            const markedAt = data.markedAt instanceof Timestamp
                              ? data.markedAt.toDate().toISOString()
                              : new Date().toISOString();
            history.push({ 
                id: docSnapshot.id, 
                ...data,
                markedAt
            } as DuaAttendance);
        });
        return history;
    } catch (error) {
        console.error(`Error fetching Dua attendance for user ${userItsId}:`, error);
        throw error;
    }
};
