
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Users, CalendarCheck, ScanLine, Loader2, Settings, HelpCircle, ListChecks, BarChart3, Home as HomeIcon, Building } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { UserRole, Miqaat } from "@/types";
import { getMiqaats } from "@/lib/firebase/miqaatService";
import { getUsersCount } from "@/lib/firebase/userService";
import { getMohallahsCount } from "@/lib/firebase/mohallahService";
import { Separator } from "@/components/ui/separator";
import type { Unsubscribe } from "firebase/firestore";

interface AdminStat {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  isLoading?: boolean;
}

export default function DashboardOverviewPage() {
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>("Valued Member");
  const [currentUserMohallahId, setCurrentUserMohallahId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const [activeMiqaatsCount, setActiveMiqaatsCount] = useState<number>(0);
  const [totalMembersCount, setTotalMembersCount] = useState<number>(0);
  const [totalMohallahsCount, setTotalMohallahsCount] = useState<number>(0);
  const [isLoadingStats, setIsLoadingStats] = useState(true);


  useEffect(() => {
    let unsubscribeMiqaats: Unsubscribe | null = null;
    const storedRole = localStorage.getItem('userRole') as UserRole | null;
    const storedName = localStorage.getItem('userName');
    const storedItsId = localStorage.getItem('userItsId');
    const storedMohallahId = localStorage.getItem('userMohallahId');

    if (storedItsId && storedRole) {
      setCurrentUserRole(storedRole);
      setCurrentUserMohallahId(storedMohallahId);
      if (storedName) {
        setCurrentUserName(storedName);
      }

      if (storedRole === 'admin' || storedRole === 'superadmin') {
        setIsLoadingStats(true);
        
        unsubscribeMiqaats = getMiqaats((fetchedMiqaats) => {
          setActiveMiqaatsCount(fetchedMiqaats.filter(m => new Date(m.endTime) > new Date()).length);
        });

        const fetchCounts = async () => {
          try {
            const membersCount = await getUsersCount(storedRole === 'admin' ? storedMohallahId || undefined : undefined);
            setTotalMembersCount(membersCount);
            
            if (storedRole === 'superadmin') {
              const mohallahsCount = await getMohallahsCount();
              setTotalMohallahsCount(mohallahsCount);
            }
          } catch (err) {
            console.error("Failed to fetch dashboard counts", err);
          } finally {
            setIsLoadingStats(false);
          }
        };
        fetchCounts();
      }
    } else {
      router.push('/');
    }
    setIsLoading(false);
    
    return () => {
      if (unsubscribeMiqaats) {
        unsubscribeMiqaats();
      }
    };
  }, [router]);

  const adminOverviewStats: AdminStat[] = [
    { title: "Active Miqaats", value: activeMiqaatsCount, icon: CalendarCheck, isLoading: isLoadingStats && (currentUserRole === 'admin' || currentUserRole === 'superadmin') },
    { title: "Total Members", value: totalMembersCount, icon: Users, isLoading: isLoadingStats && (currentUserRole === 'admin' || currentUserRole === 'superadmin'), trend: currentUserRole === 'admin' ? "In your Mohallah" : "System-wide" },
  ];

  if (currentUserRole === 'superadmin') {
    adminOverviewStats.push(
      { title: "Total Mohallahs", value: totalMohallahsCount, icon: Building, isLoading: isLoadingStats }
    );
  }
   adminOverviewStats.push(
     { title: "Overall Attendance", value: "85%", icon: Activity, trend: "Avg. last 7 days (Mock)" } // Mock data
   );


  if (isLoading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading user data...</p>
      </div>
    );
  }

  if (currentUserRole === 'user') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-grow space-y-6">
          <Card className="shadow-lg bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
            <CardHeader>
              <CardTitle className="text-3xl font-bold text-foreground">Welcome, {currentUserName}!</CardTitle>
              <Separator className="my-2"/>
              <CardDescription className="text-muted-foreground">
                Ready to mark your attendance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-foreground">Please ensure you are on time for all Miqaats.</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center">
                <ScanLine className="mr-3 h-6 w-6 text-primary" />
                Scan Attendance
              </CardTitle>
              <Separator className="my-2"/>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button asChild className="w-full" size="lg">
                <Link href="/dashboard/scan-attendance">
                  <ScanLine className="mr-2 h-5 w-5" /> Mark My Attendance / Scan Barcode
                </Link>
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Click the button above to open the scanner or enter details manually.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (currentUserRole === 'attendance-marker') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-grow space-y-6">
          <Card className="shadow-lg bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
            <CardHeader>
              <CardTitle className="text-3xl font-bold text-foreground">Attendance Marker Dashboard</CardTitle>
               <Separator className="my-2"/>
              <CardDescription className="text-muted-foreground">
                Welcome, {currentUserName}! Use the sidebar to navigate to Mark Attendance or View Reports.
              </CardDescription>
            </CardHeader>
          </Card>
          {/* Potentially add a card here for "Miqaats available for marking" if desired */}
        </div>
      </div>
    );
  }

  // Admin or Superadmin View
  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow space-y-6">
        <Card className="shadow-lg bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-foreground">Admin Dashboard</CardTitle>
            <Separator className="my-2"/>
            <CardDescription className="text-muted-foreground">
              Welcome, {currentUserName}! Overview of system activity. Current Role: {currentUserRole}
            </CardDescription>
          </CardHeader>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {adminOverviewStats.map((stat) => (
            <Card key={stat.title} className="shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground break-words">{stat.title}</CardTitle>
                <stat.icon className="h-5 w-5 text-accent shrink-0" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground break-all">
                  {stat.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stat.value}
                </div>
                {stat.trend && <p className="text-xs text-muted-foreground break-words">{stat.trend}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
         {(isLoadingStats && (currentUserRole === 'admin' || currentUserRole === 'superadmin') && !adminOverviewStats.some(s => !s.isLoading)) && (
          <div className="flex justify-center items-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Loading system data...</p>
          </div>
        )}
      </div>
    </div>
  );
}
