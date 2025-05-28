
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AttendanceRecord, User, Mohallah } from "@/types"; // Added Mohallah
import { Edit3, Mail, Phone, ShieldCheck, Users, MapPin, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { getUserByItsOrBgkId } from "@/lib/firebase/userService"; // To fetch user
import { getMohallahs } from "@/lib/firebase/mohallahService"; // To fetch mohallahs for name lookup
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [mohallahs, setMohallahs] = useState<Mohallah[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchProfileData = async () => {
      setIsLoading(true);
      if (typeof window !== "undefined") {
        const storedItsId = localStorage.getItem('userItsId');
        if (storedItsId) {
          try {
            const fetchedUser = await getUserByItsOrBgkId(storedItsId);
            setUser(fetchedUser);
            if (fetchedUser?.mohallahId) {
              const fetchedMohallahs = await getMohallahs();
              setMohallahs(fetchedMohallahs);
            }
          } catch (error) {
            console.error("Failed to fetch profile data:", error);
            setUser(null); // Clear user on error
          }
        } else {
          // No ITS ID found, maybe redirect to login
          router.push('/');
          return;
        }
      }
      setIsLoading(false);
    };

    fetchProfileData();
  }, [router]);

  const getMohallahName = (mohallahId?: string) => {
    if (!mohallahId) return "N/A";
    const mohallah = mohallahs.find(m => m.id === mohallahId);
    return mohallah ? mohallah.name : "Unknown Mohallah";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-destructive">Could not load user profile. Please try logging in again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden shadow-xl">
        <div className="bg-muted/30 p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
          <Avatar className="h-24 w-24 md:h-32 md:w-32 border-4 border-background shadow-md">
            <AvatarImage src={user.avatarUrl || `https://placehold.co/100x100.png?text=${user.name.substring(0,2).toUpperCase()}`} alt={user.name} data-ai-hint="profile avatar" />
            <AvatarFallback>{user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="text-center md:text-left">
            <h1 className="text-3xl font-bold text-foreground">{user.name}</h1>
            <p className="text-accent">{user.itsId} {user.bgkId && `/ ${user.bgkId}`}</p>
            <div className="mt-2 flex items-center justify-center md:justify-start gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>{user.role.charAt(0).toUpperCase() + user.role.slice(1).replace(/-/g, ' ')}</span>
            </div>
          </div>
          <Button variant="outline" size="sm" className="md:ml-auto mt-4 md:mt-0" disabled>
            <Edit3 className="mr-2 h-4 w-4" />
            Edit Profile (Soon)
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
                    <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> {user.itsId}@itsjamea.com (Example Email)</li>
                    <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> {user.phoneNumber || "Not Provided"}</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Affiliations</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Team: {user.team || "N/A"}</li>
                    <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Mohallah: {getMohallahName(user.mohallahId)}</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </TabsContent>
          <TabsContent value="history">
            <CardContent className="p-6">
              <p className="text-center text-muted-foreground">Attendance history feature coming soon.</p>
              {/* 
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
              */}
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
