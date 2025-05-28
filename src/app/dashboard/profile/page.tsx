
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AttendanceRecord, User, Mohallah } from "@/types";
import { Edit3, Mail, Phone, ShieldCheck, Users, MapPin, Loader2, CalendarClock } from "lucide-react";
import { useState, useEffect } from "react";
import { getUserByItsOrBgkId } from "@/lib/firebase/userService";
import { getMohallahs } from "@/lib/firebase/mohallahService";
import { getAttendanceRecordsByUser } from "@/lib/firebase/attendanceService";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import type { Unsubscribe } from "firebase/firestore";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [mohallahs, setMohallahs] = useState<Mohallah[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let unsubscribeMohallahs: Unsubscribe | null = null;
    let isMounted = true;

    const fetchProfileData = async () => {
      setIsLoading(true);
      setHistoryError(null); 

      if (typeof window !== "undefined") {
        const storedItsId = localStorage.getItem('userItsId');
        if (storedItsId) {
          try {
            const fetchedUser = await getUserByItsOrBgkId(storedItsId);
            if (isMounted) {
              setUser(fetchedUser);
            }

            unsubscribeMohallahs = getMohallahs((fetchedMohallahsData) => {
              if (isMounted) {
                setMohallahs(fetchedMohallahsData);
              }
            });

            if (fetchedUser) {
              setIsLoadingHistory(true);
              try {
                const history = await getAttendanceRecordsByUser(fetchedUser.itsId);
                if (isMounted) {
                  setAttendanceHistory(history);
                }
              } catch (historyFetchError: any) {
                console.error("Failed to fetch attendance history:", historyFetchError); // Crucial log
                if (isMounted) {
                  setAttendanceHistory([]);
                  // Simplified error message - directs user to console for specific Firebase error
                  setHistoryError("Could not load attendance history at this time. Please check the browser console for more details.");
                }
              } finally {
                if (isMounted) {
                  setIsLoadingHistory(false);
                }
              }
            } else {
              if (isMounted) {
                setAttendanceHistory([]);
                setIsLoadingHistory(false);
              }
            }
          } catch (error) {
            console.error("Failed to fetch profile data (user details):", error);
            if (isMounted) {
              setUser(null);
              setAttendanceHistory([]);
            }
          } finally {
            if (isMounted) {
              setIsLoading(false);
            }
          }
        } else {
          router.push('/');
          if (isMounted) setIsLoading(false);
          return;
        }
      } else {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchProfileData();

    return () => {
      isMounted = false;
      if (unsubscribeMohallahs) {
        unsubscribeMohallahs();
      }
    };
  }, [router]);

  const getMohallahName = (mohallahId?: string) => {
    if (!mohallahId || mohallahs.length === 0) return "N/A";
    const mohallah = mohallahs.find(m => m.id === mohallahId);
    return mohallah ? mohallah.name : "Unknown Mohallah";
  };

  if (isLoading && !user) {
    return (
      <div className="flex items-center justify-center h-full py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full py-10">
        <p className="text-destructive">Could not load user profile. Please try logging in again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden shadow-xl">
        <div className="bg-muted/30 p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
          <Avatar className="h-24 w-24 md:h-32 md:w-32 border-4 border-background shadow-md">
            <AvatarImage src={user.avatarUrl || `https://placehold.co/100x100.png?text=${user.name.substring(0,2).toUpperCase()}`} alt={user.name} data-ai-hint="profile avatar"/>
            <AvatarFallback>{user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-grow text-center md:text-left w-full">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-1">
              <h3 className="text-2xl font-bold text-foreground">{user.name}</h3>
              <Button variant="outline" size="sm" className="self-center md:self-auto md:ml-4 mt-4 md:mt-0" disabled>
                <Edit3 className="mr-2 h-4 w-4" />
                Edit Profile (Soon)
              </Button>
            </div>
            <p className="text-accent">{user.itsId} {user.bgkId && `/ ${user.bgkId}`}</p>
            <p className="text-sm text-muted-foreground mt-1">{user.designation || "Member"}</p>
            <div className="mt-2 flex items-center justify-center md:justify-start gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>{user.role.charAt(0).toUpperCase() + user.role.slice(1).replace(/-/g, ' ')}</span>
            </div>
          </div>
        </div>
        <Separator className="my-0"/>
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-none border-b">
            <TabsTrigger value="details">Profile Details</TabsTrigger>
            <TabsTrigger value="history">Attendance History ({!isLoadingHistory && !historyError ? attendanceHistory.length : '...'})</TabsTrigger>
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
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="ml-2 text-muted-foreground">Loading attendance history...</p>
                </div>
              ) : historyError ? (
                 <div className="text-center py-10">
                  <CalendarClock className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-lg text-destructive">{historyError}</p> {/* User sees this simplified message */}
                </div>
              ) : attendanceHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Miqaat Name</TableHead>
                        <TableHead>Date Marked</TableHead>
                        <TableHead className="text-right">Marked By (ITS)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceHistory.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">{record.miqaatName}</TableCell>
                          <TableCell>{format(new Date(record.markedAt), "PP p")}</TableCell>
                          <TableCell className="text-right">
                            {record.markedByItsId || "Self/System"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-10">
                  <CalendarClock className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-lg text-muted-foreground">No attendance history found.</p>
                  <p className="text-sm text-muted-foreground">Your attendance records will appear here once you are marked present for Miqaats.</p>
                </div>
              )}
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
