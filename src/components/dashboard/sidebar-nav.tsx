
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { UserDesignation, UserRole } from "@/types";
import { Home, User, CalendarDays, Building, BarChart3, UserCheck, ScanBarcode, Bell, Settings, Users as UsersIcon, FileText, ScrollText, BookOpen } from "lucide-react";
import { useState, useEffect, useMemo } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  allowedRoles?: UserRole[];
}

const ESSENTIAL_PATHS = ["/dashboard", "/dashboard/profile", "/dashboard/notifications"];
const TEAM_LEAD_DESIGNATIONS: UserDesignation[] = ["Captain", "Vice Captain", "Group Leader", "Asst.Grp Leader", "Major"];
const TARGET_MOHALLAH_ID = "ZMGsLMWcFQEM97jWD03x"; // The ID of the allowed Mohallah

export const allNavItems: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: Home },
  { href: "/dashboard/profile", label: "Profile", icon: User },
  {
    href: "/dashboard/notifications",
    label: "Notifications",
    icon: Bell,
  },
  {
    href: "/dashboard/dua",
    label: "Dua",
    icon: BookOpen
  },
  {
    href: "/dashboard/mark-attendance",
    label: "Mark Attendance",
    icon: UserCheck,
    allowedRoles: ['admin', 'superadmin', 'attendance-marker']
  },
  {
    href: "/dashboard/miqaat-management",
    label: "Miqaats",
    icon: CalendarDays,
    allowedRoles: ['admin', 'superadmin', 'attendance-marker']
  },
  {
    href: "/dashboard/manage-mohallahs",
    label: "Manage Mohallahs",
    icon: Building,
    allowedRoles: ['admin', 'superadmin']
  },
  {
    href: "/dashboard/manage-members",
    label: "Manage Members",
    icon: UsersIcon,
    allowedRoles: ['admin', 'superadmin']
  },
   {
    href: "/dashboard/manage-notifications",
    label: "Manage Notifications",
    icon: Settings,
    allowedRoles: ['admin', 'superadmin']
  },
  {
    href: "/dashboard/reports",
    label: "Reports",
    icon: BarChart3,
    allowedRoles: ['admin', 'superadmin', 'attendance-marker']
  },
  {
    href: "/dashboard/forms",
    label: "Forms / Surveys",
    icon: FileText,
  },
  {
    href: "/dashboard/login-logs",
    label: "Login Logs",
    icon: ScrollText,
    allowedRoles: ['superadmin']
  },
];

function SidebarNavSkeleton() {
  return (
    <nav className="flex flex-col gap-1 p-2">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2 bg-sidebar-accent/30 h-8 animate-pulse">
          <div className="h-4 w-4 bg-sidebar-accent/50 rounded-sm shrink-0" />
          <div className="h-3 bg-sidebar-accent/50 rounded-sm flex-grow " />
        </div>
      ))}
    </nav>
  );
}

