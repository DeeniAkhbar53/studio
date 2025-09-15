
"use client";

import { Bell, LogOut, Menu, Search, UserCircle, Settings, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader as DialogPrimitiveHeader, DialogTitle as DialogPrimitiveTitle, DialogTrigger as DialogPrimitiveTrigger } from "@/components/ui/dialog";
import { SidebarNav } from "./sidebar-nav";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import type { NotificationItem, UserRole } from "@/types";
import Image from "next/image";
// Removed getNotificationsForUser import as we'll implement listener logic directly
import { db } from "@/lib/firebase/firebase";
import { collection, query, where, orderBy, onSnapshot, Timestamp, limit, Unsubscribe } from "firebase/firestore";

const pageTitles: { [key: string]: string } = {
  "/dashboard": "Dashboard",
  "/dashboard/profile": "Profile",
  "/dashboard/miqaat-management": "Miqaats",
  "/dashboard/manage-mohallahs": "Manage Mohallahs",
  "/dashboard/manage-members": "Manage Members",
  "/dashboard/reports": "Reports",
  "/dashboard/scan-attendance": "Scan QR",
  "/dashboard/mark-attendance": "Mark Attendance",
  "/dashboard/notifications": "Notifications",
  "/dashboard/manage-notifications": "Manage Notifications",
};

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  
  const [currentUserItsId, setCurrentUserItsId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);

  // Effect to load user auth data from localStorage
  useEffect(() => {
    const loadAuthData = () => {
      if (typeof window !== "undefined") {
        const itsId = localStorage.getItem('userItsId');
        const role = localStorage.getItem('userRole') as UserRole | null;
        setCurrentUserItsId(itsId);
        setCurrentUserRole(role);
        console.log("[Header useEffect loadAuthData] Loaded from localStorage - ITS ID:", itsId, "Role:", role);
      }
    };
    loadAuthData();

    const handleStorageChange = (event: StorageEvent) => {
      if (typeof window !== "undefined") {
        if (event.key === 'userItsId' || event.key === 'userRole') {
          loadAuthData(); // Reload auth data if user context changes
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);


  // Effect to listen for realtime notification updates
  useEffect(() => {
    if (!currentUserItsId || !currentUserRole) {
      console.log("[Header Notification Listener] Skipping: No ITS ID or Role.", { currentUserItsId, currentUserRole });
      setHasUnreadNotifications(false);
      if (typeof window !== "undefined") localStorage.setItem('unreadNotificationCount', '0');
      return;
    }

    console.log(`[Header Notification Listener] Setting up for ITS: ${currentUserItsId}, Role: ${currentUserRole}`);

    const notificationsCollectionRef = collection(db, 'notifications');
    let unsubAll: Unsubscribe | null = null;
    let unsubRole: Unsubscribe | null = null;
    
    let allNotificationsMap = new Map<string, NotificationItem>();
    let roleNotificationsMap = new Map<string, NotificationItem>();

    const processAndSetNotifications = () => {
      const combinedNotificationsMap = new Map([...allNotificationsMap, ...roleNotificationsMap]);
      const fetchedNotifications = Array.from(combinedNotificationsMap.values());
      
      const unreadCount = fetchedNotifications.filter(n => !n.readBy?.includes(currentUserItsId)).length;
      setHasUnreadNotifications(unreadCount > 0);
      if (typeof window !== "undefined") {
        localStorage.setItem('unreadNotificationCount', unreadCount.toString());
        window.dispatchEvent(new CustomEvent('notificationsUpdated')); // For sidebar
      }
      console.log(`[Header Notification Listener] Processed ${fetchedNotifications.length} total notifications. Unread count: ${unreadCount} for ITS: ${currentUserItsId}`);
    };

    // Listener for 'all' targetAudience
    const qAll = query(
      notificationsCollectionRef,
      where('targetAudience', '==', 'all'),
      orderBy('createdAt', 'desc'),
      limit(50) // Limit to keep it manageable
    );
    unsubAll = onSnapshot(qAll, (querySnapshot) => {
      console.log(`[Header Notification Listener] 'all' audience snapshot received: ${querySnapshot.docs.length} docs.`);
      allNotificationsMap.clear();
      querySnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : (typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString());
        allNotificationsMap.set(docSnapshot.id, {
          id: docSnapshot.id,
          title: data.title,
          content: data.content,
          createdAt: createdAt,
          targetAudience: data.targetAudience,
          createdBy: data.createdBy,
          readBy: Array.isArray(data.readBy) ? data.readBy : [],
        });
      });
      processAndSetNotifications();
    }, (error) => {
      console.error("[Header Notification Listener] Error fetching 'all' notifications:", error);
      if (error.message.includes("index")) {
        console.error("Firestore Index missing for query: targetAudience ASC, createdAt DESC on 'notifications' collection.");
      }
    });

    // Listener for role-specific targetAudience
    if (currentUserRole !== 'all') { // Avoid duplicate listener if role is somehow 'all'
      const qRole = query(
        notificationsCollectionRef,
        where('targetAudience', '==', currentUserRole),
        orderBy('createdAt', 'desc'),
        limit(50) // Limit to keep it manageable
      );
      unsubRole = onSnapshot(qRole, (querySnapshot) => {
        console.log(`[Header Notification Listener] '${currentUserRole}' audience snapshot received: ${querySnapshot.docs.length} docs.`);
        roleNotificationsMap.clear();
        querySnapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data();
          const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : (typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString());
          roleNotificationsMap.set(docSnapshot.id, {
            id: docSnapshot.id,
            title: data.title,
            content: data.content,
            createdAt: createdAt,
            targetAudience: data.targetAudience,
            createdBy: data.createdBy,
            readBy: Array.isArray(data.readBy) ? data.readBy : [],
          });
        });
        processAndSetNotifications();
      }, (error) => {
        console.error(`[Header Notification Listener] Error fetching '${currentUserRole}' notifications:`, error);
        if (error.message.includes("index")) {
          console.error("Firestore Index missing for query: targetAudience ASC, createdAt DESC on 'notifications' collection.");
        }
      });
    } else {
      // If currentUserRole is 'all', no need for a separate role listener, clear roleNotificationsMap
      roleNotificationsMap.clear();
      processAndSetNotifications();
    }

    return () => {
      console.log("[Header Notification Listener] Unsubscribing from notification listeners.");
      if (unsubAll) unsubAll();
      if (unsubRole) unsubRole();
    };
  }, [currentUserItsId, currentUserRole]);


  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem('userRole');
      localStorage.removeItem('userName');
      localStorage.removeItem('userItsId');
      localStorage.removeItem('userMohallahId');
      localStorage.removeItem('userBgkId');
      localStorage.removeItem('userTeam');
      localStorage.removeItem('userDesignation');
      localStorage.removeItem('userPageRights');
      localStorage.removeItem('unreadNotificationCount'); // Clear this on logout
    }
    setCurrentUserItsId(null);
    setCurrentUserRole(null);
    setHasUnreadNotifications(false); 
    
    if (typeof window !== "undefined") {
       window.dispatchEvent(new CustomEvent('notificationsUpdated')); // Notify sidebar
    }
    router.push("/");
  };

  const currentPageTitle = pageTitles[pathname] || "Dashboard";

  return (
    <header className="flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6">
      <div className="md:hidden"> {/* Re-added md:hidden to hide on medium screens and up */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex flex-col p-0 bg-card">
            <SheetHeader className="p-4 border-b">
              <SheetTitle className="sr-only">Main Navigation Menu</SheetTitle>
               <Link href="/dashboard" className="flex items-center gap-2 text-lg font-semibold text-primary">
                <Image
                  src="/logo.png"
                  alt="BGK Attendance Logo"
                  width={32}
                  height={32}
                  className="h-8 w-8"
                />
                <span>BGK Attendance</span>
              </Link>
            </SheetHeader>
            <div style={{ '--sidebar-foreground': 'hsl(var(--card-foreground))' } as React.CSSProperties}>
              <SidebarNav />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex-1">
        <h1 className="text-xl font-semibold">{currentPageTitle}</h1>
      </div>

      <form className="hidden md:flex flex-1 ml-auto max-w-sm">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="pl-8 w-full"
          />
        </div>
      </form>

      <Dialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen}>
        <DialogPrimitiveTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <HelpCircle className="h-5 w-5" />
            <span className="sr-only">Need Help?</span>
          </Button>
        </DialogPrimitiveTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogPrimitiveHeader>
            <DialogPrimitiveTitle>Need Assistance?</DialogPrimitiveTitle>
            <DialogDescription>
              Here you can find information on how to use the BGK Attendance system or contact support.
            </DialogDescription>
          </DialogPrimitiveHeader>
          <div className="py-4 space-y-2">
            <h4 className="font-semibold">Contact Support:</h4>
            <p>If you encounter any issues or have questions, please contact your Mohallah admin or the technical support team at <a href="mailto:support@bgkattendance.example.com" className="text-primary hover:underline">support@bgkattendance.example.com</a>.</p>
            <h4 className="font-semibold mt-4">FAQs:</h4>
            <p>Q: How do I mark attendance? <br/> A: Navigate to the specific Miqaat and use the barcode scanner or manual entry (if you are an attendance marker).</p>
            <p>Q: Where can I see my attendance history? <br/> A: Go to your Profile page.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsHelpDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Button variant="ghost" size="icon" className="rounded-full relative" asChild>
        <Link href="/dashboard/notifications">
          <Bell className="h-5 w-5" />
          {hasUnreadNotifications && (
            <span className="absolute top-1 right-1 block h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-card" />
          )}
          <span className="sr-only">Toggle notifications</span>
        </Link>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <UserCircle className="h-6 w-6" />
            <span className="sr-only">Toggle user menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push('/dashboard/profile')}>Profile</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
