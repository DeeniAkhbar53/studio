
import { db } from './firebase';
import { collection, query, getDocs, writeBatch, limit, CollectionReference, DocumentData, Query } from 'firebase/firestore';

// Helper function to delete a subcollection in batches
export async function deleteSubcollection(
  firestoreInstance: typeof db,
  collectionPath: string,
  batchSize: number
): Promise<void> {
  const collectionRef: CollectionReference<DocumentData> = collection(firestoreInstance, collectionPath);
  let q: Query<DocumentData> = query(collectionRef, limit(batchSize));

  return new Promise((resolve, reject) => {
    deleteQueryBatch(firestoreInstance, q, resolve, reject, batchSize);
  });
}

async function deleteQueryBatch(
  firestoreInstance: typeof db,
  q: Query<DocumentData>,
  resolve: () => void,
  reject: (error: any) => void,
  batchSize: number
) {
  try {
    const snapshot = await getDocs(q);

    // When there are no documents left, we are done
    if (snapshot.size === 0) {
      resolve();
      return;
    }

    // Delete documents in a batch
    const batch = writeBatch(firestoreInstance);
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    // Recurse on the next process tick, to avoid exploding the stack.
    process.nextTick(() => {
      deleteQueryBatch(firestoreInstance, q, resolve, reject, batchSize);
    });
  } catch (error) {
    console.error("Error in deleteQueryBatch: ", error);
    reject(error);
  }
}
