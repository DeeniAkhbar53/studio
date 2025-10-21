
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { UserDesignation, UserRole } from "@/types";
import { Home, User, CalendarDays, Building, BarChart3, UserCheck, Bell, Settings, Users as UsersIcon, FileText, ScrollText, BookOpen, Shield, ChevronDown } from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface NavSubItem {
  href: string;
  label: string;
  allowedRoles?: UserRole[];
  // for fine-grained access, if a role isn't enough
  requiredPageRight?: string;
  // for special cases like team lead access
  requiresTeamLead?: boolean;
  requiresCaptain?: boolean;
  // for dua page
  isDuaPage?: boolean;
}

interface NavItem {
  title: string;
  icon: React.ElementType;
  subpages: NavSubItem[];
}

// Re-structured navigation based on user's JSON
export const allNavItems: NavItem[] = [
    {
      title: "Dashboard",
      icon: Home,
      subpages: [
        { href: "/dashboard", label: "Overview" },
        { href: "/dashboard/profile", label: "Profile" },
        { href: "/dashboard/notifications", label: "Notifications" }
      ]
    },
    {
      title: "Attendance",
      icon: UserCheck,
      subpages: [
        { href: "/dashboard/mark-attendance", label: "Mark Attendance", allowedRoles: ['admin', 'superadmin', 'attendance-marker'] },
        { href: "/dashboard/miqaat-management", label: "Miqaats", allowedRoles: ['admin', 'superadmin', 'attendance-marker'] },
        { href: "/dashboard/dua", label: "Dua", isDuaPage: true }
      ]
    },
    {
      title: "Management",
      icon,
      subpages: [
        { href: "/dashboard/manage-mohallahs", label: "Manage Mohallahs", allowedRoles: ['admin', 'superadmin'] },
        { href: "/dashboard/manage-members", label: "Manage Members", allowedRoles: ['admin', 'superadmin'], requiresTeamLead: true },
        { href: "/dashboard/manage-teams", label: "Manage Teams", allowedRoles: ['admin', 'superadmin'], requiresCaptain: true },
        { href: "/dashboard/manage-notifications", label: "Manage Notifications", allowedRoles: ['admin', 'superadmin'] }
      ]
    },
    {
      title: "Reports & Logs",
      icon: BarChart3,
      subpages: [
        { href: "/dashboard/reports", label: "Reports", allowedRoles: ['admin', 'superadmin', 'attendance-marker'] },
        { href: "/dashboard/forms", label: "Forms / Surveys" },
        { href: "/dashboard/login-logs", label: "Login Logs", allowedRoles: ['superadmin'] },
        { href: "/dashboard/audit-logs", label: "Audit Logs", allowedRoles: ['superadmin'] }
      ]
    }
];

const iconMap: { [key: string]: React.ElementType } = {
  home: Home,
  "user-check": UserCheck,
  settings: Settings,
  "bar-chart-2": BarChart3,
};

