
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/dashboard/header";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import Link from "next/link";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { updateUserOneSignalPlayerId } from "@/lib/firebase/userService";

// Declare OneSignal on window type for TypeScript
declare global {
  interface Window {
    OneSignalDeferred?: any[];
    OneSignal?: any;
  }
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

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

  useEffect(() => {
    if (isAuthenticated === false) {
      console.log("OneSignal: User not authenticated, skipping OneSignal setup.");
      return;
    }
    if (isAuthenticated === null) {
      console.log("OneSignal: Auth state still loading, skipping OneSignal setup for now.");
      return;
    }

    let oneSignalCleanup = () => {};

    if (typeof window !== 'undefined') {
      console.log("OneSignal: isAuthenticated is true, proceeding with OneSignal setup.");
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async function(OneSignal: any) {
        if (!OneSignal) {
            console.error("OneSignal SDK not loaded into OneSignalDeferred.");
            return;
        }
        console.log("OneSignal: SDK Deferred function executed. Initializing OneSignal...");
        await OneSignal.init({
          appId: "c5b623d9-48b0-460a-b525-8ddfc7553058",
          safari_web_id: "YOUR_SAFARI_WEB_ID_IF_APPLICABLE", // Replace if targeting Safari
          allowLocalhostAsSecureOrigin: true,
          autoRegister: false, // We will prompt manually
          notifyButton: {
             enable: false, // We are using slidedown prompt
          },
        });
        console.log("OneSignal: SDK Initialized.", OneSignal);

        const isEnabled = await OneSignal.isPushNotificationsEnabled();
        console.log("OneSignal: Push notifications enabled status (isPushNotificationsEnabled):", isEnabled);

        if (OneSignal.Notifications && typeof OneSignal.Notifications.permission !== 'undefined') {
            console.log("OneSignal: OneSignal.Notifications.permission:", OneSignal.Notifications.permission);
        }


        if (isEnabled) {
            console.log("OneSignal: Push notifications are ALREADY enabled by user!");
            try {
                const playerId = OneSignal.User.PushSubscription.id;
                if (playerId) {
                  console.log("OneSignal: Player ID found:", playerId);
                  const userItsId = localStorage.getItem('userItsId');
                  const userMohallahId = localStorage.getItem('userMohallahId');
                  if (userItsId && userMohallahId) {
                    console.log("OneSignal: Attempting to save Player ID:", playerId, "for user:", userItsId);
                    await updateUserOneSignalPlayerId(userItsId, userMohallahId, playerId);
                  } else {
                    console.warn("OneSignal: User ITS ID or Mohallah ID not found in localStorage, cannot save Player ID.");
                  }
                } else {
                  console.warn("OneSignal: Player ID is null/undefined even though notifications are reported as enabled.");
                }
            } catch (e) {
                console.error("OneSignal: Error getting or saving Player ID when already enabled:", e);
            }
        } else {
            console.log("OneSignal: Push notifications are NOT enabled. Attempting to prompt.");
            if (OneSignal.Slidedown) {
                console.log("OneSignal: Attempting to show Slidedown prompt with force:true...");
                OneSignal.Slidedown.promptPush({
                  force: true, // DEBUG: Force prompt to show even if previously dismissed/blocked
                  slidedownPromptOptions: {
                    actionMessage: "We'd like to show you notifications for new announcements.",
                    acceptButtonText: "Allow",
                    cancelButtonText: "No Thanks",
                  }
                }).then(async (accepted: boolean) => {
                  console.log("OneSignal: Slidedown prompt response. Accepted:", accepted);
                  if (accepted) {
                    console.log("OneSignal: User accepted push notifications via prompt.");
                    try {
                        const playerId = OneSignal.User.PushSubscription.id;
                        if (playerId) {
                          console.log("OneSignal: Player ID found after prompt:", playerId);
                          const userItsId = localStorage.getItem('userItsId');
                          const userMohallahId = localStorage.getItem('userMohallahId');
                          if (userItsId && userMohallahId) {
                            console.log("OneSignal: Attempting to save Player ID after prompt:", playerId, "for user:", userItsId);
                            await updateUserOneSignalPlayerId(userItsId, userMohallahId, playerId);
                          } else {
                            console.warn("OneSignal: User ITS ID or Mohallah ID not found in localStorage, cannot save Player ID after prompt.");
                          }
                        } else {
                           console.warn("OneSignal: Player ID is null/undefined after accepting prompt.");
                        }
                    } catch (e) {
                        console.error("OneSignal: Error getting or saving Player ID after prompt:", e);
                    }
                  } else {
                    console.log("OneSignal: User dismissed or blocked push notifications via prompt.");
                  }
                });
            } else {
                console.error("OneSignal: OneSignal.Slidedown object is not available. Cannot show prompt.");
            }
        }

        OneSignal.on('notificationDisplay', (event: any) => {
          console.log('OneSignal: notificationDisplay event received by SDK:', event);
          toast({
            title: event.heading || "New Notification",
            description: event.content,
          });
        });
        
        oneSignalCleanup = () => {
            // OneSignal doesn't have a general 'destroy' or 'offAll' method.
            // Specific listeners would need to be removed if added beyond 'notificationDisplay'.
            // For slidedown, if it's modal, it usually handles its own dismissal.
            // If OneSignal.Slidedown.remove() is a valid API for cleanup, it can be used.
            // For now, we'll rely on OneSignal's internal management post-interaction.
            console.log("OneSignal: Cleanup function called. (No specific OneSignal resource removal implemented here)");
        };
      });
    }
    return () => {
        // Call the cleanup function defined within the OneSignalDeferred scope
        oneSignalCleanup();
    };
  }, [isAuthenticated, toast]); // Added toast to dependencies as it's used in the effect

  if (isAuthenticated === null) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
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
