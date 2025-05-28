
import { db } from './firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, Timestamp, arrayUnion, onSnapshot, Unsubscribe } from 'firebase/firestore';
import type { Miqaat, MiqaatAttendanceEntryItem } from '@/types';

const miqaatsCollectionRef = collection(db, 'miqaats');

// Modified to use onSnapshot for realtime updates
export const getMiqaats = (onUpdate: (miqaats: Pick<Miqaat, "id" | "name" | "startTime" | "endTime" | "reportingTime" | "teams" | "location" | "barcodeData" | "attendance">[]) => void): Unsubscribe => {
  const q = query(miqaatsCollectionRef, orderBy('startTime', 'desc'));
  
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const miqaats = querySnapshot.docs.map((docSnapshot) => {
      const miqaatData = docSnapshot.data();
      const convertTimestampToString = (timestampField: any): string | undefined => {
        if (timestampField instanceof Timestamp) {
          return timestampField.toDate().toISOString();
        }
        return timestampField; // Already a string or undefined
      };

      const miqaat: Pick<Miqaat, "id" | "name" | "startTime" | "endTime" | "reportingTime" | "teams" | "location" | "barcodeData" | "attendance"> = {
        id: docSnapshot.id,
        name: miqaatData.name,
        startTime: convertTimestampToString(miqaatData.startTime)!, // startTime is expected to exist
        endTime: convertTimestampToString(miqaatData.endTime)!,   // endTime is expected to exist
        reportingTime: convertTimestampToString(miqaatData.reportingTime),
        teams: Array.isArray(miqaatData.teams) ? miqaatData.teams : [],
        barcodeData: miqaatData.barcodeData,
        location: miqaatData.location,
        attendance: Array.isArray(miqaatData.attendance) ? miqaatData.attendance.map((att: any) => ({
            ...att,
            markedAt: convertTimestampToString(att.markedAt) || new Date().toISOString() // ensure markedAt is string
        })) : [],
      };
      return miqaat;
    });
    onUpdate(miqaats);
  }, (error) => {
    console.error("Error fetching miqaats with onSnapshot: ", error);
    onUpdate([]);
  });

  return unsubscribe;
};


export type MiqaatDataForAdd = Omit<Miqaat, 'id' | 'barcodeData' | 'createdAt' | 'attendance'> & { barcodeData?: string };

export const addMiqaat = async (miqaatData: MiqaatDataForAdd): Promise<Miqaat> => {
  try {
    const payload: any = {
        ...miqaatData,
        startTime: new Date(miqaatData.startTime).toISOString(),
        endTime: new Date(miqaatData.endTime).toISOString(),
        reportingTime: miqaatData.reportingTime ? new Date(miqaatData.reportingTime).toISOString() : undefined,
        teams: Array.isArray(miqaatData.teams) ? miqaatData.teams : [],
        attendance: [], 
        createdAt: serverTimestamp(),
    };
    
    // Remove reportingTime from payload if it's undefined to avoid Firestore error
    if (payload.reportingTime === undefined) delete payload.reportingTime;


    // Auto-generate barcodeData if not provided
    if (!payload.barcodeData) {
        payload.barcodeData = `MIQAAT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    }

    const docRef = await addDoc(miqaatsCollectionRef, payload);
    // Construct the return object based on what's known. `createdAt` will be a server timestamp.
    const newMiqaat: Miqaat = {
      ...miqaatData,
      id: docRef.id,
      barcodeData: payload.barcodeData,
      createdAt: new Date().toISOString(), // Placeholder, actual value is server-generated
      attendance: [],
    };
    return newMiqaat;
  } catch (error) {
    console.error("Error adding miqaat: ", error);
    throw error;
  }
};

export type MiqaatDataForUpdate = Partial<Omit<Miqaat, 'id' | 'createdAt' | 'attendance'>>;

export const updateMiqaat = async (miqaatId: string, miqaatData: MiqaatDataForUpdate): Promise<void> => {
  try {
    const miqaatDoc = doc(db, 'miqaats', miqaatId);
    const updatePayload: any = { ...miqaatData };

    // Ensure dates are ISO strings
    if (updatePayload.startTime) updatePayload.startTime = new Date(updatePayload.startTime).toISOString();
    if (updatePayload.endTime) updatePayload.endTime = new Date(updatePayload.endTime).toISOString();
    
    // Handle reportingTime: convert to ISO string if present, or set to null if explicitly empty
    if (updatePayload.reportingTime) {
      updatePayload.reportingTime = new Date(updatePayload.reportingTime).toISOString();
    } else if (updatePayload.hasOwnProperty('reportingTime') && !updatePayload.reportingTime) {
      // If reportingTime is an empty string or null from form, store as null
      updatePayload.reportingTime = null; 
    }


    // Ensure teams is an array
    if (updatePayload.teams && !Array.isArray(updatePayload.teams)) {
        updatePayload.teams = [];
    }
    
    // These fields should not be updated directly
    delete updatePayload.createdAt;
    delete updatePayload.id;
    delete updatePayload.attendance;

    await updateDoc(miqaatDoc, updatePayload);
  } catch (error) {
    console.error("Error updating miqaat: ", error);
    throw error;
  }
};

export const deleteMiqaat = async (miqaatId: string): Promise<void> => {
  try {
    const miqaatDoc = doc(db, 'miqaats', miqaatId);
    await deleteDoc(miqaatDoc);
  } catch (error) {
    console.error("Error deleting miqaat: ", error);
    throw error;
  }
};

// Function to add an attendance entry to a Miqaat's 'attendance' array
export const markAttendanceInMiqaat = async (miqaatId: string, entry: MiqaatAttendanceEntryItem): Promise<void> => {
  try {
    const miqaatDocRef = doc(db, 'miqaats', miqaatId);
    // Atomically add the new attendance entry to the 'attendance' array
    await updateDoc(miqaatDocRef, {
      attendance: arrayUnion(entry)
    });
  } catch (error) {
    console.error("Error marking attendance in Miqaat document: ", error);
    throw error;
  }
};