// Helper to find a nav item by its href, searching through the nested structure
export function findNavItem(href: string): NavSubItem | undefined {
    for (const category of allNavItems) {
        const found = category.subpages.find(subpage => subpage.href === href);
        if (found) return found;
    }
    return undefined;
}


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
  const [activeAccordionItem, setActiveAccordionItem] = useState<string | undefined>();
  
  const TEAM_LEAD_DESIGNATIONS: UserDesignation[] = ["Captain", "Vice Captain", "Group Leader", "Asst.Grp Leader", "Major"];
  const TARGET_MOHALLAH_ID = "ZMGsLMWcFQEM97jWD03x"; // The ID of the allowed Mohallah


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
        console.error("Failed to parse page rights from localStorage", e);
      }
    }
    
    setCurrentUserRole(storedRole);
    setCurrentUserDesignation(storedDesignation);
    setUserPageRights(parsedPageRights);
    setCurrentUserMohallahId(storedMohallahId);
    setUnreadNotificationCount(storedUnreadCount);
    setIsMounted(true);

    const handleStorageChange = (event: StorageEvent) => {
        if (event.key === 'userRole') setCurrentUserRole(localStorage.getItem('userRole') as UserRole | null);
        if (event.key === 'userDesignation') setCurrentUserDesignation(localStorage.getItem('userDesignation') as UserDesignation | null);
        if (event.key === 'userPageRights') {
            const updatedPageRightsRaw = localStorage.getItem('userPageRights');
            let updatedParsedPageRights: string[] = [];
            if (updatedPageRightsRaw) { try { const tempParsed = JSON.parse(updatedPageRightsRaw); if (Array.isArray(tempParsed)) { updatedParsedPageRights = tempParsed; } } catch (e) { console.error("Failed to parse page rights from storage change", e); } }
            setUserPageRights(updatedParsedPageRights);
        }
        if (event.key === 'userMohallahId') setCurrentUserMohallahId(localStorage.getItem('userMohallahId'));
        if (event.key === 'unreadNotificationCount') setUnreadNotificationCount(parseInt(localStorage.getItem('unreadNotificationCount') || '0', 10));
    };

    const handleNotificationsUpdate = () => {
        setUnreadNotificationCount(parseInt(localStorage.getItem('unreadNotificationCount') || '0', 10));
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('notificationsUpdated', handleNotificationsUpdate);

    return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('notificationsUpdated', handleNotificationsUpdate);
    };
  }, []);
  
  useEffect(() => {
    const activeParent = allNavItems.find(item => item.subpages.some(sub => sub.href === pathname || pathname.startsWith(sub.href + '/')));
    setActiveAccordionItem(activeParent?.title);
  }, [pathname]);
  
  const hasAccess = useCallback((item: NavSubItem) => {
    if (!isMounted) return false;

    const role = currentUserRole || 'user';
    const designation = currentUserDesignation || 'Member';
    const isTeamLead = TEAM_LEAD_DESIGNATIONS.includes(designation);
    const isAdminOrSuper = role === 'admin' || role === 'superadmin';

    // Specific logic for Dua page
    if (item.isDuaPage) {
        return currentUserMohallahId === TARGET_MOHALLAH_ID || role === 'superadmin';
    }

    const hasRoleAccess = !item.allowedRoles || item.allowedRoles.includes(role);
    const hasPageRight = userPageRights.includes(item.href);

    if (hasPageRight) return true;
    if (item.requiresTeamLead && isTeamLead && !isAdminOrSuper) return true;
    if (item.requiresCaptain && designation === 'Captain') return true;
    
    return hasRoleAccess;
  }, [isMounted, currentUserRole, currentUserDesignation, userPageRights, currentUserMohallahId]);


  if (!isMounted) {
    return <SidebarNavSkeleton />;
  }

  return (
    <TooltipProvider>
      <nav className="flex flex-col gap-1 p-2 text-sm font-medium">
        <Accordion type="single" collapsible value={activeAccordionItem} onValueChange={setActiveAccordionItem} className="w-full">
          {allNavItems.map((item) => {
            const Icon = iconMap[item.icon as keyof typeof iconMap] || Settings;
            const visibleSubpages = item.subpages.filter(hasAccess);

            if (visibleSubpages.length === 0) return null;

            return (
              <AccordionItem value={item.title} key={item.title} className="border-b-0">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <AccordionTrigger className="py-2 px-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:no-underline data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                            <div className="flex items-center gap-3">
                                <Icon className="h-4 w-4" />
                                <span className="truncate">{item.title}</span>
                            </div>
                        </AccordionTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center">{item.title}</TooltipContent>
                </Tooltip>
                <AccordionContent className="pt-1">
                  <ul className="flex w-full min-w-0 flex-col gap-1 pl-4 border-l border-sidebar-border ml-5 py-2">
                    {visibleSubpages.map((subpage) => {
                      const isActive = pathname === subpage.href || pathname.startsWith(subpage.href + '/');
                      const badgeCount = subpage.href === "/dashboard/notifications" ? unreadNotificationCount : 0;
                      return (
                        <li key={subpage.href}>
                          <Link
                            href={subpage.href}
                            className={cn(
                              "flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sidebar-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                              isActive ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold" : ""
                            )}
                          >
                            <span>{subpage.label}</span>
                            {badgeCount > 0 && (
                               <span className="ml-auto min-w-[20px] h-5 flex items-center justify-center rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground">
                                {badgeCount > 9 ? '9+' : badgeCount}
                              </span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </nav>
    </TooltipProvider>
  );
}

// Simplified SidebarNav component with refined logic
const iconMapping: { [key: string]: React.ElementType } = {
  home: Home,
  "user-check": UserCheck,
  settings: Settings,
  "bar-chart-2": BarChart3,
  // Add other icons from the JSON if needed
};
