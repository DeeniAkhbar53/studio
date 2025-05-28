
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { NotificationItem, UserRole } from "@/types";
import { PlusCircle, Trash2, BellRing, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { addNotification, getNotificationsForUser, deleteNotification } from "@/lib/firebase/notificationService";

export default function ManageNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newNotificationTitle, setNewNotificationTitle] = useState("");
  const [newNotificationContent, setNewNotificationContent] = useState("");
  const [newNotificationAudience, setNewNotificationAudience] = useState<'all' | UserRole>('all');
  const [currentUserItsId, setCurrentUserItsId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);


  const { toast } = useToast();

  useEffect(() => {
    const itsId = localStorage.getItem('userItsId');
    const role = localStorage.getItem('userRole') as UserRole | null;
    setCurrentUserItsId(itsId);
    setCurrentUserRole(role);
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!currentUserItsId || !currentUserRole) return;
    setIsLoading(true);
    try {
      const fetchedNotifications = await getNotificationsForUser(currentUserItsId, currentUserRole);
      setNotifications(fetchedNotifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      console.error("Failed to fetch notifications for management:", error);
      toast({ title: "Error", description: "Could not load notifications.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [currentUserItsId, currentUserRole, toast]);

  useEffect(() => {
    if (currentUserItsId && currentUserRole) {
      fetchNotifications();
    }
  }, [fetchNotifications, currentUserItsId, currentUserRole]);


  const handlePostNotification = async () => {
    if (!newNotificationTitle.trim() || !newNotificationContent.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide title, content, and audience.",
        variant: "destructive",
      });
      return;
    }
    if (!currentUserItsId) {
      toast({ title: "Error", description: "User ITS ID not found. Cannot post notification.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await addNotification({
        title: newNotificationTitle.trim(),
        content: newNotificationContent.trim(),
        targetAudience: newNotificationAudience,
        createdBy: currentUserItsId,
      });
      toast({
        title: "Notification Posted",
        description: `"${newNotificationTitle.trim()}" has been successfully posted.`,
      });
      setNewNotificationTitle("");
      setNewNotificationContent("");
      setNewNotificationAudience('all');
      fetchNotifications(); 
      window.dispatchEvent(new CustomEvent('notificationsUpdated'));
    } catch (error) {
      console.error("Failed to post notification:", error);
      toast({ title: "Error", description: "Could not post notification.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await deleteNotification(id);
      toast({
        title: "Notification Deleted",
        description: "The notification has been removed.",
      });
      fetchNotifications(); 
      window.dispatchEvent(new CustomEvent('notificationsUpdated'));
    } catch (error) {
      console.error("Failed to delete notification:", error);
      toast({ title: "Error", description: "Could not delete notification.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center"><BellRing className="mr-2 h-6 w-6 text-primary" />Manage Notifications</CardTitle>
          <Separator className="my-2" />
          <CardDescription>Create and publish new notifications for specific user groups or all users.</CardDescription>
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
              disabled={isSubmitting}
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
              disabled={isSubmitting}
            />
          </div>
          <div>
            <Label htmlFor="notification-audience">Target Audience</Label>
            <Select value={newNotificationAudience} onValueChange={(value) => setNewNotificationAudience(value as 'all' | UserRole)} disabled={isSubmitting}>
              <SelectTrigger id="notification-audience" className="mt-1">
                <SelectValue placeholder="Select target audience" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="user">Regular Users Only</SelectItem>
                <SelectItem value="attendance-marker">Attendance Markers Only</SelectItem>
                <SelectItem value="admin">Admins Only</SelectItem>
                <SelectItem value="superadmin">Super Admins Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handlePostNotification} disabled={isSubmitting || isLoading} size="sm">
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
             Post Notification
          </Button>
        </CardFooter>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Posted Notifications Log</CardTitle>
          <Separator className="my-2" />
          <CardDescription>List of all active notifications visible to you for management. Newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No notifications posted yet or visible to your role for management.</p>
          ) : (
            <ul className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {notifications.map((notification) => (
                <li key={notification.id} className="p-4 border rounded-lg bg-card flex justify-between items-start gap-4">
                  <div className="flex-grow">
                    <h3 className="font-semibold text-card-foreground">{notification.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Target: {notification.targetAudience.charAt(0).toUpperCase() + notification.targetAudience.slice(1)} | By: {notification.createdBy}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{notification.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Posted: {format(new Date(notification.createdAt), "PPp")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Read by: {notification.readBy?.length || 0} user(s)
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteNotification(notification.id)}
                    className="text-destructive hover:text-destructive shrink-0"
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
