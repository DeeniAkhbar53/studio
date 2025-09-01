
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

interface User {
  id: string;
  itsId: string;
  mohallahId?: string;
  role: "user" | "admin" | "superadmin" | "attendance-marker";
  fcmTokens?: string[];
}

interface NotificationData {
  title: string;
  content: string;
  targetAudience: "all" | "user" | "admin" | "superadmin" | "attendance-marker";
  createdBy: string;
}

// Helper to write to our new logs collection
const addSystemLog = async (level: 'info' | 'warning' | 'error', message: string, context?: object) => {
  try {
    await db.collection('system_logs').add({
      level,
      message,
      context: context ? JSON.stringify(context, null, 2) : "No context provided.",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (logError) {
    functions.logger.error("CRITICAL: Failed to write to system_logs collection.", { originalMessage: message, logError });
  }
};

export const onNewNotificationCreated = functions.firestore
  .document("notifications/{notificationId}")
  .onCreate(async (snapshot, context) => {
    const notification = snapshot.data() as NotificationData;
    const notificationId = context.params.notificationId;

    functions.logger.log(`New notification created (ID: ${notificationId}):`, notification);

    let usersQuery: admin.firestore.Query;
    const membersCollectionGroup = db.collectionGroup("members");

    if (notification.targetAudience === "all") {
      usersQuery = membersCollectionGroup;
    } else {
      usersQuery = membersCollectionGroup.where("role", "==", notification.targetAudience);
    }

    try {
      const usersSnapshot = await usersQuery.get();
      if (usersSnapshot.empty) {
        functions.logger.log("No users found for target audience:", notification.targetAudience);
        await addSystemLog('info', 'No users found for notification target audience.', { notificationId, targetAudience: notification.targetAudience });
        return null;
      }

      const tokens: string[] = [];
      usersSnapshot.forEach((doc) => {
        const user = doc.data() as User;
        if (user.fcmTokens && Array.isArray(user.fcmTokens) && user.fcmTokens.length > 0) {
          tokens.push(...user.fcmTokens);
        }
      });

      const uniqueTokens = [...new Set(tokens)];

      if (uniqueTokens.length === 0) {
        functions.logger.log("No FCM tokens found for the targeted users.");
        await addSystemLog('info', 'No FCM tokens found for targeted users.', { notificationId, targetAudience: notification.targetAudience });
        return null;
      }

      functions.logger.log(`Found ${uniqueTokens.length} unique FCM tokens for notification ID: ${notificationId}`);

      const messagePayload: admin.messaging.MessagingPayload = {
        notification: {
          title: notification.title,
          body: notification.content,
          icon: "/logo.png",
        },
        data: {
          url: "/dashboard/notifications",
          notificationId: notificationId,
        },
      };

      const response = await admin.messaging().sendToDevice(uniqueTokens, messagePayload);
      functions.logger.log("Successfully sent message(s):", response.successCount, "failures:", response.failureCount);
      
      if(response.failureCount > 0) {
        await addSystemLog('warning', `Push notification sending had ${response.failureCount} failures.`, { notificationId, successCount: response.successCount, failureCount: response.failureCount });
      }

      response.results.forEach((result, index) => {
        const error = result.error;
        if (error) {
          functions.logger.error("Failure sending notification to", uniqueTokens[index], error);
          if (
            error.code === "messaging/invalid-registration-token" ||
            error.code === "messaging/registration-token-not-registered"
          ) {
             const invalidToken = uniqueTokens[index];
             functions.logger.warn(`Invalid token found: ${invalidToken}. Implement cleanup logic here.`);
             addSystemLog('warning', `Invalid FCM token found and needs cleanup.`, { invalidToken, notificationId, errorCode: error.code });
          }
        }
      });
      return null;
    } catch (error) {
      functions.logger.error("Error sending notification:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorContext = {
        notificationId,
        targetAudience: notification.targetAudience,
        error: errorMessage,
      };

      if (errorMessage.includes("index")) {
          const detailedMessage = "Firestore query failed. This is likely due to a missing Firestore index on the 'members' collection group for the 'role' field.";
          functions.logger.error(detailedMessage);
          await addSystemLog('error', detailedMessage, errorContext);
      } else {
          await addSystemLog('error', 'Error sending notification', errorContext);
      }
      return null;
    }
  });
