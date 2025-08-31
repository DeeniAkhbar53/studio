
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

    // Use a collection group query to get all members across all mohallahs
    const membersCollectionGroup = db.collectionGroup("members");

    if (notification.targetAudience === "all") {
      // Query for all documents in the 'members' collection group
      usersQuery = membersCollectionGroup;
    } else {
      // Query for members with a specific role
      usersQuery = membersCollectionGroup.where("role", "==", notification.targetAudience);
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
        // Check for fcmTokens and ensure it's a non-empty array
        if (user.fcmTokens && Array.isArray(user.fcmTokens) && user.fcmTokens.length > 0) {
          tokens.push(...user.fcmTokens);
        }
      });

      // Remove duplicate tokens to avoid sending the same notification multiple times to one device
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
          icon: "/logo.png", // Using a default icon
        },
        data: {
          // This data is sent to the client. The URL helps navigate the user on notification click.
          url: "/dashboard/notifications",
          notificationId: notificationId,
        },
      };

      const response = await admin.messaging().sendToDevice(uniqueTokens, messagePayload);

      functions.logger.log("Successfully sent message(s):", response.successCount, "failures:", response.failureCount);

      // --- Token Cleanup ---
      const tokensToRemove: Promise<any>[] = [];
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
             // In a real application, you would now need a reverse lookup to find the user
             // associated with this token and remove it from their `fcmTokens` array.
             // This is a complex operation and is omitted for simplicity, but logging it is the first step.
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
