
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
import { getUserByItsOrBgkId, getUsers } from "@/lib/firebase/userService";
import { getMiqaats, markAttendanceInMiqaat, batchMarkAttendanceInMiqaat } from "@/lib/firebase/miqaatService";
import { savePendingAttendance, getPendingAttendance, clearPendingAttendance, cacheAllUsers, getCachedUserByItsOrBgkId } from "@/lib/offlineService";
import { CheckCircle, AlertCircle, Users, ListChecks, Loader2, Clock, WifiOff, Wifi, CloudUpload, UserSearch } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { Unsubscribe } from "firebase/firestore";
import { format } from "date-fns";
import { Alert, AlertDescription as ShadAlertDesc, AlertTitle as ShadAlertTitle } from "@/components/ui/alert";


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

  // Offline state management
  const [isOffline, setIsOffline] = useState(false);
  const [pendingRecordsCount, setPendingRecordsCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCachingUsers, setIsCachingUsers] = useState(false);

  const { toast } = useToast();

  const checkPendingRecords = useCallback(async () => {
    try {
      const records = await getPendingAttendance();
      setPendingRecordsCount(records.length);
    } catch (error) {
      console.error("Failed to check for pending records:", error);
      toast({ title: "Offline Storage Error", description: "Could not access offline records.", variant: "destructive" });
    }
  }, [toast]);
  
  // Effect for online/offline detection and initial data caching
  useEffect(() => {
    const updateOnlineStatus = () => {
      const online = navigator.onLine;
      setIsOffline(!online);
      if (online) {
        toast({ title: "You are back online!", description: "Ready to sync any pending records." });
        checkPendingRecords();
        // Trigger caching of user data when coming online
        fetchAllUsersForCache();
      } else {
        toast({ title: "You are offline", description: "Attendance will be saved locally and validated against the last known member list.", variant: "destructive", duration: 5000 });
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Initial check
    if (typeof window !== 'undefined') {
      const online = navigator.onLine;
      setIsOffline(!online);
      checkPendingRecords();
      if(online) {
        fetchAllUsersForCache();
      }
    }

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAllUsersForCache = useCallback(async () => {
    if (isCachingUsers) return;
    setIsCachingUsers(true);
    console.log("Starting to cache all users for offline use...");
    try {
      const allUsers = await getUsers();
      await cacheAllUsers(allUsers);
      toast({
        title: "Member List Updated",
        description: `Successfully cached ${allUsers.length} members for offline use.`,
      });
    } catch (error) {
      console.error("Failed to fetch and cache users:", error);
      toast({
        title: "Offline Cache Failed",
        description: "Could not update the local member list.",
        variant: "destructive",
      });
    } finally {
      setIsCachingUsers(false);
    }
  }, [isCachingUsers, toast]);


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
      if (isOffline) {
        // Offline: Validate against local cache
        member = await getCachedUserByItsOrBgkId(memberIdInput.trim());
      } else {
        // Online: Validate against Firestore
        member = await getUserByItsOrBgkId(memberIdInput.trim());
      }
    } catch (error) {
      console.error("Error validating member ID:", error);
      toast({ title: "Validation Error", description: `Could not verify member ID. ${error instanceof Error ? error.message : ''}`, variant: "destructive" });
      setIsProcessing(false);
      return;
    }
    
    if (!member) {
      toast({ title: "Member Not Found", description: `No member found with ID: ${memberIdInput}.`, variant: "destructive" });
      setIsProcessing(false);
      return;
    }
    
    const selectedMiqaatDetails = allMiqaats.find(m => m.id === selectedMiqaatId);
    if (!selectedMiqaatDetails) {
        toast({ title: "Error", description: "Selected Miqaat details not found.", variant: "destructive" });
        setIsProcessing(false);
        return;
    }
    
    const alreadyMarkedInSession = markedAttendanceThisSession.some(
        (entry) => entry.memberItsId === member!.itsId && entry.miqaatId === selectedMiqaatId
    );

    const alreadyMarkedInDb = !isOffline && selectedMiqaatDetails.attendance?.some(
      (entry) => entry.userItsId === member!.itsId
    );
    
    if (alreadyMarkedInDb || alreadyMarkedInSession) {
      const existingEntry = selectedMiqaatDetails.attendance?.find(entry => entry.userItsId === member!.itsId);
      toast({
        title: "Already Marked",
        description: `${member?.name} has already been marked for ${selectedMiqaatDetails.name} ${alreadyMarkedInSession ? 'in this session' : ''} (${existingEntry?.status || 'present'}).`,
        variant: "default",
      });
      setMemberIdInput("");
      setIsProcessing(false);
      return;
    }
    
    const now = new Date();
    const miqaatEndTime = new Date(selectedMiqaatDetails.endTime);
    const miqaatReportingTime = selectedMiqaatDetails.reportingTime ? new Date(selectedMiqaatDetails.reportingTime) : null;
    
    let attendanceStatus: 'early' | 'present' | 'late';
    if (miqaatReportingTime && now < miqaatReportingTime) {
      attendanceStatus = 'early';
    } else if (now > miqaatEndTime) {
      attendanceStatus = 'late';
    } else {
      attendanceStatus = 'present';
    }


    const attendanceEntryPayload: MiqaatAttendanceEntryItem = {
        userItsId: member.itsId,
        userName: member.name,
        markedAt: now.toISOString(),
        markedByItsId: markerItsId,
        status: attendanceStatus,
    };
    
    const newSessionEntry: MarkedAttendanceEntry = {
        memberItsId: attendanceEntryPayload.userItsId,
        memberName: attendanceEntryPayload.userName,
        timestamp: now,
        miqaatId: selectedMiqaatDetails.id,
        miqaatName: selectedMiqaatDetails.name,
        status: attendanceStatus,
    };
    setMarkedAttendanceThisSession(prev => [newSessionEntry, ...prev]);

    try {
        if (isOffline) {
            await savePendingAttendance(selectedMiqaatDetails.id, attendanceEntryPayload);
            await checkPendingRecords();
            toast({
                title: "Saved Offline",
                description: `Attendance for ${attendanceEntryPayload.userName} for ${selectedMiqaatDetails.name} saved locally. Sync when online.`,
            });
        } else {
            await markAttendanceInMiqaat(selectedMiqaatDetails.id, attendanceEntryPayload);
            setAllMiqaats(prevMiqaats => 
                prevMiqaats.map(m => 
                    m.id === selectedMiqaatId 
                    ? { ...m, attendance: [...(m.attendance || []), attendanceEntryPayload] } 
                    : m
                )
            );

            toast({
              title: `Attendance Marked (${attendanceStatus.charAt(0).toUpperCase() + attendanceStatus.slice(1)})`,
              description: `${attendanceEntryPayload.userName} (${attendanceEntryPayload.userItsId}) marked for ${selectedMiqaatDetails.name}.`,
            });
        }
        setMemberIdInput("");
    } catch (dbError) {
        console.error("Failed to save attendance:", dbError);
        toast({
            title: "Database Error",
            description: "Failed to save attendance record. Please try again.",
            variant: "destructive",
        });
        // Remove from session log if db save failed
        setMarkedAttendanceThisSession(prev => prev.filter(p => p.timestamp !== newSessionEntry.timestamp));
    } finally {
        setIsProcessing(false);
    }
  };

  const handleSync = async () => {
    if (isOffline || pendingRecordsCount === 0) {
      toast({ title: "Sync Not Needed", description: isOffline ? "You are offline." : "No pending records to sync." });
      return;
    }
    setIsSyncing(true);
    try {
      const recordsToSync = await getPendingAttendance();
      if (recordsToSync.length === 0) {
        toast({ title: "Nothing to Sync", description: "No pending records were found." });
        setPendingRecordsCount(0);
        setIsSyncing(false);
        return;
      }
      
      const recordsByMiqaat = recordsToSync.reduce((acc, record) => {
        if (!acc[record.miqaatId]) {
          acc[record.miqaatId] = [];
        }
        acc[record.miqaatId].push(record.entry);
        return acc;
      }, {} as { [key: string]: MiqaatAttendanceEntryItem[] });

      // Perform batch writes for each Miqaat
      for (const miqaatId in recordsByMiqaat) {
        await batchMarkAttendanceInMiqaat(miqaatId, recordsByMiqaat[miqaatId]);
      }

      await clearPendingAttendance();
      await checkPendingRecords();
      toast({ title: "Sync Complete", description: `${recordsToSync.length} offline record(s) have been synced successfully.` });
    } catch (error) {
      console.error("Sync failed:", error);
      toast({ title: "Sync Failed", description: "Could not sync all records. Please try again. See console for details.", variant: "destructive" });
    } finally {
      setIsSyncing(false);
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
      { (isOffline || pendingRecordsCount > 0) &&
         <Alert variant={isOffline ? "destructive" : "default"} className="mb-4">
          {isOffline ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
            <ShadAlertTitle>
              {isOffline ? "Offline Mode Active" : "Online with Pending Records"}
            </ShadAlertTitle>
            <ShadAlertDesc className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span>
                {isOffline
                  ? `You are offline. ${pendingRecordsCount > 0 ? `${pendingRecordsCount} record(s) waiting to be synced.` : ''}`
                  : `${pendingRecordsCount} record(s) were saved offline. Please sync them.`
                }
              </span>
              <Button
                  onClick={handleSync}
                  disabled={isOffline || isSyncing || pendingRecordsCount === 0}
                  size="sm"
                  variant="secondary"
                  className="mt-2 sm:mt-0"
              >
                  {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CloudUpload className="mr-2 h-4 w-4" />}
                  {isSyncing ? "Syncing..." : `Sync ${pendingRecordsCount} Record(s)`}
              </Button>
            </ShadAlertDesc>
          </Alert>
      }
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex-grow">
              <CardTitle className="flex items-center"><ListChecks className="mr-2 h-6 w-6 text-primary" />Mark Member Attendance</CardTitle>
              <Separator className="my-2" />
              <CardDescription>Select Miqaat, enter member ITS/BGK ID. Status will be Early, Present, or Late based on Miqaat times.</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAllUsersForCache}
              disabled={isCachingUsers || isOffline}
              className="w-full md:w-auto self-start md:self-center"
            >
              {isCachingUsers ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Caching...
                </>
              ) : (
                <>
                  <UserSearch className="mr-2 h-4 w-4" /> Refresh Offline Cache
                </>
              )}
            </Button>
          </div>
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
                        Reporting Time (Early before): {currentMiqaatReportingTime}
                    </p>
                ) : (
                  currentMiqaatEndTime && (
                    <p className="text-sm text-muted-foreground mb-1 flex items-center">
                        <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                        End Time (Late after): {currentMiqaatEndTime}
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
                                      entry.status === 'late' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : 
                                      entry.status === 'present' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                      'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                    }`}>
                                    {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
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

    