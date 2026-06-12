"use server";

import { db } from './firebase';
import { collection, writeBatch, getDocs, query, where, doc } from 'firebase/firestore';
import { addAuditLog } from './auditLogService';

// This function is a placeholder for creating team-related data if needed,
// but for now, teams are just string properties on user documents.
// It can be used to validate team name uniqueness if a separate 'teams' collection is desired.
export async function createTeam(teamName: string, mohallahId: string): Promise<void> {
  // Since teams are dynamic, we don't need to create a separate document for them.
  // We can add validation logic here if needed, like checking for uniqueness in a 'teams' collection.
  const actorName = typeof window !== 'undefined' ? localStorage.getItem('userName') || 'Unknown' : 'System';
  const actorItsId = typeof window !== 'undefined' ? localStorage.getItem('userItsId') || 'Unknown' : 'System';
  await addAuditLog('team_created', { itsId: actorItsId, name: actorName }, 'info', { teamName, mohallahId });
  
  // This function might seem empty, but it's a hook for future expansion.
  // For instance, creating a document in a `mohallahs/{mohallahId}/teams` collection.
}

export async function renameTeam(oldTeamName: string, newTeamName: string, mohallahId: string): Promise<void> {
  const membersCollectionRef = collection(db, 'mohallahs', mohallahId, 'members');
  const q = query(membersCollectionRef, where("team", "==", oldTeamName));

  try {
    const querySnapshot = await getDocs(q);
    const batch = writeBatch(db);

    querySnapshot.forEach(docSnapshot => {
      batch.update(docSnapshot.ref, { team: newTeamName });
    });

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

export async function deleteTeam(teamName: string, mohallahId: string): Promise<void> {
    // There is no team document to delete. This function is a placeholder for future logic.
    // The main validation (checking if team is empty) is done on the client-side before calling this.
    const actorName = typeof window !== 'undefined' ? localStorage.getItem('userName') || 'Unknown' : 'System';
    const actorItsId = typeof window !== 'undefined' ? localStorage.getItem('userItsId') || 'Unknown' : 'System';
    await addAuditLog('team_deleted', { itsId: actorItsId, name: actorName }, 'critical', { teamName, mohallahId });
}