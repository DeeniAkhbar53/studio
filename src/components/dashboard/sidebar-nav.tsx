
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { UserDesignation, UserRole } from "@/types";
import { Home, User, CalendarDays, Building, BarChart3, UserCheck, Bell, Settings, Users as UsersIcon, FileText, ScrollText, BookOpen, Shield, ChevronDown } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getFeatureFlags } from "@/lib/firebase/settingsService";

interface NavSubItem {
  href: string;
  label: string;
  icon: React.ElementType;
  allowedRoles?: UserRole[];
  requiredPageRight?: string;
  requiresTeamLead?: boolean;
  requiresCaptain?: boolean;
  isDuaPage?: boolean;
  featureFlag?: 'isDuaPageEnabled' | 'isFormsEnabled';
}

interface NavItem {
  title: string;
  subpages: NavSubItem[];
}

export const allNavItems: NavItem[] = [
    {
      title: "Dashboard",
      subpages: [
        { href: "/dashboard", label: "Overview", icon: Home },
        { href: "/dashboard/profile", label: "Profile", icon: User },
        { href: "/dashboard/notifications", label: "Notifications", icon: Bell }
      ]
    },
    {
      title: "Attendance",
      subpages: [
        { href: "/dashboard/mark-attendance", label: "Mark Attendance", icon: UserCheck, allowedRoles: ['admin', 'superadmin', 'attendance-marker'] },
        { href: "/dashboard/miqaat-management", label: "Miqaats", icon: CalendarDays, allowedRoles: ['admin', 'superadmin', 'attendance-marker'] },
        { href: "/dashboard/dua", label: "Dua", icon: BookOpen, isDuaPage: true, featureFlag: 'isDuaPageEnabled' }
      ]
    },
    {
      title: "Management",
      subpages: [
        { href: "/dashboard/manage-mohallahs", label: "Manage Mohallahs", icon: Building, allowedRoles: ['admin', 'superadmin'] },
        { href: "/dashboard/manage-members", label: "Manage Members", icon: UsersIcon, allowedRoles: ['admin', 'superadmin'], requiresTeamLead: true },
        { href: "/dashboard/manage-teams", label: "Manage Teams", icon: Shield, allowedRoles: ['admin', 'superadmin'], requiresCaptain: true },
        { href: "/dashboard/manage-notifications", label: "Manage Notifications", icon: Bell, allowedRoles: ['admin', 'superadmin'] },
        { href: "/dashboard/settings", label: "Settings", icon: Settings, allowedRoles: ['superadmin'] }
      ]
    },
    {
      title: "Reports & Logs",
      subpages: [
        { href: "/dashboard/reports", label: "Reports", icon: BarChart3, allowedRoles: ['admin', 'superadmin', 'attendance-marker'] },
        { href: "/dashboard/forms", label: "Forms / Surveys", icon: FileText, featureFlag: 'isFormsEnabled' },
        { href: "/dashboard/login-logs", label: "Login Logs", icon: ScrollText, allowedRoles: ['superadmin'] },
        { href: "/dashboard/audit-logs", label: "Audit Logs", icon: Shield, allowedRoles: ['superadmin'] }
      ]
    }
];

export function findNavItem(href: string): NavSubItem | undefined {
    for (const category of allNavItems) {
        const found = category.subpages.find(subpage => subpage.href === href);
        if (found) return found;
    }
    return undefined;
}

function SidebarNavSkeleton() {
  return (
    <nav className="flex flex-col gap-6 p-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="space-y-1">
          <div className="h-3.5 w-20 animate-pulse rounded bg-sidebar-accent/40 ml-3 mb-2" />
          {[...Array(3)].map((_, j) => (
            <div key={j} className="flex h-9 animate-pulse items-center gap-3 rounded-sm bg-sidebar-accent/25 px-3 py-2 border-r-2 border-transparent">
              <div className="h-4 w-4 shrink-0 rounded-sm bg-sidebar-accent/50" />
              <div className="h-3.5 flex-grow rounded-sm bg-sidebar-accent/50" />
            </div>
          ))}
        </div>
      ))}
    </nav>
  );
}

interface SidebarNavProps {
  onItemClick?: () => void;
}

