
'use server';

import { db } from './firebase';
import { doc, getDoc, Timestamp, getDocs, collection, query as firestoreQuery, orderBy as firestoreOrderBy } from 'firebase/firestore';
import type { AttendanceRecord, MiqaatAttendanceEntryItem, Miqaat } from '@/types';

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

    const convertTimestampToString = (timestampField: any): string => {
        if (timestampField instanceof Timestamp) {
          return timestampField.toDate().toISOString();
        }
        if (typeof timestampField === 'string') {
           return timestampField;
        }
        // Fallback for unexpected types, though markedAt should always be valid
        return new Date().toISOString(); 
      };

    return attendanceEntries.map(entry => ({
      id: `${miqaatId}-${entry.userItsId}-${entry.markedAt}`, // Synthetic ID for UI key
      miqaatId: miqaatId,
      miqaatName: miqaatData.name,
      userItsId: entry.userItsId,
      userName: entry.userName,
      markedAt: convertTimestampToString(entry.markedAt),
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
    const miqaatsCollectionRef = collection(db, 'miqaats');
    // Order by startTime desc to potentially process more recent miqaats first, though final sort is by markedAt
    const q = firestoreQuery(miqaatsCollectionRef, firestoreOrderBy('startTime', 'desc'));
    const miqaatsSnapshot = await getDocs(q);

    const convertTimestampToString = (timestampField: any): string | undefined => {
      if (timestampField instanceof Timestamp) {
        return timestampField.toDate().toISOString();
      }
      return timestampField; // Already a string or undefined
    };
    
    const allMiqaatsData: Miqaat[] = miqaatsSnapshot.docs.map((docSnapshot) => {
        const miqaatData = docSnapshot.data();
        return {
          id: docSnapshot.id,
          name: miqaatData.name,
          startTime: convertTimestampToString(miqaatData.startTime)!, 
          endTime: convertTimestampToString(miqaatData.endTime)!,   
          reportingTime: convertTimestampToString(miqaatData.reportingTime),
          teams: Array.isArray(miqaatData.teams) ? miqaatData.teams : [],
          barcodeData: miqaatData.barcodeData,
          location: miqaatData.location,
          createdAt: convertTimestampToString(miqaatData.createdAt),
          attendance: Array.isArray(miqaatData.attendance) ? miqaatData.attendance.map((att: any) => ({
              ...att,
              markedAt: convertTimestampToString(att.markedAt) || new Date().toISOString() 
          })) : [],
        } as Miqaat;
      });

    const userAttendanceRecords: AttendanceRecord[] = [];

    allMiqaatsData.forEach(miqaat => {
      if (miqaat.attendance && miqaat.attendance.length > 0) {
        miqaat.attendance.forEach(entry => {
          if (entry.userItsId === userItsId) {
            userAttendanceRecords.push({
              id: `${miqaat.id}-${entry.userItsId}-${entry.markedAt}`, // Synthetic ID
              miqaatId: miqaat.id,
              miqaatName: miqaat.name,
              userItsId: entry.userItsId,
              userName: entry.userName,
              markedAt: entry.markedAt, // Should already be a string from the mapping above
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
