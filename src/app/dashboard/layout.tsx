
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/dashboard/header";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import Link from "next/link";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { FunkyLoader } from "@/components/ui/funky-loader";
import { addLogoutLog } from "@/lib/firebase/logService";
import { clearUserSession, getUserByItsOrBgkId } from "@/lib/firebase/userService";

// FCM specific imports
import { getMessaging, getToken, onMessage, MessagePayload } from "firebase/messaging";
import { updateUserFcmToken } from "@/lib/firebase/userService"; 
import { app } from "@/lib/firebase/firebase"; // Import the initialized app

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [fcmTokenStatus, setFcmTokenStatus] = useState<string>("idle");
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);

  const handleLogout = useCallback(async (reason: 'manual' | 'inactive' | 'invalid_session') => {
    const userItsId = localStorage.getItem('userItsId');
    const userName = localStorage.getItem('userName') || 'Unknown User';
    const sessionId = localStorage.getItem('sessionId');

    if (reason === 'inactive' && userItsId && sessionId) {
      await addLogoutLog(userName, userItsId, sessionId);
      toast({
        title: "Session Expired",
        description: "You have been logged out due to inactivity.",
        variant: "destructive"
      });
    } else if (reason === 'invalid_session') {
       toast({
        title: "Session Invalidated",
        description: "Your session has ended, possibly because you logged in on another device.",
        variant: "destructive"
      });
    }

    if (userItsId) {
      try {
        // IMPORTANT: Clear the database session *before* clearing local storage.
        await clearUserSession(userItsId);
      } catch (error) {
        console.error("Failed to clear user session from database:", error);
      }
    }

    if (typeof window !== "undefined") {
      localStorage.clear();
      router.push('/');
    }
  }, [router, toast]);


  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    inactivityTimer.current = setTimeout(() => {
      handleLogout('inactive');
    }, INACTIVITY_TIMEOUT_MS);
  }, [handleLogout]);

  useEffect(() => {
    const validateSession = async () => {
        const userItsId = localStorage.getItem('userItsId');
        const localSessionId = localStorage.getItem('sessionId');

        if (!userItsId || !localSessionId) {
            setIsAuthenticated(false);
            router.push('/');
            return;
        }

        try {
            const user = await getUserByItsOrBgkId(userItsId);
            if (user && user.sessionId === localSessionId) {
                // Session is valid
                setIsAuthenticated(true);
            } else {
                // Session is invalid (different ID or user has no ID in DB)
                setIsAuthenticated(false);
                handleLogout('invalid_session');
            }
        } catch (error) {
            console.error("Session validation error:", error);
            setIsAuthenticated(false);
            handleLogout('invalid_session');
        }
    };
    
    validateSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);
  
  useEffect(() => {
    if (isAuthenticated) {
      const events = ['mousemove', 'keydown', 'click', 'scroll'];
      
      const handleActivity = () => {
        resetInactivityTimer();
      };

      events.forEach(event => {
        window.addEventListener(event, handleActivity);
      });
      
      resetInactivityTimer(); // Start the timer initially

      return () => {
        events.forEach(event => {
          window.removeEventListener(event, handleActivity);
        });
        if (inactivityTimer.current) {
          clearTimeout(inactivityTimer.current);
        }
      };
    }
  }, [isAuthenticated, resetInactivityTimer]);


  /*
  // FCM Setup Effect - DISABLED FOR NOW
  useEffect(() => {
    if (typeof window === 'undefined' || !("Notification" in window) || !("serviceWorker" in navigator)) {
        console.log("FCM Setup: Browser doesn't support notifications or service workers. Skipping FCM setup.");
        setFcmTokenStatus("unsupported_browser");
        return;
    }
    
    if (isAuthenticated === false) {
      console.log("FCM Setup: User not authenticated. Skipping FCM setup.");
      setFcmTokenStatus("skipped_pre_auth");
      return;
    }
    if (isAuthenticated === null) {
        console.log("FCM Setup: Auth state still loading, skipping FCM setup for now.");
        setFcmTokenStatus("auth_loading");
        return;
    }

    const setupFCM = async () => {
      setFcmTokenStatus("starting_setup");
      
      try {
        console.log("FCM Setup: Attempting to initialize messaging...");
        const messaging = getMessaging(app);
        console.log("FCM Setup: Messaging instance acquired.");
        
        // This is a public key for web push notifications. It's safe to be here.
        const VAPID_KEY = "BBk_BA4472SBY7GqHVabGCDT-lg1m535sZNvmxH0TVhqcndkTDXJulJ1GNB2fAbxE4kLvgcQSdx6vIOuBAhVFSI";
        
        const handleTokenLogic = async () => {
            console.log("FCM Setup: Retrieving token...");
            setFcmTokenStatus("retrieving_token");
            try {
                // Register the service worker and get the token
                const currentToken = await getToken(messaging, { 
                  vapidKey: VAPID_KEY,
                  serviceWorkerRegistration: await navigator.serviceWorker.register('/firebase-messaging-sw.js'),
                });

                if (currentToken) {
                    console.log("FCM Setup: Token retrieved:", currentToken);
                    const userItsId = localStorage.getItem("userItsId");
                    const userMohallahId = localStorage.getItem("userMohallahId");
                    if (userItsId) {
                        await updateUserFcmToken(userItsId, userMohallahId || '', currentToken);
                        console.log("FCM Setup: Token stored successfully for user.");
                        setFcmTokenStatus("token_stored");
                        // toast({
                        //     title: "Push Notifications Enabled",
                        //     description: "You will receive updates via push notifications.",
                        // });
                    } else {
                        console.warn("FCM Setup: User ITS ID not found in localStorage for token storage.");
                        setFcmTokenStatus("error_storing_missing_user_details");
                    }
                } else {
                    console.warn("FCM Setup: No registration token available. This can happen if the service worker isn't registered correctly or there's an issue with the VAPID key.");
                    setFcmTokenStatus("no_token_available");
                    toast({
                      variant: "destructive",
                      title: "Notification Permission Needed",
                      description: "Please allow notifications to enable this feature.",
                    });
                }
            } catch(err) {
                 console.error('FCM Setup: An error occurred while retrieving token. ', err);
                 setFcmTokenStatus("error_retrieving_token");
                 if (err instanceof Error && err.message.includes("permission")) {
                    toast({ variant: "destructive", title: "Permission Denied", description: "You have blocked notifications. Please enable them in your browser settings."});
                 } else {
                    toast({ variant: "destructive", title: "Token Error", description: "Could not retrieve notification token. See console for details."});
                 }
            }
        };

        if (Notification.permission === "granted") {
          console.log("FCM Setup: Notification permission already granted.");
          await handleTokenLogic();
        } else if (Notification.permission === "default") {
          console.log("FCM Setup: Notification permission is 'default'. Requesting permission...");
          setFcmTokenStatus("requesting_permission");
          const permission = await Notification.requestPermission();
          console.log("FCM Setup: Permission request result:", permission);

          if (permission === "granted") {
            console.log("FCM Setup: Notification permission granted by user.");
            await handleTokenLogic();
          } else {
            console.log("FCM Setup: Notification permission denied by user after request.");
            setFcmTokenStatus("permission_denied_after_request");
            toast({
              variant: "default",
              title: "Push Notifications Disabled",
              description: "You chose not to receive push notifications.",
            });
          }
        } else { // Notification.permission === "denied"
           console.warn("FCM Setup: Notification permission was previously denied by the user.");
           setFcmTokenStatus("permission_denied_previously");
           toast({
             variant: "destructive",
             title: "Push Notifications Blocked",
             description: "Notifications are blocked. Please enable them in your browser's site settings.",
             duration: 10000,
           });
        }

        // Handle incoming messages when the app is in the foreground
        console.log("FCM Setup: Setting up foreground message listener.");
        const unsubscribeOnMessage = onMessage(messaging, (payload: MessagePayload) => {
          console.log("FCM: Message received in foreground.", payload);
          setFcmTokenStatus("foreground_message_received");
          toast({
            title: payload.notification?.title || "New Notification",
            description: payload.notification?.body,
          });
        });
        
        return () => {
          console.log("FCM Setup: Cleaning up foreground message listener.");
          unsubscribeOnMessage();
        };

      } catch (error) {
        console.error("FCM Setup: Major error during setup:", error);
        setFcmTokenStatus("error_during_setup");
        toast({
          variant: "destructive",
          title: "Push Notification Error",
          description: "Could not set up push notifications. See console for details.",
        });
      }
    };
    
    if (isAuthenticated) {
        console.log("FCM Setup: User is authenticated, proceeding with FCM setup.");
        // setupFCM();
    } else {
        console.log("FCM Setup: User is not authenticated, skipping FCM setup.");
        setFcmTokenStatus("skipped_not_authenticated");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);
  */

  useEffect(() => {
    console.log("FCM Token Status Changed:", fcmTokenStatus);
  }, [fcmTokenStatus]);

  if (isAuthenticated === null) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <FunkyLoader size="lg">Initializing Session...</FunkyLoader>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; 
  }

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <aside className="hidden border-r bg-sidebar md:block print-hide">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-20 items-center border-b px-4 lg:px-6">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-sidebar-primary">
               <Image
                 src="/logo.png"
                 alt="BGK Attendance Logo"
                 width={48}
                 height={48}
                 className="h-12 w-12"
               />
              <span className="text-sidebar-foreground">BGK Attendance</span>
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto">
            <SidebarNav />
          </div>
        </div>
      </aside>
      <div className="flex flex-col md:h-screen md:overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6 lg:p-8">
          {children}
        </main>
        <footer className="border-t bg-card py-3 px-6 text-muted-foreground mt-auto print-hide">
          <div className="text-left">
            <p className="text-xs">&copy; {new Date().getFullYear()} BGK Attendance. All rights reserved.</p>
            <p className="text-xs text-muted-foreground/80 mt-0.5">Designed and Managed by Shabbir Shakir</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
