
"use client";

import { Bell, LogOut, Menu, UserCircle, Settings, HelpCircle, FileText, X, Moon, Sun, Check, Palette, Sparkles, Clock, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar-nav";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import type { NotificationItem, UserRole, Form as FormType, User } from "@/types";
import Image from "next/image";
import { db, getYearPath } from "@/lib/firebase/firebase";
import { collection, query, where, orderBy, onSnapshot, Timestamp, limit, Unsubscribe, getDocs } from "firebase/firestore";
import { getForms, getFormResponsesForUser } from "@/lib/firebase/formService";
import { getUserByItsOrBgkId } from "@/lib/firebase/userService";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getFeatureFlags } from "@/lib/firebase/settingsService";
import { format } from "date-fns";


const pageTitles: { [key: string]: string } = {
  "/dashboard": "Overview",
  "/dashboard/overview": "Overview",
  "/dashboard/profile": "Profile",
  "/dashboard/notifications": "Notifications",
  "/dashboard/mark-attendance": "Mark Attendance",
  "/dashboard/miqaats": "Miqaats",
  "/dashboard/miqaat-management": "Miqaat Management",
  "/dashboard/dua": "Dua",
  "/dashboard/manage-mohallahs": "Manage Mohallahs",
  "/dashboard/manage-members": "Manage Members",
  "/dashboard/manage-teams": "Manage Teams",
  "/dashboard/manage-notifications": "Manage Notifications",
  "/dashboard/reports": "Reports",
  "/dashboard/forms": "Forms / Surveys",
  "/dashboard/login-logs": "Login Logs",
  "/dashboard/audit-logs": "Audit Logs",
};

const colorThemes = [
    { name: 'blue',    label: 'Blue',    color: '#1677FF' },
    { name: 'purple',  label: 'Purple',  color: '#7C3AED' },
    { name: 'indigo',  label: 'Indigo',  color: '#4338CA' },
    { name: 'teal',    label: 'Teal',    color: '#0D9488' },
    { name: 'emerald', label: 'Emerald', color: '#059669' },
    { name: 'rose',    label: 'Rose',    color: '#E11D48' },
    { name: 'amber',   label: 'Amber',   color: '#D97706' },
    { name: 'gray',    label: 'Slate',   color: '#475569' },
];


