
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { UserRole, NotificationItem } from "@/types";
import { Home, User, CalendarDays, Building, BarChart3, UserCheck, ScanBarcode, Bell, Settings, Users as UsersIcon } from "lucide-react";
import { useState, useEffect } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  allowedRoles?: UserRole[];
  badgeCount?: () => number;
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
    icon: Settings,
    allowedRoles: ['admin', 'superadmin']
  },
  {
    href: "/dashboard/reports",
    label: "Reports",
    icon: BarChart3,
    allowedRoles: ['admin', 'superadmin', 'attendance-marker']
  },
];

export function SidebarNav() {
  const pathname = usePathname();
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [userPageRights, setUserPageRights] = useState<string[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedRole = localStorage.getItem('userRole') as UserRole | null;
      const storedPageRights = localStorage.getItem('userPageRights');
      const storedUnreadCount = parseInt(localStorage.getItem('unreadNotificationCount') || '0', 10);

      setCurrentUserRole(storedRole || 'user');
      setUserPageRights(storedPageRights ? JSON.parse(storedPageRights) : []);
      setUnreadNotificationCount(storedUnreadCount);

      const handleStorageChange = () => {
         const updatedRole = localStorage.getItem('userRole') as UserRole | null;
         const updatedPageRights = localStorage.getItem('userPageRights');
         const updatedUnreadCount = parseInt(localStorage.getItem('unreadNotificationCount') || '0', 10);

         setCurrentUserRole(updatedRole || 'user');
         setUserPageRights(updatedPageRights ? JSON.parse(updatedPageRights) : []);
         setUnreadNotificationCount(updatedUnreadCount);
      };

      const handleNotificationsUpdate = () => {
        const updatedUnreadCount = parseInt(localStorage.getItem('unreadNotificationCount') || '0', 10);
        setUnreadNotificationCount(updatedUnreadCount);
      };

      window.addEventListener('storage', handleStorageChange);
      window.addEventListener('notificationsUpdated', handleNotificationsUpdate); // Listen for custom event from header

      return () => {
          window.removeEventListener('storage', handleStorageChange);
          window.removeEventListener('notificationsUpdated', handleNotificationsUpdate);
      };
    }
  }, []);

  const navItems = allNavItems.filter(item => {
    if (!currentUserRole) return false;

    // 1. Check base role access
    const roleAllowed = !item.allowedRoles || item.allowedRoles.includes(currentUserRole);
    if (!roleAllowed) return false;

    // 2. If user has specific pageRights, apply them
    // Essential paths are always shown if role-allowed
    if (ESSENTIAL_PATHS.includes(item.href)) return true;

    // If pageRights are defined and non-empty, user must have explicit right for non-essential pages
    if (userPageRights && userPageRights.length > 0) {
      return userPageRights.includes(item.href);
    }

    // If no specific pageRights are set (or array is empty), role-based access is sufficient for non-essential pages
    return true;
  });

  if (currentUserRole === null) {
      return (
        <nav className="flex flex-col gap-2 p-4 text-sm font-medium">
            {/* Placeholder or loading indicator */}
        </nav>
      );
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
                {currentBadgeCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
