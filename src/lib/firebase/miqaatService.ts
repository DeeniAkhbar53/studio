
import { db } from './firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, Timestamp, arrayUnion, onSnapshot, Unsubscribe, writeBatch, runTransaction } from 'firebase/firestore';
import type { Miqaat, MiqaatAttendanceEntryItem, MiqaatSafarEntryItem } from '@/types';

const miqaatsCollectionRef = collection(db, 'miqaats');

export const getMiqaats = (onUpdate: (miqaats: Pick<Miqaat, "id" | "name" | "startTime" | "endTime" | "reportingTime" | "mohallahIds" | "teams" | "eligibleItsIds" | "location" | "barcodeData" | "attendance" | "safarList" | "createdAt" | "attendedUserItsIds" | "attendanceRequirements">[]) => void): Unsubscribe => {
  const q = query(miqaatsCollectionRef, orderBy('createdAt', 'desc'));

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const miqaats = querySnapshot.docs.map((docSnapshot) => {
      const miqaatData = docSnapshot.data();
      const convertTimestampToString = (timestampField: any): string | undefined => {
        if (timestampField instanceof Timestamp) {
          return timestampField.toDate().toISOString();
        }
        return timestampField;
      };

      const miqaat: Pick<Miqaat, "id" | "name" | "startTime" | "endTime" | "reportingTime" | "mohallahIds" | "teams" | "eligibleItsIds" | "location" | "barcodeData" | "attendance" | "safarList" | "createdAt" | "attendedUserItsIds" | "attendanceRequirements"> = {
        id: docSnapshot.id,
        name: miqaatData.name,
        startTime: convertTimestampToString(miqaatData.startTime)!,
        endTime: convertTimestampToString(miqaatData.endTime)!,
        reportingTime: convertTimestampToString(miqaatData.reportingTime),
        mohallahIds: Array.isArray(miqaatData.mohallahIds) ? miqaatData.mohallahIds : [],
        teams: Array.isArray(miqaatData.teams) ? miqaatData.teams : [],
        eligibleItsIds: Array.isArray(miqaatData.eligibleItsIds) ? miqaatData.eligibleItsIds : [],
        barcodeData: miqaatData.barcodeData,
        location: miqaatData.location,
        createdAt: convertTimestampToString(miqaatData.createdAt),
        attendance: Array.isArray(miqaatData.attendance) ? miqaatData.attendance.map((att: any) => ({
            ...att,
            markedAt: convertTimestampToString(att.markedAt) || new Date().toISOString()
        })) : [],
        safarList: Array.isArray(miqaatData.safarList) ? miqaatData.safarList.map((safar: any) => ({
            ...safar,
            markedAt: convertTimestampToString(safar.markedAt) || new Date().toISOString()
        })) : [],
        attendedUserItsIds: Array.isArray(miqaatData.attendedUserItsIds) ? miqaatData.attendedUserItsIds : [],
        attendanceRequirements: miqaatData.attendanceRequirements || { fetaPaghri: false, koti: false, nazrulMaqam: false },
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

export type MiqaatDataForAdd = Omit<Miqaat, 'id' | 'createdAt' | 'attendance' | 'safarList' | 'attendedUserItsIds'>;

export const addMiqaat = async (miqaatData: MiqaatDataForAdd): Promise<Miqaat> => {
  try {
    const firestorePayload: { [key: string]: any } = {
        name: miqaatData.name,
        startTime: new Date(miqaatData.startTime).toISOString(),
        endTime: new Date(miqaatData.endTime).toISOString(),
        mohallahIds: Array.isArray(miqaatData.mohallahIds) ? miqaatData.mohallahIds : [],
        teams: Array.isArray(miqaatData.teams) ? miqaatData.teams : [],
        eligibleItsIds: Array.isArray(miqaatData.eligibleItsIds) ? miqaatData.eligibleItsIds : [],
        attendance: [],
        safarList: [],
        attendedUserItsIds: [], // Initialize new field
        attendanceRequirements: miqaatData.attendanceRequirements || { fetaPaghri: false, koti: false, nazrulMaqam: false },
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
      eligibleItsIds: firestorePayload.eligibleItsIds,
      attendance: firestorePayload.attendance,
      safarList: firestorePayload.safarList,
      attendedUserItsIds: firestorePayload.attendedUserItsIds,
      attendanceRequirements: firestorePayload.attendanceRequirements,
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

export type MiqaatDataForUpdate = Partial<Omit<Miqaat, 'id' | 'createdAt' | 'attendance' | 'safarList' | 'attendedUserItsIds'>>;

export const updateMiqaat = async (miqaatId: string, miqaatData: MiqaatDataForUpdate): Promise<void> => {
  try {
    const miqaatDoc = doc(db, 'miqaats', miqaatId);
    const firestorePayload: { [key: string]: any } = {};

    if (miqaatData.name !== undefined) firestorePayload.name = miqaatData.name;
    if (miqaatData.startTime !== undefined) firestorePayload.startTime = new Date(miqaatData.startTime).toISOString();
    if (miqaatData.endTime !== undefined) firestorePayload.endTime = new Date(miqaatData.endTime).toISOString();
    if (miqaatData.mohallahIds !== undefined) firestorePayload.mohallahIds = Array.isArray(miqaatData.mohallahIds) ? miqaatData.mohallahIds : [];
    if (miqaatData.teams !== undefined) firestorePayload.teams = Array.isArray(miqaatData.teams) ? miqaatData.teams : [];
    if (miqaatData.eligibleItsIds !== undefined) firestorePayload.eligibleItsIds = Array.isArray(miqaatData.eligibleItsIds) ? miqaatData.eligibleItsIds : [];
    if (miqaatData.attendanceRequirements !== undefined) firestorePayload.attendanceRequirements = miqaatData.attendanceRequirements;

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
        // This assumes no subcollections anymore. If there were, they would need cleanup.
        await deleteDoc(miqaatDoc);
    } catch (error) {
        console.error("Error deleting miqaat: ", error);
        throw error;
    }
};

export const markAttendanceInMiqaat = async (miqaatId: string, entry: MiqaatAttendanceEntryItem): Promise<void> => {
  const miqaatDocRef = doc(db, 'miqaats', miqaatId);
  try {
      await runTransaction(db, async (transaction) => {
          const miqaatDoc = await transaction.get(miqaatDocRef);
          if (!miqaatDoc.exists()) {
              throw new Error("Miqaat does not exist!");
          }

          // Check if user is already in the attendance array
          const currentAttendance = miqaatDoc.data().attendance || [];
          const alreadyExists = currentAttendance.some((e: MiqaatAttendanceEntryItem) => e.userItsId === entry.userItsId);

          if (alreadyExists) {
              console.log(`User ${entry.userItsId} already marked for miqaat ${miqaatId}. Skipping.`);
              return;
          }

          transaction.update(miqaatDocRef, {
              attendance: arrayUnion(entry),
              attendedUserItsIds: arrayUnion(entry.userItsId)
          });
      });
  } catch (error) {
    console.error("Error marking attendance in Miqaat document: ", error);
    throw error;
  }
};

export const batchMarkSafarInMiqaat = async (miqaatId: string, entries: MiqaatSafarEntryItem[]): Promise<void> => {
    if (entries.length === 0) {
        return;
    }
    
    const miqaatDocRef = doc(db, 'miqaats', miqaatId);

    try {
        await runTransaction(db, async (transaction) => {
            const miqaatDoc = await transaction.get(miqaatDocRef);
            if (!miqaatDoc.exists()) {
                throw new Error("Miqaat does not exist!");
            }
            
            const existingSafarList: MiqaatSafarEntryItem[] = miqaatDoc.data().safarList || [];
            const existingItsIdsInSafar = new Set(existingSafarList.map(e => e.userItsId));
            
            const newEntries = entries.filter(entry => !existingItsIdsInSafar.has(entry.userItsId));
            
            if (newEntries.length === 0) {
                console.log("All selected members already in Safar list for this Miqaat.");
                return;
            }

            const safarUserItsIdsToAdd = newEntries.map(e => e.userItsId);

            transaction.update(miqaatDocRef, {
                safarList: arrayUnion(...newEntries),
                attendedUserItsIds: arrayUnion(...safarUserItsIdsToAdd)
            });

            console.log(`Transactionally updating Miqaat ${miqaatId} with ${newEntries.length} new Safar records.`);
        });
    } catch (error) {
        console.error(`Error during batch Safar update for Miqaat ${miqaatId}:`, error);
        throw error;
    }
};
