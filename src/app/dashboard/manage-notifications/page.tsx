
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { NotificationItem, UserRole } from "@/types";
import { PlusCircle, Trash2, BellRing, Loader2, ShieldAlert, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { addNotification, deleteNotification } from "@/lib/firebase/notificationService";
import { db } from "@/lib/firebase/firebase"; 
import { collection, query, orderBy, getDocs, Timestamp } from "firebase/firestore";
import { allNavItems } from "@/components/dashboard/sidebar-nav";
import { FunkyLoader } from "@/components/ui/funky-loader";

const ITEMS_PER_PAGE = 10;

export default function ManageNotificationsPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newNotificationTitle, setNewNotificationTitle] = useState("");
  const [newNotificationContent, setNewNotificationContent] = useState("");
  const [newNotificationAudience, setNewNotificationAudience] = useState<'all' | UserRole>('all');
  const [currentUserItsId, setCurrentUserItsId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const { toast } = useToast();

  useEffect(() => {
    const role = typeof window !== "undefined" ? localStorage.getItem('userRole') as UserRole : null;
    const pageRightsRaw = typeof window !== "undefined" ? localStorage.getItem('userPageRights') : '[]';
    const pageRights = JSON.parse(pageRightsRaw || '[]');
    const navItem = allNavItems.find(item => item.href === '/dashboard/manage-notifications');
    
    if (navItem) {
      const hasRoleAccess = navItem.allowedRoles?.includes(role || 'user');
      const hasPageRight = pageRights.includes(navItem.href);
      
      if (hasRoleAccess || hasPageRight) {
        setIsAuthorized(true);
      } else {
        setIsAuthorized(false);
        // Redirect after a short delay to show the message
        setTimeout(() => router.replace('/dashboard'), 2000);
      }
    } else {
       setIsAuthorized(false);
       setTimeout(() => router.replace('/dashboard'), 2000);
    }
  }, [router]);

  useEffect(() => {
    if (!isAuthorized) return;
    const itsId = localStorage.getItem('userItsId');
    const name = localStorage.getItem('userName');
    const role = localStorage.getItem('userRole') as UserRole | null;
    setCurrentUserItsId(itsId);
    setCurrentUserName(name);
    setCurrentUserRole(role);
  }, [isAuthorized]);

  const fetchAllNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const notificationsCollectionRef = collection(db, 'notifications');
      const q = query(notificationsCollectionRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedNotifications: NotificationItem[] = [];
      querySnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const createdAt = data.createdAt instanceof Timestamp
                          ? data.createdAt.toDate().toISOString()
                          : typeof data.createdAt === 'string'
                            ? data.createdAt
                            : new Date().toISOString();
        fetchedNotifications.push({
          id: docSnapshot.id,
          title: data.title,
          content: data.content,
          createdAt: createdAt,
          targetAudience: data.targetAudience as 'all' | UserRole,
          createdBy: data.createdBy,
          readBy: Array.isArray(data.readBy) ? data.readBy : [],
        });
      });
      setNotifications(fetchedNotifications);
    } catch (error) {
      
      toast({ title: "Error", description: "Could not load notifications for management.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isAuthorized) {
      fetchAllNotifications();
    }
  }, [isAuthorized, fetchAllNotifications]);


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
      fetchAllNotifications(); 
    } catch (error) {
      
      toast({ title: "Error", description: "Could not post notification.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    if (!currentUserItsId || !currentUserName) {
       toast({ title: "Error", description: "Could not identify current user to perform deletion.", variant: "destructive" });
       return;
    }

    try {
      await deleteNotification(id, { itsId: currentUserItsId, name: currentUserName });
      toast({
        title: "Notification Deleted",
        description: "The notification has been removed.",
      });
      fetchAllNotifications(); // Refresh the list
    } catch (error) {
      
      toast({ title: "Error", description: "Could not delete notification.", variant: "destructive" });
    }
  };
  
  const canManage = currentUserRole === 'admin' || currentUserRole === 'superadmin';

  const totalPages = Math.ceil(notifications.length / ITEMS_PER_PAGE);
  const currentNotifications = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return notifications.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [notifications, currentPage]);

  const handlePreviousPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
  const handleNextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  
  if (isAuthorized === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <FunkyLoader size="lg" />
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
       <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
        <p className="text-muted-foreground mt-2">
          You do not have the required permissions to view this page.
        </p>
        <p className="text-sm text-muted-foreground mt-1">Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
    {canManage && (
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
                <CardTitle className="flex items-center"><BellRing className="mr-2 h-6 w-6 text-primary" />Manage Notifications</CardTitle>
                <CardDescription className="mt-1">Create and publish new notifications for specific user groups or all users.</CardDescription>
            </div>
             <Button onClick={handlePostNotification} disabled={isSubmitting || isLoading} size="sm">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                Post Notification
            </Button>
          </div>
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
      </Card>
    )}

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Posted Notifications Log</CardTitle>
          <CardDescription>List of all active notifications. Newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <FunkyLoader>Loading notifications...</FunkyLoader>
            </div>
          ) : currentNotifications.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No notifications posted yet.</p>
          ) : (
            <ul className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {currentNotifications.map((notification) => (
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
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteNotification(notification.id)}
                      className="text-destructive hover:text-destructive shrink-0"
                      aria-label="Delete notification"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-between items-center pt-4 gap-2">
            <p className="text-xs text-muted-foreground">
                Showing {currentNotifications.length > 0 ? ((currentPage - 1) * ITEMS_PER_PAGE) + 1 : 0} - {Math.min(currentPage * ITEMS_PER_PAGE, notifications.length)} of {notifications.length} notifications
            </p>
            {totalPages > 1 && (
            <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages}>
                    Next <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
            )}
        </CardFooter>
      </Card>
    </div>
  );
}
