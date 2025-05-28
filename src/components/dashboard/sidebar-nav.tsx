
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types"; // Removed unused NotificationItem
import { Home, User, CalendarDays, Building, BarChart3, UserCheck, ScanBarcode, Bell, Settings, Users as UsersIcon } from "lucide-react";
import { useState, useEffect, useMemo } from "react"; // Added useMemo

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  allowedRoles?: UserRole[];
}

const ESSENTIAL_PATHS = ["/dashboard", "/dashboard/profile", "/dashboard/notifications"];

const allNavItems: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: Home },
  { href: "/dashboard/profile", label: "Profile", icon: User },
  {
    href: "/dashboard/notifications",
    label: "Notifications",
    icon: Bell,
  },
  { href: "/dashboard/scan-attendance", label: "Scan My QR", icon: ScanBarcode, allowedRoles: ['user'] },
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
    allowedRoles: ['admin', 'superadmin']
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
    icon: Settings, // Changed from Bell to Settings for differentiation
    allowedRoles: ['admin', 'superadmin']
  },
  {
    href: "/dashboard/reports",
    label: "Reports",
    icon: BarChart3,
    allowedRoles: ['admin', 'superadmin', 'attendance-marker']
  },
];

function SidebarNavSkeleton() {
  return (
    <nav className="flex flex-col gap-2 p-4 text-sm font-medium">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2 bg-muted/30 h-8 animate-pulse">
          <div className="h-4 w-4 bg-muted rounded-sm shrink-0" />
          <div className="h-3 bg-muted rounded-sm flex-grow " />
        </div>
      ))}
    </nav>
  );
}

export function SidebarNav() {
  const pathname = usePathname();
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [userPageRights, setUserPageRights] = useState<string[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const storedRole = localStorage.getItem('userRole') as UserRole | null;
    const storedPageRights = localStorage.getItem('userPageRights');
    const storedUnreadCount = parseInt(localStorage.getItem('unreadNotificationCount') || '0', 10);

    console.log("[SidebarNav useEffect] Stored Role:", storedRole);
    console.log("[SidebarNav useEffect] Stored PageRights (string):", storedPageRights);
    
    const parsedPageRights = storedPageRights ? JSON.parse(storedPageRights) : [];
    console.log("[SidebarNav useEffect] Parsed PageRights (array):", parsedPageRights);

    setCurrentUserRole(storedRole);
    setUserPageRights(Array.isArray(parsedPageRights) ? parsedPageRights : []);
    setUnreadNotificationCount(storedUnreadCount);
    setIsMounted(true);

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'userRole') {
        setCurrentUserRole(localStorage.getItem('userRole') as UserRole | null);
      }
      if (event.key === 'userPageRights') {
        const updatedPageRightsRaw = localStorage.getItem('userPageRights');
        const updatedParsedPageRights = updatedPageRightsRaw ? JSON.parse(updatedPageRightsRaw) : [];
        setUserPageRights(Array.isArray(updatedParsedPageRights) ? updatedParsedPageRights : []);
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
        // console.log("[SidebarNav navItems] Not mounted, returning empty array for navItems initially");
      // Return a minimal set or empty during skeleton to avoid flash of incorrect items
      // For skeleton, no items are actually rendered based on this, SidebarNavSkeleton is shown.
      return [];
    }

    // console.log("[SidebarNav navItems] Calculating with resolvedCurrentUserRole:", resolvedCurrentUserRole, "and userPageRights:", userPageRights);

    return allNavItems.filter(item => {
      const roleAllowsItem = !item.allowedRoles || item.allowedRoles.includes(resolvedCurrentUserRole);
    //   console.log(`  [Item: ${item.label}] Role allows: ${roleAllowsItem} (User role: ${resolvedCurrentUserRole}, Item roles: ${item.allowedRoles})`);
      if (!roleAllowsItem) {
        return false;
      }

      if (ESSENTIAL_PATHS.includes(item.href)) {
        // console.log(`  [Item: ${item.label}] Is essential. Showing.`);
        return true;
      }

      if (Array.isArray(userPageRights) && userPageRights.length > 0) {
        const hasExplicitRight = userPageRights.includes(item.href);
        // console.log(`  [Item: ${item.label}] User has specific rights. Explicitly granted: ${hasExplicitRight}. Rights: ${userPageRights}`);
        return hasExplicitRight;
      }
      // console.log(`  [Item: ${item.label}] No specific rights or empty list. Showing based on role.`);
      return true;
    });
  }, [isMounted, resolvedCurrentUserRole, userPageRights]);


  if (!isMounted) {
    return <SidebarNavSkeleton />;
  }

  return (
    <nav className="flex flex-col gap-2 p-4 text-sm font-medium">
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
