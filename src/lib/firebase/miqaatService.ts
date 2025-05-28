
'use server';

import { db } from './firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, Timestamp } from 'firebase/firestore';
import type { Miqaat } from '@/types';

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
        startTime: miqaatData.startTime, // Already a string from form
        endTime: miqaatData.endTime,     // Already a string from form
        teams: miqaatData.teams || [],
        barcodeData: miqaatData.barcodeData,
        location: miqaatData.location,
        createdAt: miqaatData.createdAt instanceof Timestamp ? miqaatData.createdAt.toDate().toISOString() : undefined,
      };
      return miqaat;
    });
  } catch (error) {
    console.error("Error fetching miqaats: ", error);
    throw error;
  }
};

export type MiqaatDataForAdd = Omit<Miqaat, 'id' | 'barcodeData' | 'createdAt'> & { barcodeData?: string };

export const addMiqaat = async (miqaatData: MiqaatDataForAdd): Promise<Miqaat> => {
  try {
    const payload: any = {
        ...miqaatData,
        teams: Array.isArray(miqaatData.teams) ? miqaatData.teams : [],
        createdAt: serverTimestamp(),
    };
    if (!payload.barcodeData) {
        // Generate a unique enough barcode, e.g., using timestamp
        payload.barcodeData = `MIQAAT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    }

    const docRef = await addDoc(miqaatsCollectionRef, payload);
    // Return a Miqaat object consistent with the type, though createdAt will be undefined until fetched again
    return {
      ...miqaatData,
      id: docRef.id,
      barcodeData: payload.barcodeData,
      // createdAt is not available from serverTimestamp() immediately
    } as Miqaat; // Cast as Miqaat; createdAt will be undefined here
  } catch (error) {
    console.error("Error adding miqaat: ", error);
    throw error;
  }
};

export type MiqaatDataForUpdate = Partial<Omit<Miqaat, 'id' | 'createdAt'>>;

export const updateMiqaat = async (miqaatId: string, miqaatData: MiqaatDataForUpdate): Promise<void> => {
  try {
    const miqaatDoc = doc(db, 'miqaats', miqaatId);
    const updatePayload: any = { ...miqaatData };
     // Ensure teams is an array if provided
    if (updatePayload.teams && !Array.isArray(updatePayload.teams)) {
        updatePayload.teams = []; // Or handle as error, or parse if it's a string
    }
    // Remove 'createdAt' and 'id' if they somehow got into miqaatData
    delete updatePayload.createdAt;
    delete updatePayload.id;

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
