
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { NotificationItem, UserRole } from "@/types";
import { Bell, Info, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { getNotificationsForUser, markNotificationAsRead } from "@/lib/firebase/notificationService";
import { useToast } from "@/hooks/use-toast";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserItsId, setCurrentUserItsId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const itsId = localStorage.getItem('userItsId');
    const role = localStorage.getItem('userRole') as UserRole | null;
    setCurrentUserItsId(itsId);
    setCurrentUserRole(role);
    console.log("[NotificationsPage useEffect] Loaded from localStorage - ITS ID:", itsId, "Role:", role);
  }, []);

  const fetchAndMarkNotifications = useCallback(async () => {
    if (!currentUserItsId || !currentUserRole) {
      setIsLoading(false);
      console.log("[NotificationsPage fetchAndMark] Skipping fetch: No ITS ID or Role.", { currentUserItsId, currentUserRole });
      return;
    }
    setIsLoading(true);
    console.log("[NotificationsPage fetchAndMark] Fetching for ITS:", currentUserItsId, "Role:", currentUserRole);
    try {
      const fetchedNotifications = await getNotificationsForUser(currentUserItsId, currentUserRole);
      console.log("[NotificationsPage fetchAndMark] Fetched raw notifications:", fetchedNotifications);
      
      const sortedNotifications = fetchedNotifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(sortedNotifications);
      console.log("[NotificationsPage fetchAndMark] Sorted notifications to display:", sortedNotifications);

      // Mark fetched notifications as read for the current user
      const markReadPromises: Promise<void>[] = [];
      sortedNotifications.forEach(notif => {
        if (!notif.readBy?.includes(currentUserItsId)) {
          console.log(`[NotificationsPage fetchAndMark] Marking notification ${notif.id} as read for ${currentUserItsId}`);
          markReadPromises.push(markNotificationAsRead(notif.id, currentUserItsId));
        }
      });
      if (markReadPromises.length > 0) {
        await Promise.all(markReadPromises);
        console.log(`[NotificationsPage fetchAndMark] Marked ${markReadPromises.length} notifications as read.`);
        // Dispatch event so header can update badge
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent('notificationsUpdated'));
        }
      }

    } catch (error) {
      console.error("[NotificationsPage fetchAndMark] Failed to fetch or mark notifications:", error);
      toast({ title: "Error", description: "Could not load notifications.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserItsId, currentUserRole, toast]); // toast is stable

  useEffect(() => {
    if (currentUserItsId && currentUserRole) {
      fetchAndMarkNotifications();
    }
  }, [fetchAndMarkNotifications, currentUserItsId, currentUserRole]);


  if (isLoading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center h-full py-10">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading notifications...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Bell className="mr-2 h-6 w-6 text-primary" />
            Notifications
          </CardTitle>
          <Separator className="my-2" />
          <CardDescription>All recent updates and important information relevant to you. Newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <div className="text-center py-10">
              <Info className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-lg text-muted-foreground">No notifications at the moment.</p>
              <p className="text-sm text-muted-foreground">Check back later for updates.</p>
            </div>
          ) : (
            <ul className="space-y-6">
              {notifications.map((notification) => (
                <li key={notification.id} className={`p-6 border rounded-xl bg-card`}>
                  <h3 className="text-xl font-semibold text-foreground">{notification.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    Posted on: {format(new Date(notification.createdAt), "MMMM d, yyyy 'at' h:mm a")}
                  </p>
                  <p className="text-foreground whitespace-pre-wrap leading-relaxed">{notification.content}</p>
                   <p className="text-xs text-muted-foreground mt-2">
                    Audience: {notification.targetAudience.charAt(0).toUpperCase() + notification.targetAudience.slice(1)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
