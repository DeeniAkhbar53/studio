"use server";

import { db } from './firebase';
import { collection, writeBatch, getDocs, query, where, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { addAuditLog } from './auditLogService';

/**
 * Fetches all teams created for a specific mohallah.
 */
export async function getTeams(mohallahId: string): Promise<string[]> {
  try {
    const teamsCollectionRef = collection(db, 'mohallahs', mohallahId, 'teams');
    const snap = await getDocs(teamsCollectionRef);
    return snap.docs.map(doc => decodeURIComponent(doc.id));
  } catch (error) {
    console.error("Error fetching teams:", error);
    return [];
  }
}

/**
 * Persists a new team by creating a document in the mohallah's teams subcollection.
 */
export async function createTeam(teamName: string, mohallahId: string): Promise<void> {
  try {
    const teamDocRef = doc(db, 'mohallahs', mohallahId, 'teams', encodeURIComponent(teamName));
    await setDoc(teamDocRef, { createdAt: new Date().toISOString() });
    
    const actorName = typeof window !== 'undefined' ? localStorage.getItem('userName') || 'Unknown' : 'System';
    const actorItsId = typeof window !== 'undefined' ? localStorage.getItem('userItsId') || 'Unknown' : 'System';
    await addAuditLog('team_created', { itsId: actorItsId, name: actorName }, 'info', { teamName, mohallahId });
  } catch (error) {
    console.error("Error creating team:", error);
    throw error;
  }
}

/**
 * Renames a team by renaming the document in the teams subcollection and updating all members' team fields.
 */
export async function renameTeam(oldTeamName: string, newTeamName: string, mohallahId: string): Promise<void> {
  const membersCollectionRef = collection(db, 'mohallahs', mohallahId, 'members');
  const q = query(membersCollectionRef, where("team", "==", oldTeamName));

  try {
    const querySnapshot = await getDocs(q);
    const batch = writeBatch(db);

    // Update all users who were in the old team
    querySnapshot.forEach(docSnapshot => {
      batch.update(docSnapshot.ref, { team: newTeamName });
    });

    // Rename the team document in Firestore
    const oldTeamRef = doc(db, 'mohallahs', mohallahId, 'teams', encodeURIComponent(oldTeamName));
    const newTeamRef = doc(db, 'mohallahs', mohallahId, 'teams', encodeURIComponent(newTeamName));
    batch.delete(oldTeamRef);
    batch.set(newTeamRef, { createdAt: new Date().toISOString() });

    await batch.commit();

    const actorName = typeof window !== 'undefined' ? localStorage.getItem('userName') || 'Unknown' : 'System';
    const actorItsId = typeof window !== 'undefined' ? localStorage.getItem('userItsId') || 'Unknown' : 'System';
    await addAuditLog('team_renamed', { itsId: actorItsId, name: actorName }, 'warning', {
        mohallahId,
        oldTeamName,
        newTeamName,
        membersAffected: querySnapshot.size
    });

  } catch (error) {
    console.error(`Error renaming team from "${oldTeamName}" to "${newTeamName}":`, error);
    throw error;
  }
}

/**
 * Deletes a team document from the subcollection.
 */
export async function deleteTeam(teamName: string, mohallahId: string): Promise<void> {
  try {
    const teamRef = doc(db, 'mohallahs', mohallahId, 'teams', encodeURIComponent(teamName));
    await deleteDoc(teamRef);

    const actorName = typeof window !== 'undefined' ? localStorage.getItem('userName') || 'Unknown' : 'System';
    const actorItsId = typeof window !== 'undefined' ? localStorage.getItem('userItsId') || 'Unknown' : 'System';
    await addAuditLog('team_deleted', { itsId: actorItsId, name: actorName }, 'critical', { teamName, mohallahId });
  } catch (error) {
    console.error("Error deleting team:", error);
    throw error;
  }
}