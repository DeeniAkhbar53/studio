
'use server';

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
        return timestampField;
      };

      const miqaat: Pick<Miqaat, "id" | "name" | "startTime" | "endTime" | "reportingTime" | "teams" | "location" | "barcodeData" | "attendance"> = {
        id: docSnapshot.id,
        name: miqaatData.name,
        startTime: convertTimestampToString(miqaatData.startTime)!,
        endTime: convertTimestampToString(miqaatData.endTime)!,
        reportingTime: convertTimestampToString(miqaatData.reportingTime),
        teams: Array.isArray(miqaatData.teams) ? miqaatData.teams : [],
        barcodeData: miqaatData.barcodeData,
        location: miqaatData.location,
        attendance: Array.isArray(miqaatData.attendance) ? miqaatData.attendance.map((att: any) => ({
            ...att,
            markedAt: convertTimestampToString(att.markedAt) || new Date().toISOString()
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
    
    if (payload.reportingTime === undefined) delete payload.reportingTime;


    if (!payload.barcodeData) {
        payload.barcodeData = `MIQAAT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    }

    const docRef = await addDoc(miqaatsCollectionRef, payload);
    return {
      ...miqaatData,
      id: docRef.id,
      barcodeData: payload.barcodeData,
      attendance: [],
      // createdAt will be a server timestamp
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

    if (updatePayload.startTime) updatePayload.startTime = new Date(updatePayload.startTime).toISOString();
    if (updatePayload.endTime) updatePayload.endTime = new Date(updatePayload.endTime).toISOString();
    if (updatePayload.reportingTime) updatePayload.reportingTime = new Date(updatePayload.reportingTime).toISOString();
    else if (updatePayload.hasOwnProperty('reportingTime') && !updatePayload.reportingTime) {
       // If reportingTime is explicitly set to empty/null, remove it
      updatePayload.reportingTime = null; // Or use delete updatePayload.reportingTime based on Firestore preference
    }


    if (updatePayload.teams && !Array.isArray(updatePayload.teams)) {
        updatePayload.teams = [];
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

