
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Users, CalendarCheck, BarChartHorizontalBig, HelpCircle, ScanLine, UserCheck, BarChart3, User as UserIcon, Loader2, Settings } from "lucide-react";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/types";
import { getMiqaats } from "@/lib/firebase/miqaatService"; // Assuming this is needed for admin
import type { Miqaat } from "@/types"; // Assuming this is needed for admin

const adminOverviewStats = [
  { title: "Active Miqaats", value: "3", icon: CalendarCheck, trend: "+5 last week" }, 
  { title: "Total Members", value: "1,205", icon: Users, trend: "+50 new" }, 
  { title: "Overall Attendance", value: "85%", icon: Activity, trend: "Avg. last 7 days" },
  { title: "Pending Reports", value: "2", icon: BarChartHorizontalBig, trend: "Needs attention" },
];

const mockCurrentMiqaat = {
  name: "Miqaat Al-Layl (Evening Session)",
  details: "Today, 7:00 PM - 9:00 PM at Main Hall",
};

function DashboardFooter() {
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  return (
    <footer className="mt-auto border-t bg-card py-4 px-6 text-sm text-muted-foreground">
      <div className="flex w-full flex-row items-center justify-between gap-4"> {/* Changed to flex-row and removed sm breakpoint */}
        <p className="text-left"> {/* Added text-left for the paragraph */}
          Designed and Managed by Shabbir Shakir &copy; {new Date().getFullYear()} BGK Attendance. All rights reserved.
        </p>
        <Dialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <HelpCircle className="mr-2 h-4 w-4" />
              Need Help?
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Need Assistance?</DialogTitle>
              <DialogDescription>
                Here you can find information on how to use the BGK Attendance system or contact support.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
              <h4 className="font-semibold">Contact Support:</h4>
              <p>If you encounter any issues or have questions, please contact your Mohallah admin or the technical support team at <a href="mailto:support@bgkattendance.example.com" className="text-primary hover:underline">support@bgkattendance.example.com</a>.</p>
              <h4 className="font-semibold mt-4">FAQs:</h4>
              <p>Q: How do I mark attendance? <br/> A: Navigate to the specific Miqaat and use the barcode scanner or manual entry (if you are an attendance marker).</p>
              <p>Q: Where can I see my attendance history? <br/> A: Go to your Profile page.</p>
            </div>
            <DialogFooter>
              <Button onClick={() => setIsHelpDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </footer>
  );
}


export default function DashboardOverviewPage() {
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>("Valued Member");
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Admin specific state
  const [miqaats, setMiqaats] = useState<Miqaat[]>([]);
  const [isLoadingMiqaats, setIsLoadingMiqaats] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedRole = localStorage.getItem('userRole') as UserRole | null;
      const storedName = localStorage.getItem('userName');
      
      if (storedRole) {
        setCurrentUserRole(storedRole);
        if (storedName) {
          setCurrentUserName(storedName);
        }
        // If admin/superadmin, fetch Miqaats (example of admin-specific data fetching)
        if (storedRole === 'admin' || storedRole === 'superadmin') {
          setIsLoadingMiqaats(true);
          getMiqaats()
            .then(setMiqaats)
            .catch(err => console.error("Failed to fetch miqaats for admin dashboard", err))
            .finally(() => setIsLoadingMiqaats(false));
        }

      } else {
        router.push('/'); 
        return; 
      }
      setIsLoading(false);
    }
  }, [router]);

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
              <CardDescription className="text-muted-foreground">
                Ready to mark your attendance for the current Miqaat.
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
              <CardDescription>For {mockCurrentMiqaat.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{mockCurrentMiqaat.details}</p>
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
        <DashboardFooter />
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
              <CardDescription className="text-muted-foreground">
                Welcome, {currentUserName}! Manage member attendance and view reports.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Key Actions</CardTitle>
              <CardDescription>Access your primary tools.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Button asChild className="w-full">
                <Link href="/dashboard/mark-attendance">
                  <UserCheck className="mr-2 h-5 w-5" /> Mark Member Attendance
                </Link>
              </Button>
              <Button asChild className="w-full">
                <Link href="/dashboard/reports">
                  <BarChart3 className="mr-2 h-5 w-5" /> Generate Attendance Reports
                </Link>
              </Button>
              <Button asChild className="w-full">
                <Link href="/dashboard/profile">
                  <UserIcon className="mr-2 h-5 w-5" /> View My Profile
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
        <DashboardFooter />
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
            <CardDescription className="text-muted-foreground">
              Welcome, {currentUserName}! Overview of system activity and management tools. Current Role: {currentUserRole}
            </CardDescription>
          </CardHeader>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {adminOverviewStats.map((stat) => (
            <Card key={stat.title} className="shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <stat.icon className="h-5 w-5 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.trend}</p>
              </CardContent>
            </Card>
          ))}
        </div>
         {/* Additional admin-specific content can go here, like Miqaat summaries if needed */}
        {isLoadingMiqaats && (
          <div className="flex justify-center items-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Loading system data...</p>
          </div>
        )}
      </div>
      <DashboardFooter />
    </div>
  );
}

