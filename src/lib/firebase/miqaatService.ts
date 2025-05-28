
'use server';

import { db } from './firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, Timestamp, FieldValue } from 'firebase/firestore';
import type { Miqaat, MiqaatAttendanceEntryItem } from '@/types';

const miqaatsCollectionRef = collection(db, 'miqaats');

export const getMiqaats = async (): Promise<Miqaat[]> => {
  try {
    const q = query(miqaatsCollectionRef, orderBy('startTime', 'desc'));
    const data = await getDocs(q);
    return data.docs.map((docSnapshot) => {
      const miqaatData = docSnapshot.data();
      const miqaat: Miqaat = {
        id: docSnapshot.id,
        name: miqaatData.name,
        startTime: miqaatData.startTime, 
        endTime: miqaatData.endTime,     
        teams: Array.isArray(miqaatData.teams) ? miqaatData.teams : [],
        barcodeData: miqaatData.barcodeData,
        location: miqaatData.location,
        createdAt: miqaatData.createdAt instanceof Timestamp ? miqaatData.createdAt.toDate().toISOString() : undefined,
        attendance: Array.isArray(miqaatData.attendance) ? miqaatData.attendance : [], // Ensure attendance is an array
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
    if (!payload.barcodeData) {
        payload.barcodeData = `MIQAAT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    }

    const docRef = await addDoc(miqaatsCollectionRef, payload);
    return {
      ...miqaatData,
      id: docRef.id,
      barcodeData: payload.barcodeData,
      attendance: [],
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
    delete updatePayload.createdAt;
    delete updatePayload.id;
    delete updatePayload.attendance; // Attendance is managed by a separate function

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

export const markAttendanceInMiqaat = async (miqaatId: string, entry: MiqaatAttendanceEntryItem): Promise<void> => {
  try {
    const miqaatDocRef = doc(db, 'miqaats', miqaatId);
    // Atomically add the new attendance entry to the 'attendance' array
    await updateDoc(miqaatDocRef, {
      attendance: FieldValue.arrayUnion(entry)
    });
  } catch (error) {
    console.error("Error marking attendance in Miqaat document: ", error);
    throw error;
  }
};
