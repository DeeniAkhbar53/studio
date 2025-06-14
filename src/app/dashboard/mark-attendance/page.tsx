
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import type { Miqaat, User, MarkedAttendanceEntry, MiqaatAttendanceEntryItem, UserRole } from "@/types";
import { getUserByItsOrBgkId } from "@/lib/firebase/userService";
import { getMiqaats, markAttendanceInMiqaat } from "@/lib/firebase/miqaatService";
import { CheckCircle, AlertCircle, Users, ListChecks, Loader2, Clock } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { Unsubscribe } from "firebase/firestore";
import { format } from "date-fns";


export default function MarkAttendancePage() {
  const [selectedMiqaatId, setSelectedMiqaatId] = useState<string | null>(null);
  const [memberIdInput, setMemberIdInput] = useState("");
  const [markedAttendanceThisSession, setMarkedAttendanceThisSession] = useState<MarkedAttendanceEntry[]>([]);
  const [allMiqaats, setAllMiqaats] = useState<Pick<Miqaat, "id" | "name" | "startTime" | "endTime" | "reportingTime" | "mohallahIds" | "attendance">[]>([]);
  const [isLoadingMiqaats, setIsLoadingMiqaats] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [markerItsId, setMarkerItsId] = useState<string | null>(null);
  const [currentUserMohallahId, setCurrentUserMohallahId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);


  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedMarkerItsId = localStorage.getItem('userItsId');
      setMarkerItsId(storedMarkerItsId);
      const storedUserMohallahId = localStorage.getItem('userMohallahId');
      setCurrentUserMohallahId(storedUserMohallahId);
      const storedUserRole = localStorage.getItem('userRole') as UserRole | null;
      setCurrentUserRole(storedUserRole);
    }
  }, []);

  useEffect(() => {
    setIsLoadingMiqaats(true);
    const unsubscribe = getMiqaats((fetchedMiqaats) => {
      setAllMiqaats(fetchedMiqaats.map(m => ({
        id: m.id,
        name: m.name,
        startTime: m.startTime,
        endTime: m.endTime,
        reportingTime: m.reportingTime,
        mohallahIds: m.mohallahIds || [],
        attendance: m.attendance || [] 
      })));
      setIsLoadingMiqaats(false);
    });
    return () => unsubscribe();
  }, []);

  const availableMiqaatsForUser = useMemo(() => {
    if (isLoadingMiqaats) return [];
    if (currentUserRole === 'superadmin') return allMiqaats;
    if (!currentUserMohallahId) return [];

    return allMiqaats.filter(miqaat => {
      if (!miqaat.mohallahIds || miqaat.mohallahIds.length === 0) {
        return true; 
      }
      return miqaat.mohallahIds.includes(currentUserMohallahId);
    });
  }, [allMiqaats, currentUserMohallahId, currentUserRole, isLoadingMiqaats]);


  const handleMarkAttendance = async () => {
    if (!selectedMiqaatId) {
      toast({ title: "Miqaat Not Selected", description: "Please select a Miqaat before marking attendance.", variant: "destructive" });
      return;
    }
    if (!memberIdInput.trim()) {
      toast({ title: "ITS/BGK ID Required", description: "Please enter the member's ITS or BGK ID.", variant: "destructive" });
      return;
    }
    if (!markerItsId) {
      toast({ title: "Marker ID Error", description: "Your ITS ID (marker) is not available. Please log in again.", variant: "destructive" });
      setIsProcessing(false);
      return;
    }

    setIsProcessing(true);
    let member: User | null = null;
    try {
      member = await getUserByItsOrBgkId(memberIdInput.trim());
    } catch (error) {
      toast({ title: "Database Error", description: "Could not verify member ID.", variant: "destructive" });
      setIsProcessing(false);
      return;
    }

    if (!member) {
      toast({ title: "Member Not Found", description: `No member found with ID: ${memberIdInput} in the database.`, variant: "destructive" });
      setIsProcessing(false);
      return;
    }

    const selectedMiqaatDetails = allMiqaats.find(m => m.id === selectedMiqaatId);
    if (!selectedMiqaatDetails) {
        toast({ title: "Error", description: "Selected Miqaat details not found.", variant: "destructive" });
        setIsProcessing(false);
        return;
    }

    const alreadyMarkedInDb = selectedMiqaatDetails.attendance?.some(
      (entry) => entry.userItsId === member!.itsId
    );

    if (alreadyMarkedInDb) {
      const existingEntry = selectedMiqaatDetails.attendance?.find(entry => entry.userItsId === member!.itsId);
      toast({
        title: "Already Marked",
        description: `${member.name} (${member.itsId}) has already been marked for ${selectedMiqaatDetails.name} (${existingEntry?.status || 'present'}).`,
        variant: "default",
      });
      setMemberIdInput("");
      setIsProcessing(false);
      return;
    }
    
    const now = new Date();
    const miqaatEndTime = new Date(selectedMiqaatDetails.endTime);
    const miqaatReportingTime = selectedMiqaatDetails.reportingTime ? new Date(selectedMiqaatDetails.reportingTime) : null;
    
    const onTimeThreshold = miqaatReportingTime || miqaatEndTime;
    const attendanceStatus = now > onTimeThreshold ? 'late' : 'present';

    const attendanceEntryPayload: MiqaatAttendanceEntryItem = {
        userItsId: member.itsId,
        userName: member.name,
        markedAt: now.toISOString(),
        markedByItsId: markerItsId,
        status: attendanceStatus,
    };

    try {
        await markAttendanceInMiqaat(selectedMiqaatDetails.id, attendanceEntryPayload);

        const newSessionEntry: MarkedAttendanceEntry = {
          memberItsId: member.itsId,
          memberName: member.name,
          timestamp: now,
          miqaatId: selectedMiqaatDetails.id,
          miqaatName: selectedMiqaatDetails.name,
          status: attendanceStatus,
        };
        setMarkedAttendanceThisSession(prev => [newSessionEntry, ...prev]);
        
        setAllMiqaats(prevMiqaats => 
            prevMiqaats.map(m => 
                m.id === selectedMiqaatId 
                ? { ...m, attendance: [...(m.attendance || []), attendanceEntryPayload] } 
                : m
            )
        );

        toast({
          title: `Attendance Marked ${attendanceStatus === 'late' ? '(Late)' : ''}`,
          description: `${member.name} (${member.itsId}) marked ${attendanceStatus} for ${selectedMiqaatDetails.name}.`,
        });
        setMemberIdInput("");
    } catch (dbError) {
        console.error("Failed to save attendance to Miqaat document:", dbError);
        toast({
            title: "Database Error",
            description: "Failed to save attendance record. Please try again.",
            variant: "destructive",
        });
    } finally {
        setIsProcessing(false);
    }
  };

  const currentMiqaatDetails = allMiqaats.find(m => m.id === selectedMiqaatId);
  const currentMiqaatAttendanceCount = currentMiqaatDetails?.attendance?.length || 0;
  const currentSelectedMiqaatName = currentMiqaatDetails?.name || 'Selected Miqaat';
  const currentMiqaatReportingTime = currentMiqaatDetails?.reportingTime 
    ? format(new Date(currentMiqaatDetails.reportingTime), "PPp")
    : null;
  const currentMiqaatEndTime = currentMiqaatDetails?.endTime
    ? format(new Date(currentMiqaatDetails.endTime), "PPp")
    : null;


  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center"><ListChecks className="mr-2 h-6 w-6 text-primary" />Mark Member Attendance</CardTitle>
          <Separator className="my-2" />
          <CardDescription>Select Miqaat, enter member ITS/BGK ID. Attendance marked after Reporting Time (or End Time if no Reporting Time) will be 'Late'.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-1 space-y-2">
              <Label htmlFor="miqaat-select">Select Miqaat</Label>
              <Select
                onValueChange={(value) => {
                  setSelectedMiqaatId(value);
                  setMarkedAttendanceThisSession([]);
                }}
                value={selectedMiqaatId || undefined}
                disabled={isLoadingMiqaats || isProcessing}
              >
                <SelectTrigger id="miqaat-select">
                  <SelectValue placeholder={isLoadingMiqaats ? "Loading Miqaats..." : "Choose a Miqaat"} />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingMiqaats && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                  {!isLoadingMiqaats && availableMiqaatsForUser.length === 0 && <SelectItem value="no-miqaats" disabled>No Miqaats available for your Mohallah</SelectItem>}
                  {availableMiqaatsForUser.map(miqaat => (
                    <SelectItem key={miqaat.id} value={miqaat.id}>
                      {miqaat.name} ({format(new Date(miqaat.startTime), "P")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-1 space-y-2">
              <Label htmlFor="member-id">ITS / BGK ID</Label>
              <Input
                id="member-id"
                placeholder="Enter 8-digit ITS or BGK ID"
                value={memberIdInput}
                onChange={(e) => setMemberIdInput(e.target.value)}
                disabled={!selectedMiqaatId || isProcessing || isLoadingMiqaats}
              />
            </div>
            <Button
              onClick={handleMarkAttendance}
              disabled={!selectedMiqaatId || !memberIdInput || isProcessing || isLoadingMiqaats}
              className="w-full md:w-auto"
              size="sm"
            >
              {isProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
               Mark Attendance
            </Button>
          </div>

          {selectedMiqaatId && currentMiqaatDetails && (
            <div className="mt-6 pt-6 border-t">
                <h3 className="text-lg font-semibold mb-1 flex items-center">
                    <Users className="mr-2 h-5 w-5 text-primary" />
                    Attendance for: {currentSelectedMiqaatName}
                </h3>
                {currentMiqaatReportingTime ? (
                    <p className="text-sm text-muted-foreground mb-1 flex items-center">
                        <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                        Reporting Time (On-time by): {currentMiqaatReportingTime}
                    </p>
                ) : (
                  currentMiqaatEndTime && (
                    <p className="text-sm text-muted-foreground mb-1 flex items-center">
                        <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                        End Time (Marked late after this): {currentMiqaatEndTime}
                    </p>
                  )
                )}
                <p className="text-sm text-muted-foreground mb-1">
                    Total marked in database for this Miqaat: <span className="font-bold text-foreground">{currentMiqaatAttendanceCount}</span>
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                    Marked in this session (local view): <span className="font-bold text-foreground">{markedAttendanceThisSession.filter(entry => entry.miqaatId === selectedMiqaatId).length}</span>
                </p>
                {markedAttendanceThisSession.filter(entry => entry.miqaatId === selectedMiqaatId).length > 0 ? (
                    <div className="max-h-60 overflow-y-auto rounded-md border">
                        <Table>
                            <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>ITS ID</TableHead>
                                <TableHead>Time Marked</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {markedAttendanceThisSession.filter(entry => entry.miqaatId === selectedMiqaatId).map((entry) => (
                                <TableRow key={`${entry.memberItsId}-${entry.timestamp.toISOString()}`}>
                                <TableCell className="font-medium">{entry.memberName}</TableCell>
                                <TableCell>{entry.memberItsId}</TableCell>
                                <TableCell>{format(entry.timestamp, "p")}</TableCell>
                                <TableCell>
                                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                      entry.status === 'late' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    }`}>
                                    {entry.status === 'late' ? 'Late' : 'Present'}
                                  </span>
                                </TableCell>
                                </TableRow>
                            ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No members marked yet for this Miqaat in this session.</p>
                )}
            </div>
          )}
        </CardContent>
        {!selectedMiqaatId && !isLoadingMiqaats && (
            <CardFooter>
                <p className="text-sm text-muted-foreground flex items-center">
                    <AlertCircle className="mr-2 h-4 w-4" /> Please select a Miqaat to begin marking attendance.
                </p>
            </CardFooter>
        )}
         {isLoadingMiqaats && (
            <CardFooter>
                <p className="text-sm text-muted-foreground flex items-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading Miqaats...
                </p>
            </CardFooter>
        )}
      </Card>
    </div>
  );
}
