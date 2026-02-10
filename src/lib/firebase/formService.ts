
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
  runTransaction,
  where,
  limit,
  writeBatch,
  onSnapshot,
  Unsubscribe,
  collectionGroup
} from 'firebase/firestore';
import type { Form, FormQuestion, FormResponse } from '@/types';
import { addAuditLog } from './auditLogService';

const formsCollectionRef = collection(db, 'forms');

// --- Form Management ---

export type FormForAdd = Omit<Form, 'id' | 'createdAt' | 'responseCount' | 'status' | 'updatedAt' | 'updatedBy'>;
export type FormForUpdate = Partial<Omit<Form, 'id' | 'createdAt' | 'responseCount' | 'status' | 'createdBy'>> & { updatedBy: string };


export const addForm = async (formData: FormForAdd): Promise<Form> => {
  try {
    const docRef = await addDoc(formsCollectionRef, {
      ...formData,
      responseCount: 0,
      createdAt: serverTimestamp(),
      status: 'open', // Forms are open by default
      mohallahIds: formData.mohallahIds || [],
      teams: formData.teams || [],
      eligibleItsIds: formData.eligibleItsIds || [],
      endDate: formData.endDate || null,
      imageUrl: formData.imageUrl || null,
      allowResponseEditing: formData.allowResponseEditing || false,
    });
    
    const actorName = typeof window !== 'undefined' ? localStorage.getItem('userName') || 'Unknown' : 'System';
    const actorItsId = typeof window !== 'undefined' ? localStorage.getItem('userItsId') || 'Unknown' : 'System';
    await addAuditLog('form_created', { itsId: actorItsId, name: actorName }, 'info', { formId: docRef.id, formTitle: formData.title });


    const newForm: Form = {
      ...(formData as Omit<Form, 'id' | 'createdAt' | 'status'>),
      id: docRef.id,
      responseCount: 0,
      createdAt: new Date().toISOString(),
      status: 'open',
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
            const updatedAt = data.updatedAt instanceof Timestamp
                              ? data.updatedAt.toDate().toISOString()
                              : data.updatedAt; // Keep as string if already converted
            const endDate = data.endDate instanceof Timestamp
                              ? data.endDate.toDate().toISOString()
                              : data.endDate;
            return { 
                ...data, 
                id: docSnapshot.id, 
                createdAt,
                updatedAt,
                endDate,
                status: data.status || 'open', // Default to open if status is not set
                allowResponseEditing: data.allowResponseEditing || false,
            } as Form;
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
        
        const updatedAt = data.updatedAt instanceof Timestamp
                          ? data.updatedAt.toDate().toISOString()
                          : data.updatedAt;

        const endDate = data.endDate instanceof Timestamp
                          ? data.endDate.toDate().toISOString()
                          : data.endDate;

        return { 
            ...data, 
            id: formDocSnap.id, 
            createdAt,
            updatedAt,
            endDate,
            status: data.status || 'open', // Default to open
            allowResponseEditing: data.allowResponseEditing || false,
        } as Form;
    } catch (error) {
        console.error("Error fetching form: ", error);
        throw error;
    }
};

export const updateForm = async (formId: string, formData: FormForUpdate): Promise<void> => {
    try {
        const formDocRef = doc(db, 'forms', formId);
        await updateDoc(formDocRef, {
            ...formData,
            updatedAt: serverTimestamp() // Add timestamp on every update
        });

        const actorName = typeof window !== 'undefined' ? localStorage.getItem('userName') || 'Unknown' : 'System';
        const actorItsId = typeof window !== 'undefined' ? localStorage.getItem('userItsId') || 'Unknown' : 'System';
        await addAuditLog('form_updated', { itsId: actorItsId, name: actorName }, 'info', { formId, formTitle: formData.title, changes: formData });

    } catch (error) {
        console.error("Error updating form: ", error);
        throw error;
    }
};

export const updateFormStatus = async (formId: string, status: 'open' | 'closed'): Promise<void> => {
    try {
        const formDocRef = doc(db, 'forms', formId);
        await updateDoc(formDocRef, { status });

        const actorName = typeof window !== 'undefined' ? localStorage.getItem('userName') || 'Unknown' : 'System';
        const actorItsId = typeof window !== 'undefined' ? localStorage.getItem('userItsId') || 'Unknown' : 'System';
        await addAuditLog('form_status_changed', { itsId: actorItsId, name: actorName }, 'warning', { formId, newStatus: status });

    } catch (error) {
        console.error(`Error updating form status for ${formId}:`, error);
        throw error;
    }
};


export const deleteForm = async (formId: string): Promise<void> => {
    const formDocRef = doc(db, 'forms', formId);
    const responsesRef = collection(formDocRef, 'responses');
    
    try {
        const formToDelete = await getDoc(formDocRef);
        const formTitle = formToDelete.data()?.title || 'Unknown';
        
        // Efficiently delete the subcollection of responses
        const responsesSnapshot = await getDocs(responsesRef);
        const batch = writeBatch(db);
        responsesSnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        // Delete the main form document
        await deleteDoc(formDocRef);
        
        const actorName = typeof window !== 'undefined' ? localStorage.getItem('userName') || 'Unknown' : 'System';
        const actorItsId = typeof window !== 'undefined' ? localStorage.getItem('userItsId') || 'Unknown' : 'System';
        await addAuditLog('form_deleted', { itsId: actorItsId, name: actorName }, 'critical', { formId, formTitle });

    } catch (error) {
        console.error(`Error deleting form ${formId} and its responses: `, error);
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

            const formData = formDoc.data() as Form;
            if (formData.status === 'closed') {
                throw new Error("This form is closed and no longer accepting new responses.");
            }

            if (formData.endDate && new Date() > new Date(formData.endDate)) {
                 throw new Error("The deadline for this form has passed.");
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

export const updateFormResponse = async (formId: string, responseId: string, responseData: Omit<FormResponse, 'id' | 'submittedAt' | 'formId'>): Promise<void> => {
    const responseDocRef = doc(db, 'forms', formId, 'responses', responseId);
    try {
        await updateDoc(responseDocRef, {
            ...responseData,
            submittedAt: serverTimestamp() // Update timestamp to reflect latest edit
        });
    } catch (error) {
        console.error("Error updating form response:", error);
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
        console.error(`Error fetching responses for form ${formId}:`, error);
        throw error;
    }
};

export const getFormResponsesRealtime = (formId: string, onUpdate: (responses: FormResponse[]) => void): Unsubscribe => {
    const responsesCollectionRef = collection(db, 'forms', formId, 'responses');
    const q = query(responsesCollectionRef, orderBy('submittedAt', 'desc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const responses = querySnapshot.docs.map(docSnapshot => {
            const data = docSnapshot.data();
            const submittedAt = data.submittedAt instanceof Timestamp
                              ? data.submittedAt.toDate().toISOString()
                              : new Date().toISOString();
            return { ...data, id: docSnapshot.id, submittedAt } as FormResponse;
        });
        onUpdate(responses);
    }, (error) => {
        console.error(`Error fetching real-time responses for form ${formId}:`, error);
        onUpdate([]); // Send empty array on error
    });

    return unsubscribe;
};

export const getFormResponseForUser = async (formId: string, userId: string): Promise<FormResponse | null> => {
    try {
        const responsesRef = collection(db, 'forms', formId, 'responses');
        const q = query(responsesRef, where('submittedBy', '==', userId), limit(1));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            return null;
        }

        const docSnapshot = querySnapshot.docs[0];
        const data = docSnapshot.data();
        const submittedAt = data.submittedAt instanceof Timestamp
                          ? data.submittedAt.toDate().toISOString()
                          : new Date().toISOString();
        return { ...data, id: docSnapshot.id, submittedAt } as FormResponse;
        
    } catch (error) {
        console.error("Error checking if user has responded:", error);
        throw error;
    }
};

export const getFormResponsesForUser = async (userItsId: string): Promise<FormResponse[]> => {
    try {
        const responsesCollectionGroup = collectionGroup(db, 'responses');
        const q = query(responsesCollectionGroup, where('submittedBy', '==', userItsId));
        const querySnapshot = await getDocs(q);
        
        const responses: FormResponse[] = [];
        querySnapshot.forEach(docSnapshot => {
            const data = docSnapshot.data();
            const submittedAt = data.submittedAt instanceof Timestamp
                              ? data.submittedAt.toDate().toISOString()
                              : new Date().toISOString();
            responses.push({ ...data, id: docSnapshot.id, submittedAt } as FormResponse);
        });
        
        return responses;
    } catch (error) {
        console.error(`Error fetching form responses for user ${userItsId}:`, error);
        if (error instanceof Error && error.message.includes("index")) {
            const firestoreConsoleUrl = `https://console.firebase.google.com/project/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}/firestore/indexes`;
            console.error(`This operation requires a Firestore index. Please create a composite index for the 'responses' collection group with 'submittedBy' (ascending). Go to: ${firestoreConsoleUrl}`);
        }
        // Instead of throwing, we now return an empty array to prevent a page crash.
        // The UI will show a message based on the thrown error from the calling component.
        throw error; 
    }
};


export const deleteFormResponse = async (formId: string, responseId: string): Promise<void> => {
    const formRef = doc(db, 'forms', formId);
    const responseRef = doc(formRef, 'responses', responseId);

    try {
         await runTransaction(db, async (transaction) => {
            const formDoc = await transaction.get(formRef);
            if (!formDoc.exists()) {
                throw new Error("Form does not exist!");
            }
            
            const responseDoc = await transaction.get(responseRef);
            if (!responseDoc.exists()) {
                throw new Error("Response does not exist!");
            }
            const responseData = responseDoc.data();

            // Decrement the responseCount on the parent form document
            const currentCount = formDoc.data().responseCount || 0;
            if (currentCount > 0) {
              transaction.update(formRef, { responseCount: increment(-1) });
            }
            // Delete the specific response document
            transaction.delete(responseRef);

             const actorName = typeof window !== 'undefined' ? localStorage.getItem('userName') || 'Unknown' : 'System';
             const actorItsId = typeof window !== 'undefined' ? localStorage.getItem('userItsId') || 'Unknown' : 'System';
             addAuditLog('form_response_deleted', { itsId: actorItsId, name: actorName }, 'warning', { formId, responseId, submittedBy: responseData.submittedBy });
        });
    } catch (error) {
        console.error(`Error deleting response ${responseId} from form ${formId}:`, error);
        throw error;
    }
};

export const checkIfUserHasResponded = async (formId: string, userId: string): Promise<boolean> => {
    try {
        const responsesRef = collection(db, 'forms', formId, 'responses');
        const q = query(responsesRef, where('submittedBy', '==', userId), limit(1));
        const querySnapshot = await getDocs(q);
        return !querySnapshot.empty;
    } catch (error) {
        console.error("Error checking if user has responded:", error);
        // Default to false to allow user to attempt to fill form, backend validation will be the final guard.
        return false;
    }
};
