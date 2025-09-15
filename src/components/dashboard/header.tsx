
"use client";

import { Bell, LogOut, Menu, UserCircle, Settings, HelpCircle, FileText } from "lucide-react";
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
import type { NotificationItem, UserRole, Form as FormType, User } from "@/types";
import Image from "next/image";
import { db } from "@/lib/firebase/firebase";
import { collection, query, where, orderBy, onSnapshot, Timestamp, limit, Unsubscribe } from "firebase/firestore";
import { getForms, getFormResponsesForUser } from "@/lib/firebase/formService";
import { getUserByItsOrBgkId } from "@/lib/firebase/userService";

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
  "/dashboard/forms": "Forms / Surveys",
};

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [unrespondedForms, setUnrespondedForms] = useState<FormType[]>([]);
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentUserItsId, setCurrentUserItsId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);

  useEffect(() => {
    const loadAuthData = async () => {
      if (typeof window !== "undefined") {
        const itsId = localStorage.getItem('userItsId');
        const role = localStorage.getItem('userRole') as UserRole | null;
        setCurrentUserItsId(itsId);
        setCurrentUserRole(role);
        if (itsId) {
            try {
                const user = await getUserByItsOrBgkId(itsId);
                setCurrentUser(user);
            } catch (error) {
                console.error("Header: Failed to fetch user details", error);
            }
        }
      }
    };
    loadAuthData();

    const handleStorageChange = (event: StorageEvent) => {
      if (typeof window !== "undefined") {
        if (event.key === 'userItsId' || event.key === 'userRole') {
          loadAuthData();
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);


  useEffect(() => {
    if (!currentUserItsId || !currentUserRole || !currentUser) {
      setUnreadNotificationCount(0);
      setUnrespondedForms([]);
      return;
    }
  
    let unsubNotifications: Unsubscribe | null = null;
  
    const checkNotifications = async () => {
      // 1. Standard Notifications
      const notificationsCollectionRef = collection(db, 'notifications');
      const qAll = query(
        notificationsCollectionRef,
        where('targetAudience', '==', 'all'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      
      unsubNotifications = onSnapshot(qAll, async (querySnapshot) => {
        let standardUnreadCount = 0;
        const allDocs = querySnapshot.docs;

        for (const doc of allDocs) {
            const data = doc.data();
            if (!data.readBy?.includes(currentUserItsId)) {
                standardUnreadCount++;
            }
        }

        // 2. Form Notifications
        let formsUnreadCount = 0;
        let newUnrespondedForms: FormType[] = [];
        try {
            const allForms = await getForms();
            const userResponses = await getFormResponsesForUser(currentUser.itsId);
            const respondedFormIds = new Set(userResponses.map(r => r.formId));

            newUnrespondedForms = allForms.filter(form => {
                if (form.status !== 'open' || respondedFormIds.has(form.id)) {
                    return false;
                }
                if (form.endDate && new Date(form.endDate) < new Date()) {
                    return false;
                }
                const isForEveryone = !form.mohallahIds?.length && !form.teams?.length && !form.eligibleItsIds?.length;
                if (isForEveryone) return true;
                
                const eligibleById = !!form.eligibleItsIds?.includes(currentUser.itsId);
                const eligibleByTeam = !!currentUser.team && !!form.teams?.includes(currentUser.team);
                const eligibleByMohallah = !!currentUser.mohallahId && !!form.mohallahIds?.includes(currentUser.mohallahId);
                return eligibleById || eligibleByTeam || eligibleByMohallah;
            });
            
            formsUnreadCount = newUnrespondedForms.length;
            setUnrespondedForms(newUnrespondedForms);

        } catch (error) {
            console.error("Error checking for new forms:", error);
        }
        
        const totalUnread = standardUnreadCount + formsUnreadCount;
        setUnreadNotificationCount(totalUnread);
        localStorage.setItem('unreadNotificationCount', totalUnread.toString());
        window.dispatchEvent(new CustomEvent('notificationsUpdated'));
      }, (error) => {
        console.error("Error in notification snapshot listener:", error);
      });
    };

    checkNotifications();

    return () => {
      if (unsubNotifications) unsubNotifications();
    };
  }, [currentUser, currentUserItsId, currentUserRole]);


  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.clear();
    }
    setCurrentUser(null);
    setCurrentUserItsId(null);
    setCurrentUserRole(null);
    setUnreadNotificationCount(0);
    setUnrespondedForms([]);
    
    if (typeof window !== "undefined") {
       window.dispatchEvent(new CustomEvent('notificationsUpdated')); 
    }
    router.push("/");
  };

  const currentPageTitle = pageTitles[pathname] || "Dashboard";

  return (
    <header className="flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6">
      <div className="md:hidden">
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

      <div className="hidden md:flex flex-1 ml-auto max-w-sm">
        {/* Search functionality can be added here later */}
      </div>

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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full relative">
            <Bell className="h-5 w-5" />
            {unreadNotificationCount > 0 && (
              <span className="absolute top-1 right-1 block h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-card" />
            )}
            <span className="sr-only">Toggle notifications</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>New Forms</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {unrespondedForms.length > 0 ? (
            unrespondedForms.slice(0, 5).map(form => (
              <DropdownMenuItem key={form.id} asChild>
                <button
                  onClick={() => router.push('/dashboard/forms')}
                  className="w-full text-left cursor-pointer"
                >
                  <div className="font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    {form.title}
                  </div>
                </button>
              </DropdownMenuItem>
            ))
          ) : (
             <DropdownMenuItem disabled>No new forms at this time.</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

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

    