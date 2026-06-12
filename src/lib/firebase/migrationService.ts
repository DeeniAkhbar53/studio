'use server';

import { db } from './firebase';
import { collection, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';

async function copyCollection(srcCollectionPath: string, destCollectionPath: string, subcollectionsToCopy?: string[]) {
  const srcRef = collection(db, srcCollectionPath);
  const srcSnap = await getDocs(srcRef);
  
  let batch = writeBatch(db);
  let count = 0;
  let docCount = 0;

  for (const docSnap of srcSnap.docs) {
    const data = docSnap.data();
    const destDocRef = doc(db, destCollectionPath, docSnap.id);
    batch.set(destDocRef, data);
    docCount++;
    count++;

    if (count >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      count = 0;
    }

    // Copy subcollections if any
    if (subcollectionsToCopy) {
      for (const subName of subcollectionsToCopy) {
        const subSrcPath = `${srcCollectionPath}/${docSnap.id}/${subName}`;
        const subDestPath = `${destCollectionPath}/${docSnap.id}/${subName}`;
        const subSrcRef = collection(db, subSrcPath);
        const subSrcSnap = await getDocs(subSrcRef);
        for (const subDocSnap of subSrcSnap.docs) {
          const subData = subDocSnap.data();
          const subDestDocRef = doc(db, subDestPath, subDocSnap.id);
          batch.set(subDestDocRef, subData);
          docCount++;
          count++;

          if (count >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }
      }
    }
  }

  if (count > 0) {
    await batch.commit();
  }
  return docCount;
}

export async function transfer1447HData(): Promise<{ success: boolean; count: number; message: string }> {
  try {
    let totalCopied = 0;

    // 1. Copy miqaats
    totalCopied += await copyCollection('miqaats', 'years/1447H/miqaats');

    // 2. Copy forms & responses
    totalCopied += await copyCollection('forms', 'years/1447H/forms', ['responses']);

    // 3. Copy login_logs
    totalCopied += await copyCollection('login_logs', 'years/1447H/login_logs');

    // 4. Copy audit_logs
    totalCopied += await copyCollection('audit_logs', 'years/1447H/audit_logs');

    // 5. Copy notifications
    totalCopied += await copyCollection('notifications', 'years/1447H/notifications');

    // 6. Copy users & duaAttendance
    totalCopied += await copyCollection('users', 'years/1447H/users', ['duaAttendance']);

    return {
      success: true,
      count: totalCopied,
      message: `Successfully transferred ${totalCopied} documents from root database to 1447H database.`
    };
  } catch (error: any) {
    console.error("Migration failed:", error);
    return {
      success: false,
      count: 0,
      message: error.message || "An unexpected error occurred during migration."
    };
  }
}
