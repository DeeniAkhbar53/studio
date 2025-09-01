
import { db } from './firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, Timestamp, arrayUnion, onSnapshot, Unsubscribe, writeBatch } from 'firebase/firestore';
import type { Miqaat, MiqaatAttendanceEntryItem } from '@/types';

const miqaatsCollectionRef = collection(db, 'miqaats');

export const getMiqaats = (onUpdate: (miqaats: Pick<Miqaat, "id" | "name" | "startTime" | "endTime" | "reportingTime" | "mohallahIds" | "teams" | "location" | "barcodeData" | "attendance" | "createdAt" | "attendedUserItsIds" | "uniformRequirements">[]) => void): Unsubscribe => {
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

      const miqaat: Pick<Miqaat, "id" | "name" | "startTime" | "endTime" | "reportingTime" | "mohallahIds" | "teams" | "location" | "barcodeData" | "attendance" | "createdAt" | "attendedUserItsIds" | "uniformRequirements"> = {
        id: docSnapshot.id,
        name: miqaatData.name,
        startTime: convertTimestampToString(miqaatData.startTime)!,
        endTime: convertTimestampToString(miqaatData.endTime)!,
        reportingTime: convertTimestampToString(miqaatData.reportingTime),
        mohallahIds: Array.isArray(miqaatData.mohallahIds) ? miqaatData.mohallahIds : [],
        teams: Array.isArray(miqaatData.teams) ? miqaatData.teams : [],
        barcodeData: miqaatData.barcodeData,
        location: miqaatData.location,
        createdAt: convertTimestampToString(miqaatData.createdAt),
        attendance: Array.isArray(miqaatData.attendance) ? miqaatData.attendance.map((att: any) => ({
            ...att,
            markedAt: convertTimestampToString(att.markedAt) || new Date().toISOString()
        })) : [],
        attendedUserItsIds: Array.isArray(miqaatData.attendedUserItsIds) ? miqaatData.attendedUserItsIds : [],
        uniformRequirements: miqaatData.uniformRequirements || { fetaPaghri: false, koti: false },
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

export type MiqaatDataForAdd = Omit<Miqaat, 'id' | 'createdAt' | 'attendance' | 'attendedUserItsIds'>;

export const addMiqaat = async (miqaatData: MiqaatDataForAdd): Promise<Miqaat> => {
  try {
    const firestorePayload: { [key: string]: any } = {
        name: miqaatData.name,
        startTime: new Date(miqaatData.startTime).toISOString(),
        endTime: new Date(miqaatData.endTime).toISOString(),
        mohallahIds: Array.isArray(miqaatData.mohallahIds) ? miqaatData.mohallahIds : [],
        teams: Array.isArray(miqaatData.teams) ? miqaatData.teams : [],
        attendance: [],
        attendedUserItsIds: [], // Initialize new field
        uniformRequirements: miqaatData.uniformRequirements || { fetaPaghri: false, koti: false },
        createdAt: serverTimestamp(),
    };

    if (miqaatData.location && miqaatData.location.trim() !== "") {
      firestorePayload.location = miqaatData.location;
    }
    if (miqaatData.reportingTime && miqaatData.reportingTime.trim() !== "") {
      const reportingDate = new Date(miqaatData.reportingTime);
      if (!isNaN(reportingDate.getTime())) {
        firestorePayload.reportingTime = reportingDate.toISOString();
      }
    }
    if (miqaatData.barcodeData && miqaatData.barcodeData.trim() !== "") {
      firestorePayload.barcodeData = miqaatData.barcodeData;
    } else {
      firestorePayload.barcodeData = `MIQAAT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    }

    const docRef = await addDoc(miqaatsCollectionRef, firestorePayload);

    const newMiqaat: Miqaat = {
      id: docRef.id,
      name: firestorePayload.name,
      startTime: firestorePayload.startTime,
      endTime: firestorePayload.endTime,
      mohallahIds: firestorePayload.mohallahIds,
      teams: firestorePayload.teams,
      attendance: firestorePayload.attendance,
      attendedUserItsIds: firestorePayload.attendedUserItsIds,
      uniformRequirements: firestorePayload.uniformRequirements,
      createdAt: new Date().toISOString(),
      location: firestorePayload.location,
      reportingTime: firestorePayload.reportingTime,
      barcodeData: firestorePayload.barcodeData,
    };
    return newMiqaat;
  } catch (error) {
    console.error("Error adding miqaat: ", error);
    throw error;
  }
};

export type MiqaatDataForUpdate = Partial<Omit<Miqaat, 'id' | 'createdAt' | 'attendance' | 'attendedUserItsIds'>>;

export const updateMiqaat = async (miqaatId: string, miqaatData: MiqaatDataForUpdate): Promise<void> => {
  try {
    const miqaatDoc = doc(db, 'miqaats', miqaatId);
    const firestorePayload: { [key: string]: any } = {};

    if (miqaatData.name !== undefined) firestorePayload.name = miqaatData.name;
    if (miqaatData.startTime !== undefined) firestorePayload.startTime = new Date(miqaatData.startTime).toISOString();
    if (miqaatData.endTime !== undefined) firestorePayload.endTime = new Date(miqaatData.endTime).toISOString();
    if (miqaatData.mohallahIds !== undefined) firestorePayload.mohallahIds = Array.isArray(miqaatData.mohallahIds) ? miqaatData.mohallahIds : [];
    if (miqaatData.teams !== undefined) firestorePayload.teams = Array.isArray(miqaatData.teams) ? miqaatData.teams : [];
    if (miqaatData.uniformRequirements !== undefined) firestorePayload.uniformRequirements = miqaatData.uniformRequirements;

    if (miqaatData.hasOwnProperty('location')) {
        firestorePayload.location = (typeof miqaatData.location === 'string' && miqaatData.location.trim() !== "") ? miqaatData.location : null;
    }
    if (miqaatData.hasOwnProperty('reportingTime')) {
        const reportingDate = miqaatData.reportingTime && miqaatData.reportingTime.trim() !== "" ? new Date(miqaatData.reportingTime) : null;
        firestorePayload.reportingTime = (reportingDate && !isNaN(reportingDate.getTime())) ? reportingDate.toISOString() : null;
    }
    if (miqaatData.hasOwnProperty('barcodeData')) {
        firestorePayload.barcodeData = (typeof miqaatData.barcodeData === 'string' && miqaatData.barcodeData.trim() !== "") ? miqaatData.barcodeData : null;
    }

    if (Object.keys(firestorePayload).length > 0) {
        await updateDoc(miqaatDoc, firestorePayload);
    }
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
    // and the user's ITS ID to the 'attendedUserItsIds' array
    await updateDoc(miqaatDocRef, {
      attendance: arrayUnion(entry),
      attendedUserItsIds: arrayUnion(entry.userItsId)
    });
  } catch (error) {
    console.error("Error marking attendance in Miqaat document: ", error);
    throw error;
  }
};

export const batchMarkAttendanceInMiqaat = async (miqaatId: string, entries: MiqaatAttendanceEntryItem[]): Promise<void> => {
    if (entries.length === 0) {
        return;
    }

    try {
        const miqaatDocRef = doc(db, 'miqaats', miqaatId);
        
        // Firestore batches have a limit of 500 operations. arrayUnion is one operation.
        // If you expect more than 500 entries at once, you will need to split this into multiple batches.
        // For now, we assume a reasonable number of offline entries per sync.
        const batch = writeBatch(db);

        const attendedUserItsIds = entries.map(e => e.userItsId);

        batch.update(miqaatDocRef, {
            attendance: arrayUnion(...entries),
            attendedUserItsIds: arrayUnion(...attendedUserItsIds)
        });

        await batch.commit();
        console.log(`Successfully batch-updated ${entries.length} attendance records for Miqaat ${miqaatId}.`);
    } catch (error) {
        console.error(`Error during batch attendance update for Miqaat ${miqaatId}:`, error);
        throw error;
    }
};

    