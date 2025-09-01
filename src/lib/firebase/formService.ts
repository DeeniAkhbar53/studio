
'use server';

import { db } from './firebase';
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  Timestamp,
  increment,
  runTransaction
} from 'firebase/firestore';
import type { Form, FormQuestion, FormResponse } from '@/types';

const formsCollectionRef = collection(db, 'forms');

// --- Form Management ---

export type FormForAdd = Omit<Form, 'id' | 'createdAt' | 'responseCount'>;

export const addForm = async (formData: FormForAdd): Promise<Form> => {
  try {
    const docRef = await addDoc(formsCollectionRef, {
      ...formData,
      responseCount: 0,
      createdAt: serverTimestamp(),
    });

    const newForm: Form = {
      ...formData,
      id: docRef.id,
      responseCount: 0,
      createdAt: new Date().toISOString(),
    };
    return newForm;
  } catch (error) {
    console.error("Error adding form: ", error);
    throw error;
  }
};

export const getForms = async (): Promise<Form[]> => {
    const q = query(formsCollectionRef, orderBy('createdAt', 'desc'));
    
    try {
        const querySnapshot = await getDocs(q);
        const forms = querySnapshot.docs.map(docSnapshot => {
            const data = docSnapshot.data();
            const createdAt = data.createdAt instanceof Timestamp
                              ? data.createdAt.toDate().toISOString()
                              : new Date().toISOString();
            return { ...data, id: docSnapshot.id, createdAt } as Form;
        });
        return forms;
    } catch (error) {
        console.error("Error getting forms: ", error);
        throw error;
    }
};

export const getForm = async (formId: string): Promise<Form | null> => {
    try {
        const formDocRef = doc(db, 'forms', formId);
        const formDocSnap = await getDoc(formDocRef);

        if (!formDocSnap.exists()) {
            console.warn(`Form with ID ${formId} not found.`);
            return null;
        }
        
        const data = formDocSnap.data();
        const createdAt = data.createdAt instanceof Timestamp
                          ? data.createdAt.toDate().toISOString()
                          : new Date().toISOString();

        return { ...data, id: formDocSnap.id, createdAt } as Form;
    } catch (error) {
        console.error("Error fetching form: ", error);
        throw error;
    }
};

export const deleteForm = async (formId: string): Promise<void> => {
    // Note: This doesn't delete the subcollection of responses. 
    // For a production app, a Cloud Function would be needed to handle subcollection deletion recursively.
    try {
        const formDocRef = doc(db, 'forms', formId);
        await deleteDoc(formDocRef);
    } catch (error) {
        console.error("Error deleting form: ", error);
        throw error;
    }
};

// --- Form Response Management ---

export type FormResponseForAdd = Omit<FormResponse, 'id' | 'submittedAt'>;

export const addFormResponse = async (formId: string, responseData: FormResponseForAdd): Promise<string> => {
    const formRef = doc(db, 'forms', formId);
    const responsesRef = collection(formRef, 'responses');

    try {
        return await runTransaction(db, async (transaction) => {
            const formDoc = await transaction.get(formRef);
            if (!formDoc.exists()) {
                throw new Error("Form does not exist!");
            }

            const newResponseRef = doc(responsesRef); // Create a new doc ref in the subcollection
            
            transaction.set(newResponseRef, {
                ...responseData,
                submittedAt: serverTimestamp()
            });

            // Increment the responseCount on the parent form document
            transaction.update(formRef, { responseCount: increment(1) });
            
            return newResponseRef.id;
        });
    } catch (error) {
        console.error("Error submitting form response: ", error);
        throw error;
    }
};

export const getFormResponses = async (formId: string): Promise<FormResponse[]> => {
    try {
        const responsesCollectionRef = collection(db, 'forms', formId, 'responses');
        const q = query(responsesCollectionRef, orderBy('submittedAt', 'desc'));
        const querySnapshot = await getDocs(q);

        return querySnapshot.docs.map(docSnapshot => {
            const data = docSnapshot.data();
            const submittedAt = data.submittedAt instanceof Timestamp
                              ? data.submittedAt.toDate().toISOString()
                              : new Date().toISOString();
            return { ...data, id: docSnapshot.id, submittedAt } as FormResponse;
        });
    } catch (error) {
        console.error("Error fetching form responses: ", error);
        throw error;
    }
};
