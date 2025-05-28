"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AttendanceRecord, User } from "@/types";
import { Edit3, Mail, Phone, ShieldCheck, Users, MapPin } from "lucide-react";
import { useState, useEffect } from "react";

const mockUser: User = {
  id: "user123",
  itsId: "12345678",
  bgkId: "BGK001",
  name: "Mohamed Ali",
  team: "Team Alpha",
  phoneNumber: "+1 555-123-4567",
  mohallah: "Saifee Mohallah",
  role: "admin",
  avatarUrl: "https://placehold.co/100x100.png",
};

const mockAttendanceHistory: AttendanceRecord[] = [
  { id: "att1", miqaatId: "m1", miqaatName: "Miqaat Al-Ahad", date: new Date(2024, 8, 15).toISOString(), status: "Present" },
  { id: "att2", miqaatId: "m2", miqaatName: "Miqaat Al-Ithnayn", date: new Date(2024, 8, 16).toISOString(), status: "Present" },
  { id: "att3", miqaatId: "m3", miqaatName: "Miqaat Al-Thulatha", date: new Date(2024, 8, 17).toISOString(), status: "Absent" },
  { id: "att4", miqaatId: "m4", miqaatName: "Miqaat Al-Arbia", date: new Date(2024, 8, 18).toISOString(), status: "Late" },
  { id: "att5", miqaatId: "m5", miqaatName: "Miqaat Al-Khamis", date: new Date(2024, 8, 19).toISOString(), status: "Excused" },
];


export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    // Simulate data fetching
    setUser(mockUser);
    setAttendanceHistory(mockAttendanceHistory);
  }, []);

  if (!user) {
    return <div className="flex items-center justify-center h-full"><p>Loading profile...</p></div>;
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden shadow-xl">
        <div className="bg-muted/30 p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
          <Avatar className="h-24 w-24 md:h-32 md:w-32 border-4 border-background shadow-md">
            <AvatarImage src={user.avatarUrl} alt={user.name} data-ai-hint="profile avatar" />
            <AvatarFallback>{user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="text-center md:text-left">
            <h1 className="text-3xl font-bold text-foreground">{user.name}</h1>
            <p className="text-accent">{user.itsId} / {user.bgkId}</p>
            <div className="mt-2 flex items-center justify-center md:justify-start gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span>
            </div>
          </div>
          <Button variant="outline" size="sm" className="md:ml-auto mt-4 md:mt-0">
            <Edit3 className="mr-2 h-4 w-4" />
            Edit Profile
          </Button>
        </div>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-none border-b">
            <TabsTrigger value="details">Profile Details</TabsTrigger>
            <TabsTrigger value="history">Attendance History</TabsTrigger>
          </TabsList>
          <TabsContent value="details">
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Contact Information</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> {user.itsId}@itsjാമia.com (Example)</li>
                    <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> {user.phoneNumber}</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Affiliations</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Team: {user.team}</li>
                    <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Mohallah: {user.mohallah}</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </TabsContent>
          <TabsContent value="history">
            <CardContent className="p-0">
              {attendanceHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Miqaat Name</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceHistory.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{record.miqaatName}</TableCell>
                        <TableCell>{new Date(record.date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            record.status === 'Present' ? 'bg-green-100 text-green-700' :
                            record.status === 'Absent' ? 'bg-red-100 text-red-700' :
                            record.status === 'Late' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {record.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="p-6 text-center text-muted-foreground">No attendance history found.</p>
              )}
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>
    </div>