export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [unrespondedForms, setUnrespondedForms] = useState<FormType[]>([]);
  const [colorTheme, setColorTheme] = useState('blue');
  const [showThemeNewBadge, setShowThemeNewBadge] = useState(true);
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentUserItsId, setCurrentUserItsId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  
  const [lastLoginText, setLastLoginText] = useState<string>("Loading...");
  const [sessionMinutes, setSessionMinutes] = useState<number>(0);

  useEffect(() => {
    if (!currentUserItsId) return;

    const fetchLastLogin = async () => {
      try {
        const q = query(
          collection(db, getYearPath("login_logs")),
          where("userItsId", "==", currentUserItsId)
        );
        const snap = await getDocs(q);
        const logs = snap.docs.map(d => {
          const data = d.data();
          const date = data.timestamp instanceof Timestamp 
            ? data.timestamp.toDate() 
            : data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
          return { ...data, date };
        });

        logs.sort((a, b) => b.date.getTime() - a.date.getTime());

        if (logs.length > 1) {
          const prevLogin = logs[1];
          setLastLoginText(format(prevLogin.date, "PPpp"));
        } else if (logs.length === 1) {
          setLastLoginText(format(logs[0].date, "PPpp"));
        } else {
          setLastLoginText("First login session");
        }
      } catch (err) {
        console.error("Error fetching last login in header:", err);
        setLastLoginText("Unavailable");
      }
    };

    fetchLastLogin();
  }, [currentUserItsId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sessionId = localStorage.getItem("sessionId");
    if (!sessionId) return;
    const parts = sessionId.split("-");
    if (parts.length < 2) return;
    const loginTimeMs = parseInt(parts[1], 10);
    if (isNaN(loginTimeMs)) return;

    const updateMinutes = () => {
      const mins = Math.max(0, Math.floor((Date.now() - loginTimeMs) / 60000));
      setSessionMinutes(mins);
    };

    updateMinutes();
    const interval = setInterval(updateMinutes, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const ALL_CLASSES = ['theme-blue','theme-purple','theme-indigo','theme-teal','theme-emerald','theme-rose','theme-amber','theme-gray'];
    const savedTheme = localStorage.getItem("colorTheme") || "blue";
    setColorTheme(savedTheme);
    document.body.classList.remove(...ALL_CLASSES);
    if (savedTheme !== "blue") {
        document.body.classList.add(`theme-${savedTheme}`);
    }
  }, []);

  const ALL_THEME_CLASSES = ['theme-blue','theme-purple','theme-indigo','theme-teal','theme-emerald','theme-rose','theme-amber','theme-gray'];

  const handleSetColorTheme = (newTheme: string) => {
    setColorTheme(newTheme);
    localStorage.setItem("colorTheme", newTheme);
    document.body.classList.remove(...ALL_THEME_CLASSES);
    if (newTheme !== "blue") {
        document.body.classList.add(`theme-${newTheme}`);
    }
  };


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
    
    const fetchFeatureFlag = async () => {
        const flags = await getFeatureFlags();
        setShowThemeNewBadge(flags.isThemeFeatureNew);
    };

    loadAuthData();
    fetchFeatureFlag();

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
      const notificationsCollectionRef = collection(db, getYearPath('notifications'));
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
    <header className="glass-header sticky top-0 z-30 flex h-16 items-center gap-4 border-b px-4 md:px-6">
      <div className="md:hidden">
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="bg-background/40">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex flex-col bg-card/85 p-0">
            <SheetHeader className="border-b border-border/70 p-4">
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
            <div 
              style={{ 
                '--sidebar-background': 'var(--card)',
                '--sidebar-foreground': 'var(--card-foreground)',
                '--sidebar-primary': 'var(--primary)',
                '--sidebar-accent': 'var(--accent)',
                '--sidebar-accent-foreground': 'var(--accent-foreground)',
                '--sidebar-border': 'var(--border)',
              } as React.CSSProperties} 
              className="flex-grow overflow-y-auto"
            >
              <SidebarNav onItemClick={() => setIsMobileOpen(false)} />
            </div>
            <div className="mt-auto border-t border-border/70 p-4">
              <Accordion type="single" collapsible>
                <AccordionItem value="appearance" className="border-b-0">
                  <AccordionTrigger className="hover:no-underline py-2">
                    <div className="flex items-center justify-between w-full">
                       <span className="text-sm font-medium text-muted-foreground">Appearance</span>
                       {showThemeNewBadge && <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">New</span>}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4 space-y-4">
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Mode</span>
                      <DropdownMenuRadioGroup value={theme} onValueChange={setTheme} className="flex items-center gap-2 mt-2">
                        <Button variant={theme === 'light' ? 'secondary' : 'ghost'} size="sm" className="flex-1 h-8 w-8" onClick={() => setTheme('light')}><Sun className="h-4 w-4" /></Button>
                        <Button variant={theme === 'dark' ? 'secondary' : 'ghost'} size="sm" className="flex-1 h-8 w-8" onClick={() => setTheme('dark')}><Moon className="h-4 w-4" /></Button>
                        <Button variant={theme === 'system' ? 'secondary' : 'ghost'} size="sm" className="flex-1 h-8 w-8" onClick={() => setTheme('system')}>System</Button>
                      </DropdownMenuRadioGroup>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Color Theme (Beta)</span>
                       <div className="grid grid-cols-4 gap-1.5 mt-2">
                         {colorThemes.map((ct) => (
                          <button
                            key={ct.name}
                            onClick={() => handleSetColorTheme(ct.name)}
                            className={cn("flex flex-col items-center gap-1 p-1 rounded-md transition-all hover:bg-muted", colorTheme === ct.name && "bg-muted")}
                            aria-label={`Select ${ct.label} theme`}
                          >
                            <div
                              className={cn("h-5 w-5 rounded-full flex items-center justify-center", colorTheme === ct.name && "ring-2 ring-offset-1 ring-offset-background")}
                              style={{ backgroundColor: ct.color }}
                            >
                              {colorTheme === ct.name && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <span className="text-[9px] text-muted-foreground">{ct.label}</span>
                          </button>
                        ))}
                       </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex-1">
        <h1 className="text-lg font-semibold md:text-xl">{currentPageTitle}</h1>
      </div>

      <div className="hidden md:flex flex-1 ml-auto max-w-sm">
        {/* Search functionality can be added here later */}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative rounded-full bg-background/30">
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
            <Button variant="ghost" size="icon" className="relative rounded-full bg-background/30">
                <Settings className="h-5 w-5" />
                 {showThemeNewBadge && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                    </span>
                )}
                <span className="sr-only">Settings and Theme</span>
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
            <DropdownMenuLabel>Appearance</DropdownMenuLabel>
            <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                    {theme === 'dark' ? <Moon className="mr-2 h-4 w-4" /> : <Sun className="mr-2 h-4 w-4" />}
                    <span>Mode</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
                    </DropdownMenuSubContent>
                </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                    <Palette className="mr-2 h-4 w-4" />
                    <span>Color Theme (Beta)</span>
                </DropdownMenuSubTrigger>
                 <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                        <div className="p-2">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">Color Theme</p>
                          <div className="grid grid-cols-4 gap-1.5">
                            {colorThemes.map((ct) => (
                              <button
                                key={ct.name}
                                onClick={() => handleSetColorTheme(ct.name)}
                                className={cn(
                                  "flex flex-col items-center gap-1 p-1.5 rounded-md transition-all hover:bg-muted",
                                  colorTheme === ct.name && "bg-muted"
                                )}
                                title={ct.label}
                              >
                                <div
                                  className={cn(
                                    "h-6 w-6 rounded-full flex items-center justify-center shadow-sm",
                                    colorTheme === ct.name && "ring-2 ring-offset-1 ring-offset-background"
                                  )}
                                  style={{ backgroundColor: ct.color }}
                                >
                                  {colorTheme === ct.name && <Check className="h-3.5 w-3.5 text-white" />}
                                </div>
                                <span className="text-[9px] text-muted-foreground leading-none">{ct.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                    </DropdownMenuSubContent>
                </DropdownMenuPortal>
            </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full bg-background/30">
            <UserCircle className="h-6 w-6" />
            <span className="sr-only">Toggle user menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {/* Mobile Only: Last Login & Session Details */}
          <div className="md:hidden px-2 py-1.5 text-[11px] text-muted-foreground bg-muted/30 border border-border/50 rounded-sm my-1 space-y-1">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-primary/70 shrink-0" />
              <span>Last login: <strong className="font-medium text-foreground">{lastLoginText}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Timer className="h-3 w-3 text-primary/70 shrink-0" />
              <span>Session: <strong className="font-medium text-foreground">{sessionMinutes} min</strong></span>
            </div>
          </div>
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
