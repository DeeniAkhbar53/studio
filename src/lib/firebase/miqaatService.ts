
'use server';

import { db } from './firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, Timestamp, arrayUnion } from 'firebase/firestore';
import type { Miqaat, MiqaatAttendanceEntryItem } from '@/types';

const miqaatsCollectionRef = collection(db, 'miqaats');

export const getMiqaats = async (): Promise<Pick<Miqaat, "id" | "name" | "startTime" | "endTime" | "reportingTime" | "teams" | "location" | "barcodeData" | "attendance">[]> => {
  try {
    const q = query(miqaatsCollectionRef, orderBy('startTime', 'desc'));
    const data = await getDocs(q);
    return data.docs.map((docSnapshot) => {
      const miqaatData = docSnapshot.data();
      // Ensure all date fields are converted to ISO strings if they are Timestamps
      const convertTimestampToString = (timestampField: any): string | undefined => {
        if (timestampField instanceof Timestamp) {
          return timestampField.toDate().toISOString();
        }
        return timestampField; // Assumes it's already a string or undefined
      };

      const miqaat: Pick<Miqaat, "id" | "name" | "startTime" | "endTime" | "reportingTime" | "teams" | "location" | "barcodeData" | "attendance"> = {
        id: docSnapshot.id,
        name: miqaatData.name,
        startTime: convertTimestampToString(miqaatData.startTime)!, // startTime should always exist
        endTime: convertTimestampToString(miqaatData.endTime)!,   // endTime should always exist
        reportingTime: convertTimestampToString(miqaatData.reportingTime),
        teams: Array.isArray(miqaatData.teams) ? miqaatData.teams : [],
        barcodeData: miqaatData.barcodeData,
        location: miqaatData.location,
        // createdAt: convertTimestampToString(miqaatData.createdAt), // Not explicitly requested for return Pick type
        attendance: Array.isArray(miqaatData.attendance) ? miqaatData.attendance.map((att: any) => ({
            ...att,
            markedAt: convertTimestampToString(att.markedAt) || new Date().toISOString() // ensure markedAt is string
        })) : [],
      };
      return miqaat;
    });
  } catch (error) {
    console.error("Error fetching miqaats: ", error);
    throw error;
  }
};

export type MiqaatDataForAdd = Omit<Miqaat, 'id' | 'barcodeData' | 'createdAt' | 'attendance'> & { barcodeData?: string };

export const addMiqaat = async (miqaatData: MiqaatDataForAdd): Promise<Miqaat> => {
  try {
    const payload: any = {
        ...miqaatData,
        teams: Array.isArray(miqaatData.teams) ? miqaatData.teams : [],
        attendance: [], // Initialize with an empty attendance array
        createdAt: serverTimestamp(),
    };
    if (miqaatData.reportingTime) {
        payload.reportingTime = miqaatData.reportingTime;
    }
    if (!payload.barcodeData) {
        // Generate a unique ID for barcodeData if not provided
        payload.barcodeData = `MIQAAT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    }

    const docRef = await addDoc(miqaatsCollectionRef, payload);
    return {
      ...miqaatData,
      id: docRef.id,
      barcodeData: payload.barcodeData,
      attendance: [],
      // createdAt will be a server timestamp, not directly usable as string here without re-fetch
    } as Miqaat;
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

    if (updatePayload.teams && !Array.isArray(updatePayload.teams)) {
        updatePayload.teams = [];
    }
     if (updatePayload.reportingTime === "") { // Handle empty string for optional field
      updatePayload.reportingTime = null; // or delete updatePayload.reportingTime;
    }


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
    await updateDoc(miqaatDocRef, {
      attendance: arrayUnion(entry)
    });
  } catch (error) {
    console.error("Error marking attendance in Miqaat document: ", error);
    throw error;
  }
};