export function SidebarNav({ onItemClick }: SidebarNavProps) {
  const pathname = usePathname();
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [currentUserDesignation, setCurrentUserDesignation] = useState<UserDesignation | null>(null);
  const [userPageRights, setUserPageRights] = useState<string[]>([]);
  const [currentUserMohallahId, setCurrentUserMohallahId] = useState<string | null>(null);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const [featureFlags, setFeatureFlags] = useState({ isDuaPageEnabled: true, isFormsEnabled: true });
  
  const TEAM_LEAD_DESIGNATIONS: UserDesignation[] = ["Captain", "Vice Captain", "Group Leader", "Asst.Grp Leader", "Major"];
  const TARGET_MOHALLAH_ID = "ZMGsLMWcFQEM97jWD03x";

  useEffect(() => {
    const loadInitialData = async () => {
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

      const flags = await getFeatureFlags();
      setFeatureFlags(flags as any);

      setIsMounted(true);
    };

    loadInitialData();

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
    window.addEventListener('featureFlagsUpdated', loadInitialData);

    return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('notificationsUpdated', handleNotificationsUpdate);
        window.removeEventListener('featureFlagsUpdated', loadInitialData);
    };
  }, []);
  
  const getIsActive = (href: string, currentPath: string) => {
    if (href === "/dashboard") {
      return currentPath === href;
    }
    return currentPath.startsWith(href);
  };
  
  const hasAccess = useCallback((item: NavSubItem) => {
    if (!isMounted) return false;
    
    if (item.featureFlag && !featureFlags[item.featureFlag]) {
        return false;
    }

    const role = currentUserRole || 'user';
    const designation = currentUserDesignation || 'Member';
    const isTeamLead = TEAM_LEAD_DESIGNATIONS.includes(designation);
    const isAdminOrSuper = role === 'admin' || role === 'superadmin';

    if (item.isDuaPage) {
        return currentUserMohallahId === TARGET_MOHALLAH_ID || role === 'superadmin';
    }

    if (userPageRights.length > 0) {
        if (item.href === '/dashboard' || item.href === '/dashboard/profile' || item.href === '/dashboard/notifications') {
            return true;
        }
        return userPageRights.includes(item.href);
    }

    const hasRoleAccess = !item.allowedRoles || item.allowedRoles.includes(role);

    if (item.requiresTeamLead && isTeamLead && !isAdminOrSuper) return true;
    if (item.requiresCaptain && designation === 'Captain') return true;
    
    return hasRoleAccess;
  }, [isMounted, currentUserRole, currentUserDesignation, userPageRights, currentUserMohallahId, featureFlags]);

  if (!isMounted) {
    return <SidebarNavSkeleton />;
  }

  return (
    <nav className="flex flex-col gap-6 p-4 select-none">
      {allNavItems.map((category) => {
        const visibleSubpages = category.subpages.filter(hasAccess);

        if (visibleSubpages.length === 0) return null;

        return (
          <div key={category.title} className="space-y-0.5">
            <h4
              className="px-3 text-[10px] font-bold uppercase tracking-widest mb-1.5"
              style={{ color: 'hsl(var(--sidebar-foreground) / 0.45)' }}
            >
              {category.title}
            </h4>
            <ul className="flex flex-col gap-0.5">
              {visibleSubpages.map((subpage) => {
                const isActive = getIsActive(subpage.href, pathname);
                const Icon = subpage.icon;
                const badgeCount = subpage.href === "/dashboard/notifications" ? unreadNotificationCount : 0;
                
                return (
                  <li key={subpage.href}>
                    <Link
                      href={subpage.href}
                      onClick={() => onItemClick?.()}
                      className={cn(
                        "group flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium rounded-md border-r-2 transition-all duration-150",
                        isActive
                          ? "rounded-r-none"
                          : "border-transparent"
                      )}
                      style={isActive ? {
                        backgroundColor: 'hsl(var(--sidebar-primary) / 0.14)',
                        color: 'hsl(var(--sidebar-primary))',
                        borderRightColor: 'hsl(var(--sidebar-primary))',
                      } : {
                        color: 'hsl(var(--sidebar-foreground) / 0.78)',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          (e.currentTarget as HTMLElement).style.backgroundColor = 'hsl(var(--sidebar-accent))';
                          (e.currentTarget as HTMLElement).style.color = 'hsl(var(--sidebar-accent-foreground))';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          (e.currentTarget as HTMLElement).style.backgroundColor = '';
                          (e.currentTarget as HTMLElement).style.color = 'hsl(var(--sidebar-foreground) / 0.80)';
                        }
                      }}
                    >
                      <Icon
                        className="h-4 w-4 shrink-0 transition-colors"
                        style={{
                          color: isActive
                            ? 'hsl(var(--sidebar-primary))'
                            : 'hsl(var(--sidebar-foreground) / 0.50)',
                        }}
                      />
                      <span className="truncate flex-1">{subpage.label}</span>
                      {badgeCount > 0 && (
                        <span className="ml-auto min-w-[18px] h-5 flex items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] text-destructive-foreground font-bold">
                          {badgeCount > 9 ? '9+' : badgeCount}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
