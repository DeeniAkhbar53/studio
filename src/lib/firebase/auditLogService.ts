
'use server';

import { db, getYearPath } from './firebase';
import {
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import type { AuditLog } from '@/types';

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

    const auditLogsCol = collection(db, getYearPath('audit_logs'));
    await addDoc(auditLogsCol, logEntry);
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
