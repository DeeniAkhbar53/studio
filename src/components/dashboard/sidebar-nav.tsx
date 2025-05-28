
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { UserRole, NotificationItem } from "@/types"; // Added NotificationItem
import { Home, User, CalendarDays, Building, BarChart3, UserCheck, ScanBarcode, Bell, Settings } from "lucide-react"; // Added Bell, Settings (for manage notifs)
import { useState, useEffect } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  allowedRoles?: UserRole[]; 
  badgeCount?: () => number; // Optional function to get badge count
}

const NOTIFICATIONS_STORAGE_KEY = "appNotifications";

const getUnreadNotificationsCount = (): number => {
  if (typeof window === "undefined") return 0;
  const storedNotifications = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
  if (storedNotifications) {
    const notifications: NotificationItem[] = JSON.parse(storedNotifications);
    return notifications.filter(n => !n.read).length;
  }
  return 0;
};


const allNavItems: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: Home },
  { href: "/dashboard/profile", label: "Profile", icon: User },
  { 
    href: "/dashboard/notifications", 
    label: "Notifications", 
    icon: Bell,
    badgeCount: getUnreadNotificationsCount 
  }, // All users
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
    href: "/dashboard/mohallah-management", 
    label: "Mohallahs", 
    icon: Building, 
    allowedRoles: ['admin', 'superadmin'] 
  },
   { 
    href: "/dashboard/manage-notifications", 
    label: "Manage Notifications", 
    icon: Settings, // Using Settings icon as placeholder
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
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedRole = localStorage.getItem('userRole') as UserRole | null;
      setCurrentUserRole(storedRole || 'user'); 
      setUnreadCount(getUnreadNotificationsCount());

      const handleStorageChange = () => {
         setUnreadCount(getUnreadNotificationsCount());
      };
      const handleNotificationsUpdate = () => {
         setUnreadCount(getUnreadNotificationsCount());
      };

      window.addEventListener('storage', handleStorageChange);
      window.addEventListener('notificationsUpdated', handleNotificationsUpdate); // Custom event

      return () => {
          window.removeEventListener('storage', handleStorageChange);
          window.removeEventListener('notificationsUpdated', handleNotificationsUpdate);
      };
    }
  }, []);
  
  const navItems = allNavItems.filter(item => {
    if (!currentUserRole) return false; 
    if (!item.allowedRoles) return true; 
    return item.allowedRoles.includes(currentUserRole);
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
        const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/dashboard");
        const currentBadgeCount = item.label === "Notifications" ? unreadCount : undefined;

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