export function SidebarNav() {
  const pathname = usePathname();
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [currentUserDesignation, setCurrentUserDesignation] = useState<UserDesignation | null>(null);
  const [userPageRights, setUserPageRights] = useState<string[]>([]);
  const [currentUserMohallahId, setCurrentUserMohallahId] = useState<string | null>(null);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const storedRole = localStorage.getItem('userRole') as UserRole | null;
    const storedDesignation = localStorage.getItem('userDesignation') as UserDesignation | null;
    const storedPageRightsRaw = localStorage.getItem('userPageRights');
    const storedMohallahId = localStorage.getItem('userMohallahId');
    const storedUnreadCount = parseInt(localStorage.getItem('unreadNotificationCount') || '0', 10);
    
    let parsedPageRights: string[] = [];
    if (storedPageRightsRaw) {
      try {
        const tempParsed = JSON.parse(storedPageRightsRaw);
        if (Array.isArray(tempParsed)) {
          parsedPageRights = tempParsed;
        }
      } catch (e) {
        
      }
    }
    
    setCurrentUserRole(storedRole);
    setCurrentUserDesignation(storedDesignation);
    setUserPageRights(parsedPageRights);
    setCurrentUserMohallahId(storedMohallahId);
    setUnreadNotificationCount(storedUnreadCount);
    setIsMounted(true);

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'userRole') {
        setCurrentUserRole(localStorage.getItem('userRole') as UserRole | null);
      }
      if (event.key === 'userDesignation') {
        setCurrentUserDesignation(localStorage.getItem('userDesignation') as UserDesignation | null);
      }
      if (event.key === 'userPageRights') {
        const updatedPageRightsRaw = localStorage.getItem('userPageRights');
        let updatedParsedPageRights: string[] = [];
         if (updatedPageRightsRaw) {
            try {
                const tempParsed = JSON.parse(updatedPageRightsRaw);
                if (Array.isArray(tempParsed)) {
                  updatedParsedPageRights = tempParsed;
                }
            } catch (e) {
                
            }
        }
        setUserPageRights(updatedParsedPageRights);
      }
       if (event.key === 'userMohallahId') {
        setCurrentUserMohallahId(localStorage.getItem('userMohallahId'));
      }
      if (event.key === 'unreadNotificationCount') {
         setUnreadNotificationCount(parseInt(localStorage.getItem('unreadNotificationCount') || '0', 10));
      }
    };

    const handleNotificationsUpdate = () => {
      const updatedUnreadCount = parseInt(localStorage.getItem('unreadNotificationCount') || '0', 10);
      setUnreadNotificationCount(updatedUnreadCount);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('notificationsUpdated', handleNotificationsUpdate);

    return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('notificationsUpdated', handleNotificationsUpdate);
    };
  }, []);

  const resolvedCurrentUserRole = isMounted ? (currentUserRole || 'user') : 'user';

  const navItems = useMemo(() => {
    if (!isMounted) {
      return [];
    }
    
    const isTeamLead = TEAM_LEAD_DESIGNATIONS.includes(currentUserDesignation || 'Member');
    const isAdminOrSuper = resolvedCurrentUserRole === 'admin' || resolvedCurrentUserRole === 'superadmin';

    return allNavItems.filter(item => {
      if (ESSENTIAL_PATHS.includes(item.href)) {
        return true;
      }

      // Special logic for Dua page
      if (item.href === '/dashboard/dua') {
          return currentUserMohallahId === TARGET_MOHALLAH_ID || resolvedCurrentUserRole === 'superadmin';
      }
      
      if (item.href === '/dashboard/forms') {
        return true;
      }
      
      const roleAllowsItem = !item.allowedRoles || item.allowedRoles.includes(resolvedCurrentUserRole);
      
      // If user has specific page right, allow access
      if (Array.isArray(userPageRights) && userPageRights.includes(item.href)) {
        return true;
      }

      // Special check for Manage Members for Team Leads
      if (item.href === '/dashboard/manage-members' && isTeamLead && !isAdminOrSuper) {
        return true;
      }

      // For other items, rely on role-based access
      return roleAllowsItem;
    });
  }, [isMounted, resolvedCurrentUserRole, userPageRights, currentUserDesignation, currentUserMohallahId]);


  if (!isMounted) {
    return <SidebarNavSkeleton />;
  }

  return (
    <nav className="flex flex-col gap-1 p-2 text-sm font-medium">
      {navItems.map((item) => {
        const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/dashboard" && item.href.length > "/dashboard".length);
        const currentBadgeCount = item.href === "/dashboard/notifications" ? unreadNotificationCount : undefined;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              isActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                : "text-sidebar-foreground"
            )}
          >
            <div className="flex items-center gap-3">
              <item.icon className="h-4 w-4" />
              {item.label}
            </div>
            {typeof currentBadgeCount === 'number' && currentBadgeCount > 0 && (
              <span className="ml-auto min-w-[20px] h-5 flex items-center justify-center rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground">
                {currentBadgeCount > 9 ? '9+' : currentBadgeCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
