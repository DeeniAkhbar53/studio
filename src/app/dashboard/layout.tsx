
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/dashboard/header";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import Link from "next/link";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { updateUserOneSignalPlayerId } from "@/lib/firebase/userService"; // Import the service

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
    if (isAuthenticated === false) return; // Don't initialize if not authenticated
    if (isAuthenticated === null) return; // Don't initialize if auth state is still loading

    if (typeof window !== 'undefined') {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async function(OneSignal: any) {
        if (!OneSignal) {
            console.error("OneSignal SDK not loaded.");
            return;
        }
        await OneSignal.init({
          appId: "c5b623d9-48b0-460a-b525-8ddfc7553058",
          safari_web_id: "YOUR_SAFARI_WEB_ID_IF_APPLICABLE", 
          allowLocalhostAsSecureOrigin: true,
          autoRegister: false,
          notifyButton: {
             enable: false,
          },
        });

        const isEnabled = await OneSignal.isPushNotificationsEnabled();
        if (isEnabled) {
            console.log("Push notifications are already enabled!");
            const playerId = OneSignal.User.PushSubscription.id;
            if (playerId) {
              const userItsId = localStorage.getItem('userItsId');
              const userMohallahId = localStorage.getItem('userMohallahId');
              if (userItsId && userMohallahId) {
                console.log("Attempting to save OneSignal Player ID:", playerId, "for user:", userItsId);
                await updateUserOneSignalPlayerId(userItsId, userMohallahId, playerId);
              }
            }
        } else {
            console.log("Push notifications are not enabled. Will attempt to prompt.");
            setTimeout(() => {
              OneSignal.Slidedown.promptPush({
                force: false,
                slidedownPromptOptions: {
                  actionMessage: "We'd like to show you notifications for new announcements.",
                  acceptButtonText: "Allow",
                  cancelButtonText: "No Thanks",
                }
              }).then(async (accepted: boolean) => {
                if (accepted) {
                  console.log("User accepted push notifications.");
                  const playerId = OneSignal.User.PushSubscription.id;
                  if (playerId) {
                    const userItsId = localStorage.getItem('userItsId');
                    const userMohallahId = localStorage.getItem('userMohallahId');
                    if (userItsId && userMohallahId) {
                       console.log("Attempting to save OneSignal Player ID after prompt:", playerId, "for user:", userItsId);
                       await updateUserOneSignalPlayerId(userItsId, userMohallahId, playerId);
                    }
                  }
                } else {
                  console.log("User dismissed or blocked push notifications.");
                }
              });
            }, 5000);
        }

        OneSignal.on('notificationDisplay', (event: any) => {
          console.log('OneSignal notification displayed:', event);
          toast({
            title: event.heading || "New Notification",
            description: event.content,
          });
        });
      });
    }
  }, [isAuthenticated, toast]); 

  if (isAuthenticated === null) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // This effectively prevents rendering anything until the redirect happens.
    // router.push should be handled by the first useEffect.
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
