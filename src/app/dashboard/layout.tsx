
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/dashboard/header";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import Link from "next/link";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// FCM specific imports
import { messaging } from "@/lib/firebase/firebase"; // Get messaging instance
import { getToken, onMessage, MessagePayload } from "firebase/messaging";
import { updateUserFcmToken } from "@/lib/firebase/userService"; // To store token

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [fcmTokenStatus, setFcmTokenStatus] = useState<string>("idle"); // For tracking FCM setup

  useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    const userItsId = localStorage.getItem('userItsId');

    if (!userRole || !userItsId) {
      setIsAuthenticated(false);
      router.push('/');
    } else {
      setIsAuthenticated(true);
    }
  }, [router]);

  // FCM Setup Effect
  useEffect(() => {
    if (isAuthenticated === false || typeof window === 'undefined' || !("Notification" in window)) {
      console.log("FCM: User not authenticated or Notifications not supported.");
      return;
    }
    if (isAuthenticated === null) {
        console.log("FCM: Auth state still loading, skipping FCM setup for now.");
        return;
    }

    const setupFCM = async () => {
      const messagingInstance = await messaging();
      if (!messagingInstance) {
        console.log("FCM: Firebase Messaging is not supported in this browser.");
        setFcmTokenStatus("unsupported");
        return;
      }

      console.log("FCM: Current Notification permission state:", Notification.permission);

      try {
        if (Notification.permission === "granted") {
          setFcmTokenStatus("retrieving");
          console.log("FCM: Notification permission already granted. Getting token...");
          const currentToken = await getToken(messagingInstance, {
            vapidKey: "BBk_BA4472SBY7GqHVabGCDT-lg1m535sZNvmxH0TVhqcndkTDXJulJ1GNB2fAbxE4kLvgcQSdx6vIOuBAhVFSI",
          });

          if (currentToken) {
            console.log("FCM: Token retrieved:", currentToken);
            const userItsId = localStorage.getItem("userItsId");
            const userMohallahId = localStorage.getItem("userMohallahId");
            if (userItsId && userMohallahId) {
              await updateUserFcmToken(userItsId, userMohallahId, currentToken);
              console.log("FCM: Token stored for user.");
              setFcmTokenStatus("stored");
            } else {
              console.warn("FCM: User ITS ID or Mohallah ID not found for token storage.");
              setFcmTokenStatus("error_storing");
            }
          } else {
            console.warn("FCM: No registration token available despite permission being granted. This can happen if the service worker isn't registered correctly or there's an issue with the VAPID key.");
            setFcmTokenStatus("no_token_permission_granted");
          }
        } else if (Notification.permission === "default") {
          console.log("FCM: Requesting notification permission...");
          setFcmTokenStatus("requesting_permission");
          const permission = await Notification.requestPermission();
          console.log("FCM: Permission request result:", permission);
          if (permission === "granted") {
            console.log("FCM: Notification permission granted by user.");
            setFcmTokenStatus("retrieving_after_grant");
            const currentToken = await getToken(messagingInstance, {
              vapidKey: "BBk_BA4472SBY7GqHVabGCDT-lg1m535sZNvmxH0TVhqcndkTDXJulJ1GNB2fAbxE4kLvgcQSdx6vIOuBAhVFSI",
            });
            if (currentToken) {
              console.log("FCM: Token retrieved after grant:", currentToken);
              const userItsId = localStorage.getItem("userItsId");
              const userMohallahId = localStorage.getItem("userMohallahId");
              if (userItsId && userMohallahId) {
                await updateUserFcmToken(userItsId, userMohallahId, currentToken);
                console.log("FCM: Token stored after grant.");
                setFcmTokenStatus("stored");
              } else {
                console.warn("FCM: User ITS ID or Mohallah ID not found for token storage after grant.");
                setFcmTokenStatus("error_storing");
              }
            } else {
               console.warn("FCM: Failed to get token even after permission grant.");
               setFcmTokenStatus("error_retrieving_token");
            }
          } else {
            console.log("FCM: Notification permission denied by user.");
            setFcmTokenStatus("permission_denied");
            toast({
              variant: "default", // Changed to default as it's user choice
              title: "Push Notifications Disabled",
              description: "You will not receive push notifications.",
            });
          }
        } else { // Notification.permission === "denied"
           console.log("FCM: Notification permission was previously denied.");
           setFcmTokenStatus("permission_denied_previously");
           // Optionally, inform the user how to re-enable if they want to
        }
      } catch (error) {
        console.error("FCM: Error during setup or token retrieval:", error);
        setFcmTokenStatus("error_setup");
        toast({
          variant: "destructive",
          title: "Push Notification Error",
          description: "Could not set up push notifications. See console for details.",
        });
      }

      // Handle incoming messages when the app is in the foreground
      const unsubscribeOnMessage = onMessage(messagingInstance, (payload: MessagePayload) => {
        console.log("FCM: Message received in foreground.", payload);
        toast({
          title: payload.notification?.title || "New Notification",
          description: payload.notification?.body,
        });
      });
      
      return () => {
        unsubscribeOnMessage();
      };
    };
    
    if (isAuthenticated) { // Only run setup if user is authenticated
        setupFCM();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]); // toast is stable, no need to add setupFCM to deps array

  if (isAuthenticated === null) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // router.push('/') is handled in the first useEffect, so this return null is fine
    return null; 
  }

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <aside className="hidden border-r bg-sidebar md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-16 items-center border-b px-4 lg:px-6">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-sidebar-primary">
               <Image
                 src="https://app.burhaniguards.org/images/logo.png"
                 alt="BGK Attendance Logo"
                 width={32}
                 height={32}
                 className="h-8 w-8"
               />
              <span className="text-sidebar-foreground">BGK Attendance</span>
            </Link>
          </div>
          <div className="flex-1">
            <SidebarNav />
          </div>
        </div>
      </aside>
      <div className="flex flex-col">
        <Header />
        <main className="flex-1 overflow-auto bg-background p-4 md:p-6">
          {children}
        </main>
        <footer className="border-t bg-card py-3 px-6 text-muted-foreground">
          <div className="text-left">
            <p className="text-xs">&copy; {new Date().getFullYear()} BGK Attendance. All rights reserved.</p>
            <p className="text-xs text-muted-foreground/80 mt-0.5">Designed and Managed by Shabbir Shakir</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
