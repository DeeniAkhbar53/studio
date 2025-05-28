
'use server';

import { db } from './firebase';
import { doc, getDoc, Timestamp, getDocs, collection, query as firestoreQuery, orderBy as firestoreOrderBy } from 'firebase/firestore';
import type { AttendanceRecord, MiqaatAttendanceEntryItem, Miqaat } from '@/types';
import { getMiqaats } from './miqaatService'; // To fetch all miqaats for user history

// This function now gets attendance from *within* a Miqaat document
export const getAttendanceRecordsByMiqaat = async (miqaatId: string): Promise<AttendanceRecord[]> => {
  try {
    const miqaatDocRef = doc(db, 'miqaats', miqaatId);
    const miqaatDocSnap = await getDoc(miqaatDocRef);

    if (!miqaatDocSnap.exists()) {
      console.warn(`Miqaat document with ID ${miqaatId} not found.`);
      return [];
    }

    const miqaatData = miqaatDocSnap.data() as Miqaat;
    const attendanceEntries = miqaatData.attendance || [];

    return attendanceEntries.map(entry => ({
      id: `${miqaatId}-${entry.userItsId}-${entry.markedAt}`, // Synthetic ID for UI key
      miqaatId: miqaatId,
      miqaatName: miqaatData.name,
      userItsId: entry.userItsId,
      userName: entry.userName,
      markedAt: entry.markedAt,
      markedByItsId: entry.markedByItsId,
    }));
  } catch (error) {
    console.error(`Error fetching attendance records for Miqaat ${miqaatId}: `, error);
    throw error;
  }
};

// This function now fetches all Miqaats and filters their attendance arrays
export const getAttendanceRecordsByUser = async (userItsId: string): Promise<AttendanceRecord[]> => {
  try {
    const allMiqaats = await getMiqaats(); // Fetches all Miqaats
    const userAttendanceRecords: AttendanceRecord[] = [];

    allMiqaats.forEach(miqaat => {
      if (miqaat.attendance && miqaat.attendance.length > 0) {
        miqaat.attendance.forEach(entry => {
          if (entry.userItsId === userItsId) {
            userAttendanceRecords.push({
              id: `${miqaat.id}-${entry.userItsId}-${entry.markedAt}`, // Synthetic ID
              miqaatId: miqaat.id,
              miqaatName: miqaat.name,
              userItsId: entry.userItsId,
              userName: entry.userName,
              markedAt: entry.markedAt,
              markedByItsId: entry.markedByItsId,
            });
          }
        });
      }
    });

    // Sort by markedAt date, most recent first
    return userAttendanceRecords.sort((a, b) => new Date(b.markedAt).getTime() - new Date(a.markedAt).getTime());
  } catch (error) {
    console.error(`Error fetching attendance records for User ITS ID ${userItsId}: `, error);
    throw error;
  }
};
