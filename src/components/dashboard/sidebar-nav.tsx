
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";
import { Home, User, CalendarDays, Users, BarChart3, Building, UserCheck, ScanBarcode } from "lucide-react";
import { useState, useEffect } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  allowedRoles?: UserRole[]; // If undefined, visible to all authenticated users
}

const allNavItems: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: Home }, // All users
  { href: "/dashboard/profile", label: "Profile", icon: User }, // All users
  { href: "/dashboard/scan-attendance", label: "Scan My QR", icon: ScanBarcode, allowedRoles: ['user'] }, // Only regular users
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
    href: "/dashboard/reports", 
    label: "Reports", 
    icon: BarChart3, 
    allowedRoles: ['admin', 'superadmin', 'attendance-marker'] 
  },
];

export function SidebarNav() {
  const pathname = usePathname();
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedRole = localStorage.getItem('userRole') as UserRole | null;
      setCurrentUserRole(storedRole || 'user'); 
    }
  }, []);
  
  const navItems = allNavItems.filter(item => {
    if (!currentUserRole) return false; // Don't show anything if role not loaded
    if (!item.allowedRoles) return true; // Visible to all if allowedRoles is not defined
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
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/dashboard")
              ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
              : "text-sidebar-foreground"
          )}
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
