
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
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SidebarNav } from "./sidebar-nav";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { NotificationItem } from "@/types";
import Image from "next/image";

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
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);

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

    checkUnread(); 
    
    const handleNotificationsUpdate = () => checkUnread();
    window.addEventListener('notificationsUpdated', handleNotificationsUpdate);
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
  }, [pathname]); 


  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem('userRole');
      localStorage.removeItem('userName');
      localStorage.removeItem('userItsId'); 
    }
    router.push("/");
    window.dispatchEvent(new CustomEvent('notificationsUpdated')); 
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

      <Dialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <HelpCircle className="h-5 w-5" />
            <span className="sr-only">Need Help?</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Need Assistance?</DialogTitle>
            <DialogDescription>
              Here you can find information on how to use the BGK Attendance system or contact support.
            </DialogDescription>
          </DialogHeader>
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
