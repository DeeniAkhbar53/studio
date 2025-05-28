
import { db } from './firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, Timestamp, arrayUnion, onSnapshot, Unsubscribe } from 'firebase/firestore';
import type { Miqaat, MiqaatAttendanceEntryItem } from '@/types';

const miqaatsCollectionRef = collection(db, 'miqaats');

export const getMiqaats = (onUpdate: (miqaats: Pick<Miqaat, "id" | "name" | "startTime" | "endTime" | "reportingTime" | "mohallahIds" | "location" | "barcodeData" | "attendance" | "createdAt">[]) => void): Unsubscribe => {
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

      const miqaat: Pick<Miqaat, "id" | "name" | "startTime" | "endTime" | "reportingTime" | "mohallahIds" | "location" | "barcodeData" | "attendance" | "createdAt"> = {
        id: docSnapshot.id,
        name: miqaatData.name,
        startTime: convertTimestampToString(miqaatData.startTime)!,
        endTime: convertTimestampToString(miqaatData.endTime)!,
        reportingTime: convertTimestampToString(miqaatData.reportingTime),
        mohallahIds: Array.isArray(miqaatData.mohallahIds) ? miqaatData.mohallahIds : [],
        barcodeData: miqaatData.barcodeData,
        location: miqaatData.location,
        createdAt: convertTimestampToString(miqaatData.createdAt),
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


export type MiqaatDataForAdd = Omit<Miqaat, 'id' | 'createdAt' | 'attendance'>;

export const addMiqaat = async (miqaatData: MiqaatDataForAdd): Promise<Miqaat> => {
  try {
    const firestorePayload: { [key: string]: any } = {
        name: miqaatData.name,
        startTime: new Date(miqaatData.startTime).toISOString(),
        endTime: new Date(miqaatData.endTime).toISOString(),
        mohallahIds: Array.isArray(miqaatData.mohallahIds) ? miqaatData.mohallahIds : [],
        attendance: [], // Initialize attendance as an empty array
        createdAt: serverTimestamp(),
    };

    // Only add optional fields if they have a valid, non-empty string value
    if (typeof miqaatData.location === 'string' && miqaatData.location.trim() !== "") {
      firestorePayload.location = miqaatData.location;
    }
    
    if (typeof miqaatData.reportingTime === 'string' && miqaatData.reportingTime) {
      // Check if it's a non-empty string that can be parsed as a date
      const reportingDate = new Date(miqaatData.reportingTime);
      if (!isNaN(reportingDate.getTime())) {
        firestorePayload.reportingTime = reportingDate.toISOString();
      }
    }
    
    if (typeof miqaatData.barcodeData === 'string' && miqaatData.barcodeData.trim() !== "") {
      firestorePayload.barcodeData = miqaatData.barcodeData;
    } else if (!miqaatData.barcodeData || (typeof miqaatData.barcodeData === 'string' && miqaatData.barcodeData.trim() === "")) {
      // Auto-generate barcodeData if it's not provided or is an empty string
      firestorePayload.barcodeData = `MIQAAT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    }

    const docRef = await addDoc(miqaatsCollectionRef, firestorePayload);
    
    // Construct the return object based on what was actually saved or generated
    const newMiqaat: Miqaat = {
      id: docRef.id,
      name: firestorePayload.name,
      startTime: firestorePayload.startTime,
      endTime: firestorePayload.endTime,
      mohallahIds: firestorePayload.mohallahIds,
      attendance: firestorePayload.attendance,
      createdAt: new Date().toISOString(), // Approximate, actual is serverTimestamp
      location: firestorePayload.location, // Will be undefined if not in firestorePayload
      reportingTime: firestorePayload.reportingTime, // Will be undefined if not in firestorePayload
      barcodeData: firestorePayload.barcodeData, // Will be undefined if not in firestorePayload (unless auto-generated)
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
    const firestorePayload: { [key: string]: any } = {};

    // Add fields to payload only if they are provided in miqaatData (not undefined)
    if (miqaatData.name !== undefined) firestorePayload.name = miqaatData.name;
    if (miqaatData.startTime !== undefined) firestorePayload.startTime = new Date(miqaatData.startTime).toISOString();
    if (miqaatData.endTime !== undefined) firestorePayload.endTime = new Date(miqaatData.endTime).toISOString();
    
    // For optional fields, if the key exists in miqaatData, process it.
    // This allows clearing a field by passing an empty string.
    if (miqaatData.hasOwnProperty('location')) {
        firestorePayload.location = (typeof miqaatData.location === 'string' && miqaatData.location.trim() !== "") ? miqaatData.location : null;
    }
    if (miqaatData.hasOwnProperty('reportingTime')) {
        const reportingDate = miqaatData.reportingTime ? new Date(miqaatData.reportingTime) : null;
        firestorePayload.reportingTime = (reportingDate && !isNaN(reportingDate.getTime())) ? reportingDate.toISOString() : null;
    }
     if (miqaatData.hasOwnProperty('barcodeData')) {
        firestorePayload.barcodeData = (typeof miqaatData.barcodeData === 'string' && miqaatData.barcodeData.trim() !== "") ? miqaatData.barcodeData : null;
    }
    if (miqaatData.mohallahIds !== undefined) {
      firestorePayload.mohallahIds = Array.isArray(miqaatData.mohallahIds) ? miqaatData.mohallahIds : [];
    }
    
    if (Object.keys(firestorePayload).length > 0) {
        await updateDoc(miqaatDoc, firestorePayload);
    } else {
        // console.log("No fields to update for Miqaat:", miqaatId);
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
    await updateDoc(miqaatDocRef, {
      attendance: arrayUnion(entry)
    });
  } catch (error) {
    console.error("Error marking attendance in Miqaat document: ", error);
    throw error;
  }
};

    