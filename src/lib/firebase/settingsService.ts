

import { db } from './firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { addAuditLog } from './auditLogService';

const settingsCollectionRef = 'app_settings';
const duaPageSettingsDocRef = doc(db, settingsCollectionRef, 'duaPage');

/**
 * Fetches the YouTube video URL for the Dua page from settings.
 * @returns {Promise<string | null>} The YouTube video ID/URL or null if not found.
 */
export const getDuaVideoUrl = async (): Promise<string | null> => {
    try {
        const docSnap = await getDoc(duaPageSettingsDocRef);
        if (docSnap.exists()) {
            return docSnap.data().videoUrl || null;
        }
        return null;
    } catch (error) {
        console.error("Error fetching Dua video URL:", error);
        throw error;
    }
};

/**
 * Updates the YouTube video URL for the Dua page.
 * @param {string} newUrl - The new YouTube video ID or full URL.
 */
export const updateDuaVideoUrl = async (newUrl: string): Promise<void> => {
    try {
        const originalDoc = await getDoc(duaPageSettingsDocRef);
        const oldUrl = originalDoc.data()?.videoUrl || 'N/A';
        
        // Extract video ID if a full URL is pasted
        let videoId = newUrl;
        if (newUrl.includes("youtube.com/watch?v=")) {
            const urlParams = new URLSearchParams(new URL(newUrl).search);
            videoId = urlParams.get("v") || videoId;
        } else if (newUrl.includes("youtu.be/")) {
            videoId = newUrl.split('youtu.be/')[1].split('?')[0];
        }

        await setDoc(duaPageSettingsDocRef, { 
            videoUrl: videoId,
            updatedAt: serverTimestamp()
        }, { merge: true });
        
        const actorName = typeof window !== 'undefined' ? localStorage.getItem('userName') || 'Unknown' : 'System';
        const actorItsId = typeof window !== 'undefined' ? localStorage.getItem('userItsId') || 'Unknown' : 'System';
        await addAuditLog('setting_updated', { itsId: actorItsId, name: actorName }, 'warning', { setting: 'DuaVideoUrl', oldUrl, newUrl: videoId });

    } catch (error) {
        console.error("Error updating Dua video URL:", error);
        throw error;
    }
};
