
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { NotificationItem } from "@/types";
import { Bell, Info } from "lucide-react";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";

const NOTIFICATIONS_STORAGE_KEY = "appNotifications";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedNotificationsString = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    let updatedNotifications: NotificationItem[] = [];
    if (storedNotificationsString) {
      const parsedNotifications: NotificationItem[] = JSON.parse(storedNotificationsString);
      // Mark all as read
      updatedNotifications = parsedNotifications.map(notif => ({ ...notif, read: true }));
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updatedNotifications));
      setNotifications(updatedNotifications.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }
    setIsLoading(false);
     // Trigger a custom event to notify the header to update the unread count
    window.dispatchEvent(new CustomEvent('notificationsUpdated'));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Loading notifications...</p>
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
          <CardDescription>All recent updates and important information. Newest first.</CardDescription>
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
                <li key={notification.id} className={`p-6 border rounded-xl ${notification.read ? 'bg-card' : 'bg-primary/5 border-primary/20'}`}>
                  <h3 className="text-xl font-semibold text-foreground">{notification.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    Posted on: {format(new Date(notification.createdAt), "MMMM d, yyyy 'at' h:mm a")}
                  </p>
                  <p className="text-foreground whitespace-pre-wrap leading-relaxed">{notification.content}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
