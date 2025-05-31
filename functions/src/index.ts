// functions/src/index.ts
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import type { DocumentSnapshot } from "firebase-admin/firestore"; // For explicit type
import type { EventContext } from "firebase-functions"; // For explicit type

// Initialize Firebase Admin SDK
// This will use the default service account credentials for your project
admin.initializeApp();

const db = admin.firestore();

interface User {
  id: string;
  itsId: string;
  mohallahId?: string;
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
  .onCreate(async (snapshot: DocumentSnapshot, context: EventContext) => {
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
      usersSnapshot.forEach((doc: DocumentSnapshot) => { // Explicit type for doc
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
          icon: "/logo.png", // Optional: ensure this image is in your /public folder of your Next.js app
        },
        data: {
          // Optional: You can send additional data for in-app handling
          url: "/dashboard/notifications", // e.g., to open a specific page on click
          notificationId: notificationId,
        },
      };

      // Send messages to the tokens.
      const response = await admin.messaging().sendToDevice(uniqueTokens, messagePayload);

      functions.logger.log("Successfully sent message(s):", response.successCount, "failures:", response.failureCount);

      // Clean up invalid tokens (optional but good practice)
      // const tokensToRemove: Promise<any>[] = []; // Commented out as its usage is commented out
      response.results.forEach((result: admin.messaging.MessagingDeviceResult, index: number) => { // Explicit types
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
            // Example: tokensToRemove.push(db.collection('users').doc(userIdWithInvalidToken).update({ fcmTokens: admin.firestore.FieldValue.arrayRemove(uniqueTokens[index]) }));
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
