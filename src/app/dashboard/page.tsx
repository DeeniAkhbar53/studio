
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Users, CalendarCheck, BarChartHorizontalBig, User, Clock } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

// Simulate current user role. In a real app, get this from auth context or user data.
// Change to 'user', 'admin', or 'superadmin' to test.
const currentUserRole: 'user' | 'admin' | 'superadmin' = 'user'; 
// const currentUserRole: 'user' | 'admin' | 'superadmin' = 'admin'; 

const adminOverviewStats = [
  { title: "Active Miqaats", value: "3", icon: CalendarCheck, trend: "+5 last week" },
  { title: "Total Members", value: "1,205", icon: Users, trend: "+50 new" },
  { title: "Overall Attendance", value: "85%", icon: Activity, trend: "Avg. last 7 days" },
  { title: "Pending Reports", value: "2", icon: BarChartHorizontalBig, trend: "Needs attention" },
];

// Mock user data for welcome message - in a real app, this would come from user session
const currentUserName = "Mohamed Ali"; // Example user name

export default function DashboardOverviewPage() {
  if (currentUserRole === 'user') {
    return (
      <div className="space-y-6">
        <Card className="shadow-lg bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-foreground">Welcome, {currentUserName}!</CardTitle>
            <CardDescription className="text-muted-foreground">
              Here's a quick look at your upcoming engagements.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-foreground">You are doing great! Keep up the good work.</p>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Upcoming Miqaats</CardTitle>
              <CardDescription>Quick view of scheduled events.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => ( // Show fewer for user view
                <div key={i} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <div>
                    <h3 className="font-semibold text-foreground">Miqaat Name {i + 1}</h3>
                    <p className="text-sm text-muted-foreground">Date: October {20 + i}, 2024 - 7:00 PM</p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/dashboard/miqaat-management">View Details</Link>
                  </Button>
                </div>
              ))}
              <Button variant="link" className="w-full" asChild>
                  <Link href="/dashboard/miqaat-management">View all my Miqaats</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Profile card removed as per request */}
          
        </div>
        <p className="text-sm text-muted-foreground">
          If you have any questions or need assistance, please contact your Mohallah admin.
        </p>
      </div>
    );
  }

  // Admin View
  return (
    <div className="space-y-6">
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

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Upcoming Miqaats</CardTitle>
            <CardDescription>Quick view of scheduled events.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div>
                  <h3 className="font-semibold text-foreground">Miqaat Name {i + 1}</h3>
                  <p className="text-sm text-muted-foreground">Date: October {20 + i}, 2024 - 7:00 PM</p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/miqaat-management">View Details</Link>
                </Button>
              </div>
            ))}
             <Button variant="link" className="w-full" asChild>
                <Link href="/dashboard/miqaat-management">View all Miqaats</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks at your fingertips.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button asChild className="w-full">
              <Link href="/dashboard/miqaat-management">Manage Miqaats</Link>
            </Button>
            <Button asChild className="w-full">
              <Link href="/dashboard/mohallah-management">Manage Mohallahs</Link>
            </Button>
            <Button asChild className="w-full">
              <Link href="/dashboard/reports">Generate Report</Link>
            </Button>
             <Button asChild className="w-full">
              <Link href="/dashboard/profile">View My Profile</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li className="text-sm text-muted-foreground">Admin updated "Miqaat Al-Khamis".</li>
            <li className="text-sm text-muted-foreground">New member "John Doe" added to Team Alpha.</li>
            <li className="text-sm text-muted-foreground">Attendance report generated for "Miqaat Al-Jumuah".</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
