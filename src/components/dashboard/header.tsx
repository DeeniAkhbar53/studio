
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
import { getNotificationsForUser } from "@/lib/firebase/notificationService";


const pageTitles: { [key: string]: string } = {
  "/dashboard": "Dashboard",
  "/dashboard/profile": "Profile",
  "/dashboard/miqaat-management": "Miqaats",
  "/dashboard/manage-mohallahs": "Mohallahs", // Shortened
  "/dashboard/manage-members": "Members", // Shortened
  "/dashboard/reports": "Reports",
  "/dashboard/scan-attendance": "Scan QR", // Shortened
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

  useEffect(() => {
    const itsId = localStorage.getItem('userItsId');
    const role = localStorage.getItem('userRole') as UserRole | null;
    setCurrentUserItsId(itsId);
    setCurrentUserRole(role);
  }, []);

  const checkUnreadNotifications = useCallback(async () => {
    if (!currentUserItsId || !currentUserRole) {
      setHasUnreadNotifications(false);
      return;
    }
    try {
      const notifications = await getNotificationsForUser(currentUserItsId, currentUserRole);
      const unreadCount = notifications.filter(n => !n.readBy?.includes(currentUserItsId)).length;
      setHasUnreadNotifications(unreadCount > 0);
    } catch (error) {
      console.error("Failed to check unread notifications:", error);
      setHasUnreadNotifications(false);
    }
  }, [currentUserItsId, currentUserRole]);

  useEffect(() => {
    checkUnreadNotifications();
    
    const handleNotificationsUpdate = () => checkUnreadNotifications();
    window.addEventListener('notificationsUpdated', handleNotificationsUpdate);
    
    // Also listen to storage changes that might affect user ID or role
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'userItsId' || event.key === 'userRole') {
        setCurrentUserItsId(localStorage.getItem('userItsId'));
        setCurrentUserRole(localStorage.getItem('userRole') as UserRole | null);
        // This will trigger checkUnreadNotifications due to dependency change
      }
    };
    window.addEventListener('storage', handleStorageChange);


    return () => {
      window.removeEventListener('notificationsUpdated', handleNotificationsUpdate);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [pathname, checkUnreadNotifications, currentUserItsId, currentUserRole]);


  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem('userRole');
      localStorage.removeItem('userName');
      localStorage.removeItem('userItsId');
      localStorage.removeItem('userPageRights');
    }
    setHasUnreadNotifications(false); // Clear indicator on logout
    router.push("/");
  };
  
  const currentPageTitle = pageTitles[pathname] || "Dashboard";

  return (
    <header className="flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6 sticky top-0 z-30">
      <div>
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
                  src="https://app.burhaniguards.org/images/logo.png"
                  alt="BGK Attendance Logo"
                  width={24}
                  height={24}
                  className="h-6 w-6"
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
