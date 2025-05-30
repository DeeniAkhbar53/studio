import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
// This will use the default service account credentials for your project
admin.initializeApp();

const db = admin.firestore();

interface User {
  id: string;
  itsId: string;
  mohallahId?: string; // Path to the Mohallah document if needed
  role: "user" | "admin" | "superadmin" | "attendance-marker";
  fcmTokens?: string[];
  // other user fields...
}

interface NotificationData {
  title: string;
  content: string;
  targetAudience: "all" | "user" | "admin" | "superadmin" | "attendance-marker";
  createdBy: string; // ITS ID of creator
  // other notification fields...
}

export const onNewNotificationCreated = functions.firestore
  .document("notifications/{notificationId}")
  .onCreate(async (snapshot, context) => {
    const notification = snapshot.data() as NotificationData;
    const notificationId = context.params.notificationId;

    functions.logger.log(
      `New notification created (ID: ${notificationId}):`,
      notification
    );

    let usersQuery: admin.firestore.Query;

    if (notification.targetAudience === "all") {
      // Query all members across all Mohallahs
      usersQuery = db.collectionGroup("members");
    } else {
      // Query members with a specific role across all Mohallahs
      usersQuery = db
        .collectionGroup("members")
        .where("role", "==", notification.targetAudience);
    }

    try {
      const usersSnapshot = await usersQuery.get();
      if (usersSnapshot.empty) {
        functions.logger.log(
          "No users found for target audience:",
          notification.targetAudience
        );
        return null;
      }

      const tokens: string[] = [];
      usersSnapshot.forEach((doc) => {
        const user = doc.data() as User;
        if (user.fcmTokens && user.fcmTokens.length > 0) {
          tokens.push(...user.fcmTokens);
        }
      });

      const uniqueTokens = [...new Set(tokens)]; // Ensure unique tokens

      if (uniqueTokens.length === 0) {
        functions.logger.log("No FCM tokens found for the targeted users.");
        return null;
      }

      functions.logger.log(
        `Found ${uniqueTokens.length} unique FCM tokens for notification ID: ${notificationId}`
      );

      const messagePayload = {
        notification: {
          title: notification.title,
          body: notification.content,
          icon: "/logo.png", // Ensure this image is in the /public folder of your deployed Next.js app
        },
        data: {
          // Optional: You can send additional data for in-app handling
          url: "/dashboard/notifications", // e.g., to open a specific page on click
          notificationId: notificationId,
        },
      };

      // Send messages to the tokens.
      // Consider using sendEachForMulticast for better error handling per token
      const response = await admin.messaging().sendToDevice(uniqueTokens, messagePayload);

      functions.logger.log("Successfully sent message(s):", response);

      // Clean up invalid tokens (optional but good practice)
      // const tokensToRemove: Promise<any>[] = [];
      response.results.forEach((result, index) => {
        const error = result.error;
        if (error) {
          functions.logger.error(
            "Failure sending notification to",
            uniqueTokens[index],
            error
          );
          // Cleanup the tokens that are not registered anymore.
          if (
            error.code === "messaging/invalid-registration-token" ||
            error.code === "messaging/registration-token-not-registered"
          ) {
            // This part is more complex as you need to find which user had this token
            // and remove it from their fcmTokens array. This might involve another
            // query or careful data management. For simplicity, this example doesn't
            // implement token cleanup, but it's an important consideration.
             functions.logger.warn("Consider implementing FCM token cleanup for token:", uniqueTokens[index]);
          }
        }
      });
      // await Promise.all(tokensToRemove); // If implementing token cleanup

      return null;
    } catch (error) {
      functions.logger.error("Error sending notification:", error);
      return null;
    }
  });
