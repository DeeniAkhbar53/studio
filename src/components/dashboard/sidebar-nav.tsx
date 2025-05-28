
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, User, CalendarDays, Users, BarChart3, Building } from "lucide-react";
import { useState, useEffect } from "react";

const allNavItems = [
  { href: "/dashboard", label: "Overview", icon: Home, adminOnly: false, superAdminOnly: false },
  { href: "/dashboard/profile", label: "Profile", icon: User, adminOnly: false, superAdminOnly: false },
  { href: "/dashboard/miqaat-management", label: "Miqaats", icon: CalendarDays, adminOnly: true, superAdminOnly: false },
  { href: "/dashboard/mohallah-management", label: "Mohallahs", icon: Building, adminOnly: true, superAdminOnly: false },
  // Example: A page only superadmins can see
  // { href: "/dashboard/system-settings", label: "System Settings", icon: Settings, adminOnly: true, superAdminOnly: true }, 
  { href: "/dashboard/reports", label: "Reports", icon: BarChart3, adminOnly: true, superAdminOnly: false },
];

export function SidebarNav() {
  const pathname = usePathname();
  const [currentUserRole, setCurrentUserRole] = useState<'user' | 'admin' | 'superadmin' | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedRole = localStorage.getItem('userRole') as 'user' | 'admin' | 'superadmin' | null;
      setCurrentUserRole(storedRole || 'user'); // Default to 'user' if no role found or during SSR
    }
  }, []);
  
  const navItems = allNavItems.filter(item => {
    if (currentUserRole === 'superadmin') {
      return true; // Superadmins see all items
    }
    if (currentUserRole === 'admin') {
      return !item.superAdminOnly; // Admins see all non-superadmin-only items
    }
    // For 'user' role or if role is null (initial state before useEffect)
    return !item.adminOnly && !item.superAdminOnly; 
  });
  
  // Handle case where user is not admin and only 'Profile' should be shown
  // This logic might need adjustment based on exact requirements for non-admin roles.
  // For now, if it's a 'user', they see items marked with adminOnly: false.
  const finalNavItems = (currentUserRole === 'user') 
    ? allNavItems.filter(item => !item.adminOnly && !item.superAdminOnly)
    : navItems;

  if (currentUserRole === null) {
      // Optionally, render a loading state or fewer items
      return (
        <nav className="flex flex-col gap-2 p-4 text-sm font-medium">
            {/* Placeholder or loading indicator */}
        </nav>
      );
  }

  return (
    <nav className="flex flex-col gap-2 p-4 text-sm font-medium">
      {finalNavItems.map((item) => (
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
