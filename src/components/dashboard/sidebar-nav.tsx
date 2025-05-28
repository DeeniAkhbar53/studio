
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, User, CalendarDays, Users, BarChart3, Building } from "lucide-react";

const allNavItems = [
  { href: "/dashboard", label: "Overview", icon: Home, adminOnly: false },
  { href: "/dashboard/profile", label: "Profile", icon: User, adminOnly: false },
  { href: "/dashboard/miqaat-management", label: "Miqaats", icon: CalendarDays, adminOnly: true },
  { href: "/dashboard/mohallah-management", label: "Mohallahs", icon: Building, adminOnly: true },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart3, adminOnly: true },
];

export function SidebarNav() {
  const pathname = usePathname();

  // Simulate current user role. In a real app, get this from auth context or user data.
  // Change to 'user', 'admin', or 'superadmin' to test.
  const currentUserRole: 'user' | 'admin' | 'superadmin' = 'user'; 

  const navItems = allNavItems.filter(item => {
    if (currentUserRole === 'admin' || currentUserRole === 'superadmin') {
      return true; // Admins/Superadmins see all items
    }
    return !item.adminOnly; // Non-admins see only items not marked as adminOnly
  });

  // If the user is not an admin and only profile is shown, ensure "Profile" is the only item.
  // This handles the case where a non-admin might have only profile.
  const finalNavItems = (currentUserRole !== 'admin' && currentUserRole !== 'superadmin')
    ? allNavItems.filter(item => item.href === "/dashboard/profile")
    : navItems;


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
