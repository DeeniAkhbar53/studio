import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Users, CalendarCheck, BarChartHorizontalBig } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const overviewStats = [
  { title: "Active Miqaats", value: "3", icon: CalendarCheck, trend: "+5 last week" },
  { title: "Total Members", value: "1,205", icon: Users, trend: "+50 new" },
  { title: "Overall Attendance", value: "85%", icon: Activity, trend: "Avg. last 7 days" },
  { title: "Pending Reports", value: "2", icon: BarChartHorizontalBig, trend: "Needs attention" },
];

export default function DashboardOverviewPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {overviewStats.map((stat) => (
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
