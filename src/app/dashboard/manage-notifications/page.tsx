
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { NotificationItem } from "@/types";
import { PlusCircle, Trash2, BellRing } from "lucide-react";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";

const NOTIFICATIONS_STORAGE_KEY = "appNotifications";

export default function ManageNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [newNotificationTitle, setNewNotificationTitle] = useState("");
  const [newNotificationContent, setNewNotificationContent] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const storedNotifications = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (storedNotifications) {
      setNotifications(JSON.parse(storedNotifications));
    }
  }, []);

  const saveNotifications = (updatedNotifications: NotificationItem[]) => {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updatedNotifications));
    setNotifications(updatedNotifications);
  };

  const handlePostNotification = () => {
    if (!newNotificationTitle.trim() || !newNotificationContent.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both a title and content for the notification.",
        variant: "destructive",
      });
      return;
    }

    const newNotification: NotificationItem = {
      id: `notif_${Date.now()}`,
      title: newNotificationTitle.trim(),
      content: newNotificationContent.trim(),
      createdAt: new Date().toISOString(),
      read: false,
    };

    const updatedNotifications = [newNotification, ...notifications];
    saveNotifications(updatedNotifications);

    toast({
      title: "Notification Posted",
      description: `"${newNotification.title}" has been successfully posted.`,
    });
    setNewNotificationTitle("");
    setNewNotificationContent("");
  };

  const handleDeleteNotification = (id: string) => {
    const updatedNotifications = notifications.filter(notif => notif.id !== id);
    saveNotifications(updatedNotifications);
    toast({
      title: "Notification Deleted",
      description: "The notification has been removed.",
    });
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center"><BellRing className="mr-2 h-6 w-6 text-primary" />Manage Notifications & Announcements</CardTitle>
          <Separator className="my-2" />
          <CardDescription>Create and publish new notifications for all users.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="notification-title">Notification Title</Label>
            <Input
              id="notification-title"
              value={newNotificationTitle}
              onChange={(e) => setNewNotificationTitle(e.target.value)}
              placeholder="Enter notification title"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="notification-content">Notification Content</Label>
            <Textarea
              id="notification-content"
              value={newNotificationContent}
              onChange={(e) => setNewNotificationContent(e.target.value)}
              placeholder="Enter notification details..."
              className="mt-1 min-h-[100px]"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handlePostNotification}>
            <PlusCircle className="mr-2 h-4 w-4" /> Post Notification
          </Button>
        </CardFooter>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Posted Notifications</CardTitle>
          <Separator className="my-2" />
          <CardDescription>List of all active notifications. Newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No notifications posted yet.</p>
          ) : (
            <ul className="space-y-4">
              {notifications.map((notification) => (
                <li key={notification.id} className="p-4 border rounded-lg bg-card flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-card-foreground">{notification.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{notification.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Posted: {format(new Date(notification.createdAt), "PPp")}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteNotification(notification.id)}
                    className="text-destructive hover:text-destructive"
                    aria-label="Delete notification"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
