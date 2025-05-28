
'use server';

import { db } from './firebase';
import { collection, addDoc, serverTimestamp, Timestamp, query, where, getDocs, orderBy } from 'firebase/firestore';
import type { AttendanceRecord } from '@/types';

const attendanceCollectionRef = collection(db, 'attendanceRecords');

export type AttendanceDataForAdd = Omit<AttendanceRecord, 'id' | 'markedAt'> & {
    markedByItsId?: string;
};

export const addAttendanceRecord = async (recordData: AttendanceDataForAdd): Promise<string> => {
  try {
    const docRef = await addDoc(attendanceCollectionRef, {
      ...recordData,
      markedAt: serverTimestamp(), // Use Firestore server timestamp
    });
    return docRef.id; // Return the ID of the newly created document
  } catch (error) {
    console.error("Error adding attendance record: ", error);
    throw error;
  }
};

export const getAttendanceRecordsByMiqaat = async (miqaatId: string): Promise<AttendanceRecord[]> => {
  try {
    const q = query(attendanceCollectionRef, where("miqaatId", "==", miqaatId), orderBy("markedAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        markedAt: (data.markedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(), 
      } as AttendanceRecord;
    });
  } catch (error) {
    console.error("Error fetching attendance records by Miqaat: ", error);
    throw error;
  }
};

export const getAttendanceRecordsByUser = async (userItsId: string): Promise<AttendanceRecord[]> => {
  try {
    const q = query(attendanceCollectionRef, where("userItsId", "==", userItsId), orderBy("markedAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        markedAt: (data.markedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      } as AttendanceRecord;
    });
  } catch (error) {
    console.error("Error fetching attendance records by User ITS ID: ", error);
    throw error;
  }
};
