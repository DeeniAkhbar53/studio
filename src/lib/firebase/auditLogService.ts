
'use server';

import { db } from './firebase';
import {
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import type { AuditLog } from '@/types';

const auditLogsCollectionRef = collection(db, 'audit_logs');

/**
 * Adds a new log entry to the audit trail.
 * This should be called from other server-side service functions.
 * @param action - A string describing the action, e.g., "user_created".
 * @param actor - An object containing the ITS ID and name of the person performing the action.
 * @param context - Optional additional information about the event, e.g., { targetUserId: '...', targetUserName: '...' }.
 * @param level - The severity level of the log entry.
 */
export const addAuditLog = async (
  action: string,
  actor: { itsId: string; name: string },
  level: AuditLog['level'] = 'info',
  context?: any
): Promise<void> => {
  try {
    const logEntry = {
      action,
      actorItsId: actor.itsId,
      actorName: actor.name,
      level,
      context: context || null,
      timestamp: serverTimestamp(),
    };

    await addDoc(auditLogsCollectionRef, logEntry);
  } catch (error) {
    console.error("Failed to add audit log:", {
      action,
      actor,
      context,
      error,
    });
    // We don't re-throw the error, as failing to log should not
    // block the primary user-facing action from completing.
  }
};
