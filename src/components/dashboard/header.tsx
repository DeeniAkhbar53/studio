
"use client";

import { Bell, LogOut, Menu, Search, UserCircle } from "lucide-react";
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
import { SidebarNav } from "./sidebar-nav";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { NotificationItem } from "@/types";
import { cn } from "@/lib/utils";

const NOTIFICATIONS_STORAGE_KEY = "appNotifications";

const pageTitles: { [key: string]: string } = {
  "/dashboard": "Dashboard Overview",
  "/dashboard/profile": "My Profile",
  "/dashboard/miqaat-management": "Miqaat Management",
  "/dashboard/mohallah-management": "Mohallah Management",
  "/dashboard/reports": "Attendance Reports",
  "/dashboard/scan-attendance": "Scan Attendance Barcode",
  "/dashboard/mark-attendance": "Mark Member Attendance",
  "/dashboard/notifications": "Notifications",
  "/dashboard/manage-notifications": "Manage Notifications",
};

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  useEffect(() => {
    const checkUnread = () => {
      if (typeof window !== "undefined") {
        const storedNotifications = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
        if (storedNotifications) {
          const notifications: NotificationItem[] = JSON.parse(storedNotifications);
          setHasUnreadNotifications(notifications.some(n => !n.read));
        } else {
          setHasUnreadNotifications(false);
        }
      }
    };

    checkUnread(); // Initial check
    
    // Listen for custom event from notifications page or manage notifications page
    const handleNotificationsUpdate = () => checkUnread();
    window.addEventListener('notificationsUpdated', handleNotificationsUpdate);
    // Also listen to storage changes, as notifications might be updated in another tab/window
    window.addEventListener('storage', (event) => {
      if (event.key === NOTIFICATIONS_STORAGE_KEY) {
        checkUnread();
      }
    });

    return () => {
      window.removeEventListener('notificationsUpdated', handleNotificationsUpdate);
      window.removeEventListener('storage', (event) => {
        if (event.key === NOTIFICATIONS_STORAGE_KEY) {
          checkUnread();
        }
      });
    };
  }, [pathname]); // Re-check if pathname changes, e.g., after visiting notifications page


  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem('userRole');
      // Optionally, clear notifications for logged-out user to avoid confusion if another user logs in
      // localStorage.removeItem(NOTIFICATIONS_STORAGE_KEY); 
    }
    router.push("/");
    window.dispatchEvent(new CustomEvent('notificationsUpdated')); // Ensure header updates after logout
  };
  
  const currentPageTitle = pageTitles[pathname] || "Dashboard";

  return (
    <header className="flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6 sticky top-0 z-30">
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex flex-col p-0">
            <SheetHeader className="p-4 border-b">
              <SheetTitle className="sr-only">Main Navigation Menu</SheetTitle>
               <Link href="/dashboard" className="flex items-center gap-2 text-lg font-semibold text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>
                <span>BGK Attendance</span>
              </Link>
            </SheetHeader>
            <SidebarNav />
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
          <DropdownMenuItem>Settings</DropdownMenuItem>
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
