
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

export const onNewNotificationCreated = functions.firestore
  .document("notifications/{notificationId}")
  .onCreate(async (snapshot, context) => {
    const notification = snapshot.data() as NotificationData;
    const notificationId = context.params.notificationId;

    functions.logger.log(`New notification created (ID: ${notificationId}):`, notification);

    let usersQuery: admin.firestore.Query;

    if (notification.targetAudience === "all") {
      usersQuery = db.collectionGroup("members");
    } else {
      usersQuery = db.collectionGroup("members").where("role", "==", notification.targetAudience);
    }

    try {
      const usersSnapshot = await usersQuery.get();
      if (usersSnapshot.empty) {
        functions.logger.log("No users found for target audience:", notification.targetAudience);
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

      // --- Token Cleanup ---
      // This section finds invalid tokens and you would then need another
      // step to trace them back to the user and remove them. This part is complex
      // as you need to find which user has the invalid token.
      const tokensToRemove: Promise<any>[] = [];
      response.results.forEach((result, index) => {
        const error = result.error;
        if (error) {
          functions.logger.error("Failure sending notification to", uniqueTokens[index], error);
          // Here, you would typically handle tokens that are no longer valid.
          if (
            error.code === "messaging/invalid-registration-token" ||
            error.code === "messaging/registration-token-not-registered"
          ) {
            // This is where you would implement logic to find the user with this
            // invalid token and remove it from their `fcmTokens` array.
            // For simplicity in this example, this complex cleanup is logged but not executed.
            const invalidToken = uniqueTokens[index];
            functions.logger.warn(`Invalid token found: ${invalidToken}. Manual cleanup recommended.`);
          }
        }
      });
      // --- End Token Cleanup ---

      return null;
    } catch (error) {
      functions.logger.error("Error sending notification:", error);
      if (error instanceof Error && error.message.includes("index")) {
          functions.logger.error("Firestore query failed. This is likely due to a missing Firestore index. Please check your Firebase console for index creation recommendations on the 'members' collection group for the 'role' field.");
      }
      return null;
    }
  });
