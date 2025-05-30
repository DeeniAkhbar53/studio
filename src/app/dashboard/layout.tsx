
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/dashboard/header";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import Link from "next/link";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
// Removed Firebase messaging imports as OneSignal will handle push notifications

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
    // Initialize OneSignal
    // Ensure this runs only after the component is mounted and window is available
    if (typeof window !== 'undefined') {
      const OneSignal = window.OneSignal || [];
      const ONE_SIGNAL_APP_ID = "YOUR_ONESIGNAL_APP_ID_HERE"; // IMPORTANT: Replace with your actual OneSignal App ID

      if (!ONE_SIGNAL_APP_ID || ONE_SIGNAL_APP_ID === "YOUR_ONESIGNAL_APP_ID_HERE") {
        console.warn("OneSignal App ID is not configured. Push notifications will not work.");
        toast({
          title: "Notification Setup Incomplete",
          description: "Push notification service is not fully configured (App ID missing).",
          variant: "destructive",
          duration: 10000,
        });
        return;
      }

      OneSignal.push(() => {
        OneSignal.init({
          appId: ONE_SIGNAL_APP_ID,
          safari_web_id: "YOUR_SAFARI_WEB_ID_IF_APPLICABLE", // Optional, for Safari
          allowLocalhostAsSecureOrigin: true, // Useful for development
          autoRegister: false, // We will prompt manually
          notifyButton: {
             enable: false, // We will use our own UI/prompt logic
          },
        });

        // Check if user is already subscribed
        OneSignal.isPushNotificationsEnabled((isEnabled) => {
          if (isEnabled) {
            console.log("Push notifications are already enabled!");
            // Optionally, you could get the OneSignal Player ID here and store it
            // OneSignal.getUserId().then((userId) => {
            //   console.log("OneSignal User ID:", userId);
            //   // Call your service to store userId if needed
            // });
          } else {
            // If not enabled, you might want to show a custom UI element to prompt them
            // For now, we'll use the slidedown prompt after a short delay
            // to ensure the page context is clear to the user.
            console.log("Push notifications are not enabled. Will attempt to prompt.");
            // Example of prompting after a delay or user interaction
            // For simplicity, prompting after a short delay here.
            // In a real app, tie this to a user action or a more contextual moment.
            setTimeout(() => {
              OneSignal.Slidedown.promptPush({
                force: false, // Set to true to always show, even if previously dismissed by user (use with caution)
                slidedownPromptOptions: {
                  actionMessage: "We'd like to show you notifications for new announcements.",
                  acceptButtonText: "Allow",
                  cancelButtonText: "No Thanks",
                }
              }).then((accepted) => {
                if (accepted) {
                  console.log("User accepted push notifications.");
                  OneSignal.getUserId().then((userId) => {
                     console.log("OneSignal User ID:", userId);
                     // Here you would typically send this userId to your backend
                     // to associate it with the current logged-in user.
                     // For this iteration, we are not storing Player IDs back to Firestore.
                     // const userItsId = localStorage.getItem('userItsId');
                     // const userMohallahId = localStorage.getItem('userMohallahId');
                     // if (userId && userItsId && userMohallahId) {
                     //   updateUserOneSignalPlayerId(userItsId, userMohallahId, userId)
                     //     .then(() => console.log('OneSignal Player ID stored for user.'))
                     //     .catch(err => console.error('Failed to store OneSignal Player ID:', err));
                     // }
                  });
                } else {
                  console.log("User dismissed or blocked push notifications.");
                }
              });
            }, 5000); // Prompt after 5 seconds
          }
        });

        // Handle foreground push notifications (optional, if you want custom in-app display)
        // OneSignal handles displaying system notifications when app is backgrounded/closed by default via service worker
        OneSignal.on('notificationDisplay', (event) => {
          console.log('OneSignal notification displayed:', event);
          // You could show a custom in-app notification/toast here as well
          toast({
            title: event.heading || "New Notification",
            description: event.content,
          });
        });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]); // Re-run if isAuthenticated changes, to ensure prompt happens post-login context

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
          <div>
            <p className="text-xs text-left">&copy; {new Date().getFullYear()} BGK Attendance. All rights reserved.</p>
            <p className="text-xs text-left text-muted-foreground/80 mt-0.5">Designed and Managed by Shabbir Shakir</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
