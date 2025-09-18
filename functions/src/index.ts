
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// This new function will be triggered whenever a user's `lastLogin` field is updated.
export const onUserLogin = functions.firestore
  .document("mohallahs/{mohallahId}/members/{memberId}")
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();

    // Check if the `lastLogin` field was updated.
    // We compare timestamps to see if it's a new login event.
    const beforeLogin = beforeData.lastLogin as admin.firestore.Timestamp | undefined;
    const afterLogin = afterData.lastLogin as admin.firestore.Timestamp | undefined;

    // The login is considered "new" if the afterLogin timestamp exists and is different from the beforeLogin timestamp.
    if (afterLogin && (!beforeLogin || !beforeLogin.isEqual(afterLogin))) {
      const user = afterData;
      const logMessage = `${user.name} (${user.itsId}) logged in.`;
      const logContext = {
        itsId: user.itsId,
        name: user.name,
        role: user.role,
        mohallahId: user.mohallahId,
        loginTimestamp: afterLogin.toDate().toISOString(),
      };

      try {
        await db.collection('login_logs').add({
            level: 'info',
            message: logMessage,
            context: JSON.stringify(logContext, null, 2),
            timestamp: afterLogin, // Use the login timestamp for the log
        });
        functions.logger.log("Successfully logged user login event:", logContext);
      } catch (logError) {
        functions.logger.error("CRITICAL: Failed to write to login_logs collection.", { originalMessage: logMessage, logError });
      }
    }

    return null;
  });
