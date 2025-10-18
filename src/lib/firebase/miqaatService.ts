import { db } from './firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, Timestamp, arrayUnion, onSnapshot, Unsubscribe, writeBatch, runTransaction } from 'firebase/firestore';
import type { Miqaat, MiqaatAttendanceEntryItem, MiqaatSafarEntryItem, MiqaatSession } from '@/types';
import { addAuditLog } from './auditLogService';

const miqaatsCollectionRef = collection(db, 'miqaats');

export const getMiqaats = (onUpdate: (miqaats: Miqaat[]) => void): Unsubscribe => {
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

      const miqaat: Miqaat = {
        id: docSnapshot.id,
        name: miqaatData.name,
        type: miqaatData.type || 'local',
        attendanceType: miqaatData.attendanceType,
        startTime: convertTimestampToString(miqaatData.startTime)!,
        endTime: convertTimestampToString(miqaatData.endTime)!,
        reportingTime: convertTimestampToString(miqaatData.reportingTime),
        sessions: Array.isArray(miqaatData.sessions) ? miqaatData.sessions.map((s: any) => ({
            ...s,
            startTime: convertTimestampToString(s.startTime),
            endTime: convertTimestampToString(s.endTime),
            reportingTime: convertTimestampToString(s.reportingTime),
        })) : [],
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
    
    onUpdate([]);
  });

  return unsubscribe;
};

export type MiqaatDataForAdd = Omit<Miqaat, 'id' | 'createdAt' | 'attendance' | 'safarList' | 'attendedUserItsIds'>;

export const addMiqaat = async (miqaatData: MiqaatDataForAdd): Promise<Miqaat> => {
  try {
    const firestorePayload: { [key: string]: any } = {
      ...miqaatData,
      attendanceType: miqaatData.attendanceType || null,
      startTime: new Date(miqaatData.startTime).toISOString(),
      endTime: new Date(miqaatData.endTime).toISOString(),
      reportingTime: miqaatData.reportingTime || null,
      sessions: (miqaatData.sessions || []).map(s => ({
        ...s,
        startTime: s.startTime,
        endTime: s.endTime,
        reportingTime: s.reportingTime || null
      })),
      mohallahIds: Array.isArray(miqaatData.mohallahIds) ? miqaatData.mohallahIds : [],
      teams: Array.isArray(miqaatData.teams) ? miqaatData.teams : [],
      eligibleItsIds: Array.isArray(miqaatData.eligibleItsIds) ? miqaatData.eligibleItsIds : [],
      attendance: [],
      safarList: [],
      attendedUserItsIds: [],
      createdAt: serverTimestamp(),
    };
    
    if (!firestorePayload.barcodeData) {
      firestorePayload.barcodeData = `MIQAAT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    }

    const docRef = await addDoc(miqaatsCollectionRef, firestorePayload);

    const actorName = typeof window !== 'undefined' ? localStorage.getItem('userName') || 'Unknown' : 'System';
    const actorItsId = typeof window !== 'undefined' ? localStorage.getItem('userItsId') || 'Unknown' : 'System';
    await addAuditLog('miqaat_created', { itsId: actorItsId, name: actorName }, 'info', { miqaatId: docRef.id, miqaatName: miqaatData.name });

    return { ...miqaatData, id: docRef.id, createdAt: new Date().toISOString(), attendance: [], safarList: [], attendedUserItsIds: [] } as Miqaat;

  } catch (error) {
    
    throw error;
  }
};

export type MiqaatDataForUpdate = Partial<Omit<Miqaat, 'id' | 'createdAt' | 'attendance' | 'safarList' | 'attendedUserItsIds'>>;

export const updateMiqaat = async (miqaatId: string, miqaatData: MiqaatDataForUpdate): Promise<void> => {
  try {
    const miqaatDoc = doc(db, 'miqaats', miqaatId);
    
    const firestorePayload: { [key: string]: any } = { ...miqaatData };

     if (miqaatData.startTime) {
        firestorePayload.startTime = new Date(miqaatData.startTime).toISOString();
     }
     if (miqaatData.endTime) {
        firestorePayload.endTime = new Date(miqaatData.endTime).toISOString();
     }
     
     if (miqaatData.hasOwnProperty('reportingTime')) {
        firestorePayload.reportingTime = miqaatData.reportingTime || null;
     }

    // Ensure attendanceType is not undefined
    if (miqaatData.hasOwnProperty('attendanceType')) {
        firestorePayload.attendanceType = miqaatData.attendanceType || null;
    }

     if (miqaatData.sessions) {
       firestorePayload.sessions = miqaatData.sessions.map(s => ({
         ...s,
         startTime: s.startTime,
         endTime: s.endTime,
         reportingTime: s.reportingTime || null,
       }));
     }

    await updateDoc(miqaatDoc, firestorePayload);

    const actorName = typeof window !== 'undefined' ? localStorage.getItem('userName') || 'Unknown' : 'System';
    const actorItsId = typeof window !== 'undefined' ? localStorage.getItem('userItsId') || 'Unknown' : 'System';
    await addAuditLog('miqaat_updated', { itsId: actorItsId, name: actorName }, 'info', { miqaatId, miqaatName: miqaatData.name, changes: miqaatData });

  } catch (error) {
    
    throw error;
  }
};

export const deleteMiqaat = async (miqaatId: string): Promise<void> => {
    try {
        const miqaatDoc = doc(db, 'miqaats', miqaatId);
        const docToDelete = await getDoc(miqaatDoc);
        const miqaatName = docToDelete.data()?.name || 'Unknown';

        await deleteDoc(miqaatDoc);

        const actorName = typeof window !== 'undefined' ? localStorage.getItem('userName') || 'Unknown' : 'System';
        const actorItsId = typeof window !== 'undefined' ? localStorage.getItem('userItsId') || 'Unknown' : 'System';
        await addAuditLog('miqaat_deleted', { itsId: actorItsId, name: actorName }, 'critical', { miqaatId, miqaatName });

    } catch (error) {
        
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

          const currentAttendance = miqaatDoc.data().attendance || [];
          const alreadyExists = currentAttendance.some((e: MiqaatAttendanceEntryItem) => 
            e.userItsId === entry.userItsId && e.sessionId === entry.sessionId
          );

          if (alreadyExists) {
              
              return; 
          }
          
          const cleanEntry: any = { ...entry };
          if (entry.uniformCompliance === undefined) {
              delete cleanEntry.uniformCompliance;
          }

          transaction.update(miqaatDocRef, {
              attendance: arrayUnion(cleanEntry),
              attendedUserItsIds: arrayUnion(cleanEntry.userItsId)
          });
      });
  } catch (error) {
    
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
                
                return;
            }

            const safarUserItsIdsToAdd = newEntries.map(e => e.userItsId);

            transaction.update(miqaatDocRef, {
                safarList: arrayUnion(...newEntries),
                attendedUserItsIds: arrayUnion(...safarUserItsIdsToAdd)
            });

            
        });
    } catch (error) {
        
        throw error;
    }
};
