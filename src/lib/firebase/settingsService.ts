
'use server';

import { db } from './firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { addAuditLog } from './auditLogService';

const settingsCollectionRef = 'app_settings';
const featureFlagsDocRef = doc(db, settingsCollectionRef, 'featureFlags');
const duaPageSettingsDocRef = doc(db, settingsCollectionRef, 'duaPage');
const appConfigDocRef = doc(db, settingsCollectionRef, 'appConfig');


// --- GENERAL APP SETTINGS ---

export const getSettings = async (): Promise<{ [key: string]: any }> => {
    try {
        const docSnap = await getDoc(appConfigDocRef);
        if (docSnap.exists()) {
            return docSnap.data();
        }
        return { inactivityTimeout: 10, defaultTheme: 'blue' }; // Default values
    } catch (error) {
        console.error("Error fetching general settings:", error);
        return { inactivityTimeout: 10, defaultTheme: 'blue' };
    }
};

export const updateSetting = async (settingName: string, value: any): Promise<void> => {
     try {
        await setDoc(appConfigDocRef, { 
            [settingName]: value,
            updatedAt: serverTimestamp()
        }, { merge: true });
        
        const actorName = typeof window !== 'undefined' ? localStorage.getItem('userName') || 'Unknown' : 'System';
        const actorItsId = typeof window !== 'undefined' ? localStorage.getItem('userItsId') || 'Unknown' : 'System';
        await addAuditLog('app_setting_updated', { itsId: actorItsId, name: actorName }, 'warning', { setting: settingName, newValue: value });

    } catch (error) {
        console.error(`Error updating app setting "${settingName}":`, error);
        throw error;
    }
};


// --- DUA PAGE SETTINGS ---

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


// --- FEATURE FLAG SETTINGS ---

/**
 * Fetches all feature flags from settings.
 * @returns {Promise<{[key: string]: boolean}>} An object of feature flags.
 */
export const getFeatureFlags = async (): Promise<{ [key: string]: boolean }> => {
    try {
        const docSnap = await getDoc(featureFlagsDocRef);
        if (docSnap.exists()) {
            // Return all flags, ensuring a default for new flags if they're missing
            return {
                isThemeFeatureNew: true, // Default to true if not set
                isDuaPageEnabled: true,
                isFormsEnabled: true,
                isBarcodeScanningEnabled: true,
                ...docSnap.data(),
            };
        }
        // If the document doesn't exist, return default values
        return { isThemeFeatureNew: true, isDuaPageEnabled: true, isFormsEnabled: true, isBarcodeScanningEnabled: true };
    } catch (error) {
        console.error("Error fetching feature flags:", error);
        // On error, return default values to prevent breaking the UI
        return { isThemeFeatureNew: true, isDuaPageEnabled: true, isFormsEnabled: true, isBarcodeScanningEnabled: true };
    }
};


/**
 * Updates a specific feature flag.
 * @param {string} flagName - The name of the flag to update (e.g., 'isThemeFeatureNew').
 * @param {boolean} value - The new boolean value for the flag.
 */
export const updateFeatureFlag = async (flagName: string, value: boolean): Promise<void> => {
    try {
        await setDoc(featureFlagsDocRef, { 
            [flagName]: value,
            updatedAt: serverTimestamp()
        }, { merge: true });
        
        const actorName = typeof window !== 'undefined' ? localStorage.getItem('userName') || 'Unknown' : 'System';
        const actorItsId = typeof window !== 'undefined' ? localStorage.getItem('userItsId') || 'Unknown' : 'System';
        await addAuditLog('feature_flag_updated', { itsId: actorItsId, name: actorName }, 'warning', { flag: flagName, newValue: value });

    } catch (error) {
        console.error(`Error updating feature flag "${flagName}":`, error);
        throw error;
    }
};
