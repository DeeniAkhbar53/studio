
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import type { Miqaat, User, MarkedAttendanceEntry, MiqaatAttendanceEntryItem, UserRole, MiqaatSession } from "@/types";
import { getUserByItsOrBgkId, getUsers } from "@/lib/firebase/userService";
import { getMiqaats, markAttendanceInMiqaat } from "@/lib/firebase/miqaatService";
import { savePendingAttendance, getPendingAttendance, removePendingAttendanceRecord, cacheAllUsers, getCachedUserByItsOrBgkId, OfflineAttendanceRecord } from "@/lib/offlineService";
import { CheckCircle, AlertCircle, Users, ListChecks, Loader2, Clock, WifiOff, Wifi, CloudUpload, UserSearch, CalendarClock, Info, ShieldAlert, CheckSquare, UserX, HandCoins, Trash2, RefreshCw, XCircle, Users2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { format, parse, setHours, setMinutes, setSeconds, startOfDay } from "date-fns";
import { Alert, AlertDescription as ShadAlertDesc, AlertTitle as ShadAlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { allNavItems } from "@/components/dashboard/sidebar-nav";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDesc, AlertDialogFooter as AlertFooter, AlertDialogHeader as AlertHeader, AlertDialogTitle as AlertTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

type UniformComplianceState = {
    fetaPaghri: 'yes' | 'no' | 'safar';
    koti: 'yes' | 'no' | 'safar';
    uniform: 'proper' | 'improper';
    shoes: 'proper' | 'improper';
    nazrulMaqam?: {
      amount: number;
      currency: string;
    }
};

interface FailedSyncRecord {
    record: OfflineAttendanceRecord;
    reason: 'conflict' | 'error';
    errorMessage?: string;
}

// Helper function to safely format time from either a full date string or a time string
const formatTimeValue = (timeValue?: string): string => {
    if (!timeValue) return "N/A";
    
    // Check if it's likely a time string (e.g., "14:30")
    if (/^\d{2}:\d{2}$/.test(timeValue)) {
        try {
            // Use date-fns's parse function to convert time string to a Date object (with today's date)
            const dateFromTime = parse(timeValue, 'HH:mm', new Date());
            return format(dateFromTime, "p"); // format to "2:30 PM"
        } catch {
            return timeValue; // fallback if parsing fails
        }
    }
    
    // Assume it's a full date string
    try {
        const dateObj = new Date(timeValue);
        // Check if the date is valid
        if (isNaN(dateObj.getTime())) {
            return timeValue; // Return original string if date is invalid
        }
        return format(dateObj, "p");
    } catch {
        return timeValue; // fallback for any other error
    }
};


export default function MarkAttendancePage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [selectedMiqaatId, setSelectedMiqaatId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null); // New state for session
  const [memberIdInput, setMemberIdInput] = useState("");
  const [markedAttendanceThisSession, setMarkedAttendanceThisSession] = useState<MarkedAttendanceEntry[]>([]);
  const [allMiqaats, setAllMiqaats] = useState<Pick<Miqaat, "id" | "name" | "startTime" | "endTime" | "reportingTime" | "sessions" | "type" | "mohallahIds" | "teams" | "eligibleItsIds" | "attendance" | "safarList" | "attendanceRequirements">[]>([]);
  const [isLoadingMiqaats, setIsLoadingMiqaats] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [markerItsId, setMarkerItsId] = useState<string | null>(null);
  const [currentUserMohallahId, setCurrentUserMohallahId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [miqaatTypeFilter, setMiqaatTypeFilter] = useState<'local' | 'international'>('local');


  // State for uniform check dialog
  const [isComplianceDialogOpen, setIsComplianceDialogOpen] = useState(false);
  const [memberForComplianceCheck, setMemberForComplianceCheck] = useState<User | null>(null);
  const [complianceState, setComplianceState] = useState<UniformComplianceState>({ fetaPaghri: 'no', koti: 'no', uniform: 'improper', shoes: 'improper' });
  const [nazrulMaqamAmount, setNazrulMaqamAmount] = useState("");
  const [nazrulMaqamCurrency, setNazrulMaqamCurrency] = useState("USD");


  // Offline and Sync state management
  const [isOffline, setIsOffline] = useState(false);
  const [pendingRecordsCount, setPendingRecordsCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCachingUsers, setIsCachingUsers] = useState(false);
  const [isCacheOutOfSync, setIsCacheOutOfSync] = useState(false);
  const [failedSyncs, setFailedSyncs] = useState<FailedSyncRecord[]>([]);
  const [isSyncReportOpen, setIsSyncReportOpen] = useState(false);
  const [lastSyncReport, setLastSyncReport] = useState<{ success: number; skipped: number; failed: number } | null>(null);

  // Bulk Attendance State
  const [bulkMemberIdsInput, setBulkMemberIdsInput] = useState("");
  const [bulkFoundMembers, setBulkFoundMembers] = useState<User[]>([]);
  const [bulkComplianceState, setBulkComplianceState] = useState<Map<string, Partial<UniformComplianceState>>>(new Map());
  const [isSearchingBulkMembers, setIsSearchingBulkMembers] = useState(false);
  const [bulkMarkingError, setBulkMarkingError] = useState<string | null>(null);


  const { toast } = useToast();

   useEffect(() => {
    const role = typeof window !== "undefined" ? localStorage.getItem('userRole') as UserRole : null;
    const pageRightsRaw = typeof window !== "undefined" ? localStorage.getItem('userPageRights') : '[]';
    const pageRights = JSON.parse(pageRightsRaw || '[]');
    const navItem = allNavItems.find(item => item.href === '/dashboard/mark-attendance');
    
    if (navItem) {
      const hasRoleAccess = navItem.allowedRoles?.includes(role || 'user');
      const hasPageRight = pageRights.includes(navItem.href);
      
      if (hasRoleAccess || hasPageRight) {
        setIsAuthorized(true);
      } else {
        setIsAuthorized(false);
        // Redirect after a short delay to show the message
        setTimeout(() => router.replace('/dashboard'), 2000);
      }
    } else {
       setIsAuthorized(false);
       setTimeout(() => router.replace('/dashboard'), 2000);
    }
  }, [router]);

  const checkPendingRecords = useCallback(async () => {
    try {
      const records = await getPendingAttendance();
      setPendingRecordsCount(records.length);
    } catch (error) {
      console.error("Failed to check for pending records:", error);
      toast({ title: "Offline Storage Error", description: "Could not access offline records.", variant: "destructive" });
    }
  }, [toast]);
  
  const fetchAllUsersForCache = useCallback(async () => {
    if (isCachingUsers) return;
    const miqaatIdForCache = selectedMiqaatId;
    if (!miqaatIdForCache) {
      toast({ title: "Select a Miqaat First", description: "Please select a Miqaat before refreshing the member list.", variant: "destructive" });
      return;
    }

    setIsCachingUsers(true);
    toast({ title: "Caching Started", description: "Updating the local member list for offline use..." });

    try {
        const miqaatDetails = allMiqaats.find(m => m.id === miqaatIdForCache);
        if (!miqaatDetails) {
            throw new Error("Selected Miqaat details not found.");
        }

        let usersToCache: User[];

        if (miqaatDetails.type === 'international') {
            const allSystemUsers = await getUsers();
            const isForEveryone = !miqaatDetails.mohallahIds?.length && !miqaatDetails.teams?.length && !miqaatDetails.eligibleItsIds?.length;

            if (isForEveryone) {
                // If it's for everyone, cache only the current user's mohallah to prevent huge downloads
                 if (currentUserMohallahId) {
                    usersToCache = await getUsers(currentUserMohallahId);
                } else {
                    toast({ title: "Cache Warning", description: "Cannot cache all system members for a public Miqaat without a Mohallah context. Caching empty list.", variant: "default" });
                    usersToCache = [];
                }
            } else {
                // Filter down to only eligible members for the international miqaat
                usersToCache = allSystemUsers.filter(user => {
                    const eligibleById = !!miqaatDetails.eligibleItsIds?.includes(user.itsId);
                    const eligibleByTeam = !!user.team && !!miqaatDetails.teams?.includes(user.team);
                    const eligibleByMohallah = !!user.mohallahId && !!miqaatDetails.mohallahIds?.includes(user.mohallahId);
                    return eligibleById || eligibleByTeam || eligibleByMohallah;
                });
            }
        } else { // 'local' miqaat
            if (currentUserMohallahId) {
                // For local miqaats, only fetch users from the marker's own mohallah
                usersToCache = await getUsers(currentUserMohallahId);
            } else {
                toast({ title: "Cache Error", description: "Cannot cache local miqaat members without a Mohallah assignment.", variant: "destructive" });
                usersToCache = [];
            }
        }

        await cacheAllUsers(usersToCache);
        localStorage.setItem('cachedMiqaatId', miqaatIdForCache);
        setIsCacheOutOfSync(false); // Cache is now in sync
        toast({
            title: "Member List Updated",
            description: `Successfully cached ${usersToCache.length} members for ${miqaatDetails.name}.`,
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
  }, [isCachingUsers, toast, selectedMiqaatId, allMiqaats, currentUserMohallahId]);


  // Effect for online/offline detection and initial data caching
  useEffect(() => {
    if (!isAuthorized) return;
    const updateOnlineStatus = () => {
      const online = navigator.onLine;
      setIsOffline(!online);
      if (online) {
        toast({ title: "You are back online!", description: "Ready to sync any pending records." });
        checkPendingRecords();
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
    }

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorized]);
  
  useEffect(() => {
      if (selectedMiqaatId) {
          const cachedForId = localStorage.getItem('cachedMiqaatId');
          if (cachedForId !== selectedMiqaatId) {
              setIsCacheOutOfSync(true);
          } else {
              setIsCacheOutOfSync(false);
          }
      } else {
          setIsCacheOutOfSync(false);
      }
  }, [selectedMiqaatId]);


  useEffect(() => {
    if (!isAuthorized) return;
    if (typeof window !== "undefined") {
      const storedMarkerItsId = localStorage.getItem('userItsId');
      setMarkerItsId(storedMarkerItsId);
      const storedUserMohallahId = localStorage.getItem('userMohallahId');
      setCurrentUserMohallahId(storedUserMohallahId);
      const storedUserRole = localStorage.getItem('userRole') as UserRole | null;
      setCurrentUserRole(storedUserRole);
    }
  }, [isAuthorized]);

  useEffect(() => {
    if (!isAuthorized) return;
    setIsLoadingMiqaats(true);
    const unsubscribe = getMiqaats((fetchedMiqaats) => {
      setAllMiqaats(fetchedMiqaats.map(m => ({
        id: m.id,
        name: m.name,
        type: m.type,
        sessions: m.sessions || [],
        startTime: m.startTime,
        endTime: m.endTime,
        reportingTime: m.reportingTime,
        mohallahIds: m.mohallahIds || [],
        teams: m.teams || [],
        eligibleItsIds: m.eligibleItsIds || [],
        attendance: m.attendance || [],
        safarList: m.safarList || [],
        attendanceRequirements: m.attendanceRequirements || { fetaPaghri: false, koti: false, uniform: false, shoes: false, nazrulMaqam: false },
      })));
      setIsLoadingMiqaats(false);
    });
    return () => unsubscribe();
  }, [isAuthorized]);

  const availableMiqaatsForUser = useMemo(() => {
    if (isLoadingMiqaats) return [];
    
    let baseFiltered = allMiqaats.filter(miqaat => miqaat.type === miqaatTypeFilter);
    
    if (currentUserRole === 'superadmin') return baseFiltered;
    if (!currentUserMohallahId) return [];

    return baseFiltered.filter(miqaat => {
      if (miqaat.eligibleItsIds && miqaat.eligibleItsIds.length > 0) {
        return true; 
      }
      if (!miqaat.mohallahIds || miqaat.mohallahIds.length === 0) {
        return true; 
      }
      return miqaat.mohallahIds.includes(currentUserMohallahId);
    });
  }, [allMiqaats, currentUserMohallahId, currentUserRole, isLoadingMiqaats, miqaatTypeFilter]);


  const handleFindMember = async () => {
    if (!selectedMiqaatId) {
      toast({ title: "Miqaat Not Selected", description: "Please select a Miqaat before marking attendance.", variant: "destructive" });
      return;
    }
    const selectedMiqaatDetails = allMiqaats.find(m => m.id === selectedMiqaatId);
    if (!selectedMiqaatDetails) return;
    if (selectedMiqaatDetails.type === 'international' && !selectedSessionId) {
        toast({ title: "Session Not Selected", description: "Please select a session for this international Miqaat.", variant: "destructive" });
        return;
    }
    
    if (!memberIdInput.trim()) {
      toast({ title: "ITS/BGK ID Required", description: "Please enter the member's ITS or BGK ID.", variant: "destructive" });
      return;
    }
    
    const currentSession = selectedMiqaatDetails.type === 'international'
        ? selectedMiqaatDetails.sessions?.find(s => s.id === selectedSessionId)
        : selectedMiqaatDetails.sessions?.[0]; // For local miqaat, default to first (main) session
        
    if (!currentSession) {
        toast({ title: "Error", description: "Selected session details not found.", variant: "destructive" });
        return;
    }

    const now = new Date();
    
    // Construct full date-time for validation
    let sessionStartTime: Date;
    let sessionEndTime: Date;

    if (selectedMiqaatDetails.type === 'local') {
      sessionStartTime = new Date(currentSession.startTime);
      sessionEndTime = new Date(currentSession.endTime);
    } else { // international
      const [startHour, startMinute] = currentSession.startTime.split(':').map(Number);
      const [endHour, endMinute] = currentSession.endTime.split(':').map(Number);
      
      const miqaatStartDate = startOfDay(new Date(selectedMiqaatDetails.startTime));
      const sessionDate = new Date(miqaatStartDate.setDate(miqaatStartDate.getDate() + (currentSession.day - 1)));
      
      sessionStartTime = setSeconds(setMinutes(setHours(sessionDate, startHour), startMinute), 0);
      sessionEndTime = setSeconds(setMinutes(setHours(sessionDate, endHour), endMinute), 0);
    }


    if (now < sessionStartTime) {
        toast({
            variant: "destructive",
            title: "Session Has Not Started",
            description: `This session has not started yet. Starts at ${format(sessionStartTime, "PPp")}.`,
        });
        return;
    }

    if (now > sessionEndTime) {
        toast({ title: "Session has ended", description: "This session is closed and no longer accepting attendance.", variant: "destructive" });
        return;
    }


    setIsProcessing(true);
    let member: User | null = null;

    try {
      if (isOffline) {
        member = await getCachedUserByItsOrBgkId(memberIdInput.trim());
      } else {
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

    const isMiqaatForEveryone = 
        (!selectedMiqaatDetails.mohallahIds || selectedMiqaatDetails.mohallahIds.length === 0) &&
        (!selectedMiqaatDetails.teams || selectedMiqaatDetails.teams.length === 0) &&
        (!selectedMiqaatDetails.eligibleItsIds || selectedMiqaatDetails.eligibleItsIds.length === 0);

    if (!isMiqaatForEveryone) {
        let isEligible = false;
        const eligibleById = !!selectedMiqaatDetails.eligibleItsIds?.includes(member.itsId);
        const eligibleByTeam = !!member.team && !!selectedMiqaatDetails.teams?.includes(member.team);
        const eligibleByMohallah = !!member.mohallahId && !!selectedMiqaatDetails.mohallahIds?.includes(member.mohallahId);

        if (selectedMiqaatDetails.eligibleItsIds && selectedMiqaatDetails.eligibleItsIds.length > 0) {
            isEligible = eligibleById;
        } else {
            isEligible = eligibleByMohallah || eligibleByTeam;
        }
        
        if (!isEligible) {
            toast({
                title: "Not Eligible",
                description: `${member.name} (${member.itsId}) is not eligible for this Miqaat.`,
                variant: "destructive",
                duration: 7000,
            });
            setMemberIdInput("");
            setIsProcessing(false);
            return;
        }
    }
    
    const alreadyMarkedInSession = markedAttendanceThisSession.some(
        (entry) => entry.memberItsId === member!.itsId && entry.miqaatId === selectedMiqaatId && entry.sessionId === selectedSessionId
    );
    const alreadyMarkedInDb = !isOffline && selectedMiqaatDetails.attendance?.some(
      (entry) => entry.userItsId === member!.itsId && entry.sessionId === currentSession.id
    );
    
    if (alreadyMarkedInDb || alreadyMarkedInSession) {
      const existingEntry = selectedMiqaatDetails.attendance?.find(entry => entry.userItsId === member!.itsId && entry.sessionId === currentSession.id);
      toast({
        title: "Already Marked for Session",
        description: `${member?.name} has already been marked for ${currentSession.name} (${existingEntry?.status || 'present'}).`,
        className: 'border-blue-500 bg-blue-50 dark:bg-blue-900/30',
      });
      setMemberIdInput("");
      setIsProcessing(false);
      return;
    }
    
    const reqs = selectedMiqaatDetails.attendanceRequirements;
    if (reqs && (reqs.fetaPaghri || reqs.koti || reqs.uniform || reqs.shoes || reqs.nazrulMaqam)) {
      setComplianceState({ fetaPaghri: 'no', koti: 'no', uniform: 'improper', shoes: 'improper' });
      setNazrulMaqamAmount("");
      setNazrulMaqamCurrency("USD");
      setMemberForComplianceCheck(member);
      setIsComplianceDialogOpen(true);
      // Keep isProcessing true until final action
    } else {
      finalizeAttendance(member);
    }
  };
  
  const finalizeAttendance = async (member: User, compliance?: UniformComplianceState) => {
    setIsSaving(true);
    const miqaatId = selectedMiqaatId;
    if (!miqaatId || !markerItsId) {
        toast({ title: "Error", description: "Miqaat or Marker ID missing.", variant: "destructive" });
        setIsSaving(false);
        setIsProcessing(false);
        return;
    }
    
    const selectedMiqaatDetails = allMiqaats.find(m => m.id === miqaatId);
    if (!selectedMiqaatDetails) {
        setIsSaving(false);
        setIsProcessing(false);
        return;
    }

    const currentSession = selectedMiqaatDetails.type === 'international' 
        ? selectedMiqaatDetails.sessions?.find(s => s.id === selectedSessionId) 
        : selectedMiqaatDetails.sessions?.[0]; // Local Miqaat

    if (!currentSession) {
        toast({ title: "Error", description: "Could not determine the current session.", variant: "destructive" });
        setIsSaving(false);
        setIsProcessing(false);
        return;
    }

    const now = new Date();
    
    // Re-construct full session times for status calculation
    let sessionStartTime: Date;
    let sessionEndTime: Date;
    let sessionReportingTime: Date;

    if (selectedMiqaatDetails.type === 'local') {
      sessionStartTime = new Date(currentSession.startTime);
      sessionEndTime = new Date(currentSession.endTime);
      sessionReportingTime = currentSession.reportingTime ? new Date(currentSession.reportingTime) : sessionStartTime;
    } else {
      const [startHour, startMinute] = currentSession.startTime.split(':').map(Number);
      const [endHour, endMinute] = currentSession.endTime.split(':').map(Number);
      
      const miqaatStartDate = startOfDay(new Date(selectedMiqaatDetails.startTime));
      const sessionDate = new Date(miqaatStartDate.setDate(miqaatStartDate.getDate() + (currentSession.day - 1)));
      
      sessionStartTime = setSeconds(setMinutes(setHours(sessionDate, startHour), startMinute), 0);
      sessionEndTime = setSeconds(setMinutes(setHours(sessionDate, endHour), endMinute), 0);
      
      if (currentSession.reportingTime) {
        const [reportHour, reportMinute] = currentSession.reportingTime.split(':').map(Number);
        sessionReportingTime = setSeconds(setMinutes(setHours(sessionDate, reportHour), reportMinute), 0);
      } else {
        sessionReportingTime = sessionStartTime;
      }
    }
    
    let attendanceStatus: 'early' | 'present' | 'late';
    if (now < sessionReportingTime) {
      attendanceStatus = 'early';
    } else if (now > sessionEndTime) {
      attendanceStatus = 'late';
    } else {
      attendanceStatus = 'present';
    }
    
    const attendanceEntryPayload: MiqaatAttendanceEntryItem = {
        userItsId: member.itsId,
        userName: member.name,
        sessionId: currentSession.id,
        markedAt: now.toISOString(),
        markedByItsId: markerItsId,
        status: attendanceStatus,
        uniformCompliance: compliance,
    };
    
    const newSessionEntry: MarkedAttendanceEntry = {
        memberItsId: attendanceEntryPayload.userItsId,
        memberName: attendanceEntryPayload.userName,
        timestamp: now,
        miqaatId: selectedMiqaatDetails.id,
        miqaatName: selectedMiqaatDetails.name,
        sessionId: currentSession.id,
        sessionName: currentSession.name,
        status: attendanceStatus,
    };
    
    try {
        if (isOffline) {
            await savePendingAttendance(selectedMiqaatDetails.id, attendanceEntryPayload);
            await checkPendingRecords();
             setMarkedAttendanceThisSession(prev => [newSessionEntry, ...prev]);
            toast({
                title: "Saved Offline",
                description: `Attendance for ${attendanceEntryPayload.userName} for session ${currentSession.name} saved locally.`,
            });
        } else {
            await markAttendanceInMiqaat(selectedMiqaatDetails.id, attendanceEntryPayload);
            setMarkedAttendanceThisSession(prev => [newSessionEntry, ...prev]);
            toast({
              title: `Attendance Marked (${attendanceStatus.charAt(0).toUpperCase() + attendanceStatus.slice(1)})`,
              description: `${attendanceEntryPayload.userName} for ${currentSession.name}.`,
              className: 'border-green-500 bg-green-50 dark:bg-green-900/30',
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
        setMarkedAttendanceThisSession(prev => prev.filter(p => p.timestamp !== newSessionEntry.timestamp));
    } finally {
        setIsComplianceDialogOpen(false);
        setMemberForComplianceCheck(null);
        setIsSaving(false);
        setIsProcessing(false);
    }
  };

  const handleSync = async (retryingRecord?: FailedSyncRecord) => {
    if (isOffline) {
      toast({ title: "Sync Not Possible", description: "You are offline. Cannot connect to the server." });
      return;
    }
    if (pendingRecordsCount === 0 && !retryingRecord) {
      toast({ title: "Sync Not Needed", description: "No pending records to sync." });
      return;
    }

    setIsSyncing(true);
    let recordsToProcess: OfflineAttendanceRecord[];

    if (retryingRecord) {
        recordsToProcess = [retryingRecord.record];
    } else {
        recordsToProcess = await getPendingAttendance();
    }

    if (recordsToProcess.length === 0) {
        toast({ title: "Nothing to Sync", description: "No records found to sync." });
        setIsSyncing(false);
        return;
    }
    
    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const newlyFailedSyncs: FailedSyncRecord[] = [];

    for (const record of recordsToProcess) {
        try {
            await markAttendanceInMiqaat(record.miqaatId, record.entry);
            if (record.id) {
                await removePendingAttendanceRecord(record.id);
            }
            successCount++;
        } catch (error: any) {
             if (error.message.includes("already marked")) {
                skippedCount++;
                 if (record.id) {
                    await removePendingAttendanceRecord(record.id);
                }
            } else {
                failedCount++;
                newlyFailedSyncs.push({ record, reason: 'error', errorMessage: error.message });
            }
        }
    }

    setLastSyncReport({ success: successCount, skipped: skippedCount, failed: failedCount });
    setIsSyncReportOpen(true);
    
    if (retryingRecord) {
      setFailedSyncs(prev => prev.filter(f => f.record.syncAttemptId !== retryingRecord.record.syncAttemptId));
    } else {
      setFailedSyncs(newlyFailedSyncs);
    }

    await checkPendingRecords();
    setIsSyncing(false);
  };

   const handleDiscardFailedRecord = async (recordId: number, syncAttemptId: string) => {
        try {
            await removePendingAttendanceRecord(recordId);
            setFailedSyncs(prev => prev.filter(f => f.record.syncAttemptId !== syncAttemptId));
            toast({
                title: "Record Discarded",
                description: "The failed sync record has been removed from the queue.",
                variant: "destructive"
            });
        } catch (error) {
            toast({ title: "Error", description: "Could not discard the record.", variant: "destructive" });
        }
    };
  
  const currentMiqaatDetails = allMiqaats.find(m => m.id === selectedMiqaatId);
  const currentSessionDetails = currentMiqaatDetails?.type === 'international' 
    ? currentMiqaatDetails.sessions?.find(s => s.id === selectedSessionId)
    : currentMiqaatDetails?.sessions?.[0]; // local miqaat
  
  const currentMiqaatAttendanceCount = currentMiqaatDetails?.attendance?.filter(a => a.sessionId === currentSessionDetails?.id).length || 0;
  const currentSelectedMiqaatName = currentMiqaatDetails?.name || 'Selected Miqaat';

  const availableDays = useMemo(() => {
    if (!currentMiqaatDetails || currentMiqaatDetails.type !== 'international') return [];
    const days = [...new Set(currentMiqaatDetails.sessions?.map(s => s.day))].sort((a, b) => a - b);
    return days;
  }, [currentMiqaatDetails]);
  
  // Auto-select day 1 if it's a single-day international event
  useEffect(() => {
    if (currentMiqaatDetails?.type === 'international' && availableDays.length === 1) {
      setSelectedDay(availableDays[0]);
    }
  }, [currentMiqaatDetails, availableDays]);

  const availableSessionsForDay = useMemo(() => {
    if (!currentMiqaatDetails || !selectedDay) return [];
    return currentMiqaatDetails.sessions?.filter(s => s.day === selectedDay) || [];
  }, [currentMiqaatDetails, selectedDay]);

   // Auto-select session if there's only one for the selected day
    useEffect(() => {
        if (availableSessionsForDay.length === 1) {
            setSelectedSessionId(availableSessionsForDay[0].id);
        }
    }, [availableSessionsForDay]);
  
  const miqaatHasAttendanceRequirements = useMemo(() => {
    if (!currentMiqaatDetails || !currentMiqaatDetails.attendanceRequirements) return false;
    const { fetaPaghri, koti, uniform, shoes, nazrulMaqam } = currentMiqaatDetails.attendanceRequirements;
    return fetaPaghri || koti || uniform || shoes || nazrulMaqam;
  }, [currentMiqaatDetails]);
  
  const handleBulkMemberSearch = async () => {
    if (!selectedMiqaatId || !currentSessionDetails) {
        toast({ title: "Selection Required", description: "Please select a Miqaat and session first.", variant: "destructive" });
        return;
    }
    if (!bulkMemberIdsInput.trim()) {
        toast({ title: "Input Required", description: "Please paste ITS or BGK IDs to search.", variant: "destructive" });
        return;
    }
    
    setIsSearchingBulkMembers(true);
    setBulkFoundMembers([]);
    setBulkComplianceState(new Map());
    setBulkMarkingError(null);

    const ids = bulkMemberIdsInput.split(/[\s,;\n]+/).map(id => id.trim()).filter(Boolean);
    const uniqueIds = [...new Set(ids)];

    const foundMembers: User[] = [];
    const notFoundIds: string[] = [];

    for (const id of uniqueIds) {
        try {
            const member = isOffline ? await getCachedUserByItsOrBgkId(id) : await getUserByItsOrBgkId(id);
            if (member) {
                foundMembers.push(member);
            } else {
                notFoundIds.push(id);
            }
        } catch (error) {
            console.error(`Error finding member with ID ${id}:`, error);
            notFoundIds.push(id);
        }
    }
    
    if (notFoundIds.length > 0) {
        setBulkMarkingError(`Could not find members for the following IDs: ${notFoundIds.join(', ')}.`);
    }

    const initialCompliance = new Map<string, Partial<UniformComplianceState>>();
    foundMembers.forEach(member => {
        initialCompliance.set(member.itsId, { fetaPaghri: 'no', koti: 'no', uniform: 'improper', shoes: 'improper' });
    });

    setBulkFoundMembers(foundMembers);
    setBulkComplianceState(initialCompliance);
    setIsSearchingBulkMembers(false);
  };
  
    const handleBulkComplianceChange = (itsId: string, field: keyof UniformComplianceState, value: any) => {
        setBulkComplianceState(prev => {
            const newState = new Map(prev);
            const userState = newState.get(itsId) || {};
            newState.set(itsId, { ...userState, [field]: value });
            return newState;
        });
    };
    
    const handleApplyAllCompliance = (field: keyof UniformComplianceState, value: any) => {
        setBulkComplianceState(prev => {
            const newState = new Map();
            bulkFoundMembers.forEach(member => {
                const userState = prev.get(member.itsId) || {};
                newState.set(member.itsId, { ...userState, [field]: value });
            });
            return newState;
        });
    };

    const handleBulkMarkAttendance = async () => {
        if (bulkFoundMembers.length === 0 || !currentSessionDetails) return;

        setIsSaving(true);
        let successCount = 0;
        let failedCount = 0;

        for (const member of bulkFoundMembers) {
            try {
                // Ensure there is compliance data for the member
                const complianceData = bulkComplianceState.get(member.itsId);
                await finalizeAttendance(member, complianceData as UniformComplianceState);
                successCount++;
            } catch (error) {
                console.error(`Failed to mark attendance for ${member.name}:`, error);
                failedCount++;
            }
        }

        toast({
            title: "Bulk Marking Complete",
            description: `Successfully marked ${successCount} members. Failed to mark ${failedCount}.`,
            variant: failedCount > 0 ? "destructive" : "default"
        });

        // Reset bulk state after completion
        setBulkMemberIdsInput("");
        setBulkFoundMembers([]);
        setBulkComplianceState(new Map());
        setBulkMarkingError(null);
        setIsSaving(false);
    };

  if (isAuthorized === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
       <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
        <p className="text-muted-foreground mt-2">
          You do not have the required permissions to view this page.
        </p>
        <p className="text-sm text-muted-foreground mt-1">Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
       {isCacheOutOfSync && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <ShadAlertTitle>Cache Mismatch</ShadAlertTitle>
          <ShadAlertDesc className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            The offline member list may be incorrect for this Miqaat.
            <Button variant="destructive" size="sm" onClick={fetchAllUsersForCache} disabled={isCachingUsers}>
              {isCachingUsers ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Update Offline List
            </Button>
          </ShadAlertDesc>
        </Alert>
      )}
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
                  onClick={() => handleSync()}
                  disabled={isOffline || isSyncing || pendingRecordsCount === 0}
                  size="sm"
                  variant="secondary"
                  className="mt-2 sm:mt-0"
              >
                  {isSyncing ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Syncing...</>
                  ) : (
                    <><CloudUpload className="mr-2 h-4 w-4" /> Sync {pendingRecordsCount} Record(s)</>
                  )}
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
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Caching...</>
              ) : (
                <><UserSearch className="mr-2 h-4 w-4" /> Refresh Offline Members</>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
           <RadioGroup 
                value={miqaatTypeFilter} 
                onValueChange={(value) => {
                    setMiqaatTypeFilter(value as 'local' | 'international');
                    setSelectedMiqaatId(null);
                    setSelectedDay(null);
                    setSelectedSessionId(null);
                }} 
                className="flex items-center space-x-4"
            >
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="local" id="local-filter" />
                    <Label htmlFor="local-filter">Local</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="international" id="international-filter" />
                    <Label htmlFor="international-filter">International</Label>
                </div>
            </RadioGroup>
            
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div className="space-y-2 lg:col-span-1">
              <Label htmlFor="miqaat-select">Select Miqaat</Label>
              <Select
                onValueChange={(value) => {
                  setSelectedMiqaatId(value);
                  const miqaat = allMiqaats.find(m => m.id === value);
                  if (miqaat?.type === 'local') {
                      setSelectedDay(1); // Default for local
                      setSelectedSessionId(miqaat.sessions?.[0]?.id || null);
                  } else {
                      // For international, check if it's a single day event
                      const days = [...new Set(miqaat?.sessions?.map(s => s.day))];
                      if (days.length === 1) {
                          setSelectedDay(days[0]);
                      } else {
                          setSelectedDay(null);
                      }
                      setSelectedSessionId(null);
                  }
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
                  {!isLoadingMiqaats && availableMiqaatsForUser.length === 0 && <SelectItem value="no-miqaats" disabled>No Miqaats available</SelectItem>}
                  {availableMiqaatsForUser.map(miqaat => (
                    <SelectItem key={miqaat.id} value={miqaat.id}>
                      {miqaat.name} ({format(new Date(miqaat.startTime), "P")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {currentMiqaatDetails && currentMiqaatDetails.type === 'international' && availableDays.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="day-select">Select Day</Label>
                <Select
                  onValueChange={(value) => {
                    setSelectedDay(Number(value));
                    setSelectedSessionId(null);
                  }}
                  value={selectedDay?.toString() || undefined}
                  disabled={!selectedMiqaatId || isProcessing}
                >
                  <SelectTrigger id="day-select">
                    <SelectValue placeholder="Choose a day" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDays.map(day => (
                      <SelectItem key={day} value={day.toString()}>Day {day}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {currentMiqaatDetails?.type === 'international' && availableSessionsForDay.length > 1 && (
              <div className="space-y-2">
                  <Label htmlFor="session-select">Select Session</Label>
                  <Select
                      onValueChange={(value) => setSelectedSessionId(value)}
                      value={selectedSessionId || undefined}
                      disabled={!selectedDay || isProcessing || availableSessionsForDay.length === 0}
                  >
                      <SelectTrigger id="session-select">
                          <SelectValue placeholder={!selectedDay ? "Select a day first" : "Choose a session"} />
                      </SelectTrigger>
                      <SelectContent>
                          {availableSessionsForDay.length > 0 ? (
                              availableSessionsForDay.map(session => (
                                  <SelectItem key={session.id} value={session.id}>
                                      {session.name}
                                  </SelectItem>
                              ))
                          ) : (
                              <SelectItem value="no-sessions" disabled>No sessions for this day</SelectItem>
                          )}
                      </SelectContent>
                  </Select>
              </div>
            )}


            {currentSessionDetails && (
              <Card className="bg-muted/50 lg:col-span-3">
                <CardHeader className="p-4">
                  <CardTitle className="text-base flex items-center gap-2">
                     <CalendarClock className="h-5 w-5 text-primary" />
                     Session Timing: {currentSessionDetails.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 text-sm space-y-1">
                  <p className="flex items-center gap-2">
                    <span className="font-semibold w-24">Early Before:</span>
                    <span className="text-muted-foreground">{formatTimeValue(currentSessionDetails.reportingTime || currentSessionDetails.startTime)}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="font-semibold w-24">Late After:</span>
                    <span className="text-muted-foreground">{formatTimeValue(currentSessionDetails.endTime)}</span>
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
          
          <form onSubmit={(e) => { e.preventDefault(); handleFindMember(); }} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="member-id">ITS / BGK ID</Label>
              <Input
                id="member-id"
                placeholder="Enter 8-digit ITS or BGK ID"
                value={memberIdInput}
                onChange={(e) => setMemberIdInput(e.target.value)}
                disabled={!selectedMiqaatId || !currentSessionDetails || isProcessing || isLoadingMiqaats}
              />
            </div>
            <Button
              type="submit"
              disabled={!selectedMiqaatId || !currentSessionDetails || !memberIdInput || isProcessing || isLoadingMiqaats}
              className="w-full"
              size="sm"
            >
              {isProcessing ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
              ) : (
                <>
                  <UserSearch className="mr-2 h-4 w-4" />
                  {miqaatHasAttendanceRequirements ? "Find & Check" : "Mark Attendance"}
                </>
              )}
            </Button>
          </form>

          {selectedMiqaatId && currentSessionDetails && (
            <div className="mt-6 pt-6 border-t">
                <h3 className="text-lg font-semibold mb-2 flex items-center">
                    <Users className="mr-2 h-5 w-5 text-primary" />
                    Session Log for: {currentSessionDetails?.name || currentSelectedMiqaatName}
                </h3>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground mb-4">
                  <p>Total in this Session: <span className="font-bold text-foreground">{currentMiqaatAttendanceCount}</span></p>
                  <p>Marked this session: <span className="font-bold text-foreground">{markedAttendanceThisSession.filter(entry => entry.sessionId === currentSessionDetails?.id).length}</span></p>
                </div>
                {markedAttendanceThisSession.filter(entry => entry.sessionId === currentSessionDetails?.id).length > 0 ? (
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
                            {markedAttendanceThisSession.filter(entry => entry.sessionId === currentSessionDetails?.id).map((entry) => (
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
                    <div className="text-sm text-muted-foreground text-center py-6 border rounded-lg bg-muted/20 flex flex-col items-center justify-center">
                        <Info className="h-6 w-6 text-muted-foreground mb-2"/>
                        <p>No members marked yet for this session.</p>
                        <p>Entries will appear here as you mark them.</p>
                    </div>
                )}
            </div>
          )}
        </CardContent>
        {!selectedMiqaatId && !isLoadingMiqaats && (
            <CardFooter>
                <div className="text-sm text-muted-foreground flex items-center">
                    <AlertCircle className="mr-2 h-4 w-4" /> Please select a Miqaat to begin marking attendance.
                </div>
            </CardFooter>
        )}
         {isLoadingMiqaats && (
            <CardFooter>
                <div className="text-sm text-muted-foreground flex items-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading Miqaats...
                </div>
            </CardFooter>
        )}
      </Card>
      
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center"><Users2 className="mr-2 h-6 w-6 text-primary" />Bulk Attendance</CardTitle>
                <CardDescription>Paste a list of ITS or BGK IDs (separated by comma, space, or new line) to mark attendance for multiple members at once.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="space-y-2">
                    <Label htmlFor="bulk-member-ids">Member IDs</Label>
                    <Textarea
                        id="bulk-member-ids"
                        placeholder="52000001, 52000002&#10;52000003"
                        value={bulkMemberIdsInput}
                        onChange={(e) => setBulkMemberIdsInput(e.target.value)}
                        disabled={!selectedMiqaatId || !currentSessionDetails || isSearchingBulkMembers || isSaving}
                        rows={4}
                    />
                </div>
                <Button onClick={handleBulkMemberSearch} disabled={!selectedMiqaatId || !currentSessionDetails || !bulkMemberIdsInput || isSearchingBulkMembers || isSaving}>
                    {isSearchingBulkMembers ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserSearch className="mr-2 h-4 w-4" />}
                    Find Members
                </Button>
                {bulkMarkingError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><ShadAlertTitle>Error</ShadAlertTitle><ShadAlertDesc>{bulkMarkingError}</ShadAlertDesc></Alert>}
                
                {bulkFoundMembers.length > 0 && (
                    <div className="space-y-4 pt-4">
                        <h4 className="font-semibold">Found {bulkFoundMembers.length} Members</h4>
                         <div className="max-h-80 overflow-y-auto rounded-md border p-4 space-y-4">
                           {bulkFoundMembers.map(member => (
                            <div key={member.itsId} className="p-3 border rounded-lg space-y-3">
                                <p className="font-medium">{member.name} ({member.itsId})</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                  {currentMiqaatDetails?.attendanceRequirements?.fetaPaghri && (
                                     <RadioGroup value={bulkComplianceState.get(member.itsId)?.fetaPaghri || 'no'} onValueChange={(val) => handleBulkComplianceChange(member.itsId, 'fetaPaghri', val)} className="flex gap-4"><Label>Feta/Paghri</Label><RadioGroupItem value="yes" id={`feta-yes-${member.itsId}`} /><Label htmlFor={`feta-yes-${member.itsId}`}>Y</Label><RadioGroupItem value="no" id={`feta-no-${member.itsId}`} /><Label htmlFor={`feta-no-${member.itsId}`}>N</Label></RadioGroup>
                                  )}
                                  {currentMiqaatDetails?.attendanceRequirements?.koti && (
                                     <RadioGroup value={bulkComplianceState.get(member.itsId)?.koti || 'no'} onValueChange={(val) => handleBulkComplianceChange(member.itsId, 'koti', val)} className="flex gap-4"><Label>Koti</Label><RadioGroupItem value="yes" id={`koti-yes-${member.itsId}`} /><Label htmlFor={`koti-yes-${member.itsId}`}>Y</Label><RadioGroupItem value="no" id={`koti-no-${member.itsId}`} /><Label htmlFor={`koti-no-${member.itsId}`}>N</Label></RadioGroup>
                                  )}
                                   {currentMiqaatDetails?.attendanceRequirements?.uniform && (
                                     <RadioGroup value={bulkComplianceState.get(member.itsId)?.uniform || 'improper'} onValueChange={(val) => handleBulkComplianceChange(member.itsId, 'uniform', val)} className="flex gap-4"><Label>Uniform</Label><RadioGroupItem value="proper" id={`uniform-yes-${member.itsId}`} /><Label htmlFor={`uniform-yes-${member.itsId}`}>P</Label><RadioGroupItem value="improper" id={`uniform-no-${member.itsId}`} /><Label htmlFor={`uniform-no-${member.itsId}`}>I</Label></RadioGroup>
                                  )}
                                   {currentMiqaatDetails?.attendanceRequirements?.shoes && (
                                     <RadioGroup value={bulkComplianceState.get(member.itsId)?.shoes || 'improper'} onValueChange={(val) => handleBulkComplianceChange(member.itsId, 'shoes', val)} className="flex gap-4"><Label>Shoes</Label><RadioGroupItem value="proper" id={`shoes-yes-${member.itsId}`} /><Label htmlFor={`shoes-yes-${member.itsId}`}>P</Label><RadioGroupItem value="improper" id={`shoes-no-${member.itsId}`} /><Label htmlFor={`shoes-no-${member.itsId}`}>I</Label></RadioGroup>
                                  )}
                                </div>
                            </div>
                           ))}
                         </div>
                        <Button onClick={handleBulkMarkAttendance} disabled={isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckSquare className="mr-2 h-4 w-4" />}
                            Mark All ({bulkFoundMembers.length}) as Present
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
      
      {failedSyncs.length > 0 && (
          <Card className="shadow-lg border-destructive">
              <CardHeader>
                  <CardTitle className="flex items-center text-destructive"><AlertCircle className="mr-2" />Requires Attention: {failedSyncs.length} Failed Syncs</CardTitle>
                  <CardDescription>These records failed to sync to the server. You can retry them individually or discard them.</CardDescription>
              </CardHeader>
              <CardContent>
                  <div className="max-h-80 overflow-y-auto rounded-md border">
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead>Member</TableHead>
                                  <TableHead>Miqaat</TableHead>
                                  <TableHead>Reason</TableHead>
                                  <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {failedSyncs.map(({ record, reason, errorMessage }) => (
                                  <TableRow key={record.id}>
                                      <TableCell>
                                          <div className="font-medium">{record.entry.userName}</div>
                                          <div className="text-xs text-muted-foreground">{record.entry.userItsId}</div>
                                      </TableCell>
                                      <TableCell>{allMiqaats.find(m => m.id === record.miqaatId)?.name || 'Unknown Miqaat'}</TableCell>
                                      <TableCell className="text-xs">
                                          {reason === 'conflict' ? 'Conflict: Already marked.' : `Error: ${errorMessage || 'Unknown'}`}
                                      </TableCell>
                                      <TableCell className="text-right">
                                           <Button variant="outline" size="sm" onClick={() => handleSync({ record } as FailedSyncRecord)} className="mr-2" disabled={isSyncing || isOffline}>
                                                <RefreshCw className="mr-2 h-4 w-4" /> Retry
                                          </Button>
                                          <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="destructive" size="sm" disabled={isSyncing}>
                                                        <Trash2 className="mr-2 h-4 w-4" /> Discard
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertHeader>
                                                        <AlertTitle>Are you sure?</AlertTitle>
                                                        <AlertDesc>
                                                            This will permanently discard the offline attendance record for {record.entry.userName}. This action cannot be undone.
                                                        </AlertDesc>
                                                    </AlertHeader>
                                                    <AlertFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            className="bg-destructive hover:bg-destructive/90"
                                                            onClick={() => handleDiscardFailedRecord(record.id!, record.syncAttemptId)}
                                                        >
                                                            Discard Record
                                                        </AlertDialogAction>
                                                    </AlertFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                      </TableCell>
                                  </TableRow>
                              ))}
                          </TableBody>
                      </Table>
                  </div>
              </CardContent>
          </Card>
      )}

      {/* Compliance Check Dialog */}
      <Dialog open={isComplianceDialogOpen} onOpenChange={(open) => {
        setIsComplianceDialogOpen(open);
        if (!open) {
          setIsProcessing(false);
        }
      }}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Compliance Check for {memberForComplianceCheck?.name}</DialogTitle>
            <DialogDescription>
              Confirm compliance for Miqaat: {currentSelectedMiqaatName}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
              {currentMiqaatDetails?.type === 'local' && currentMiqaatDetails?.attendanceRequirements?.fetaPaghri && (
                  <div>
                      <Label className="text-base font-medium">Feta/Paghri?</Label>
                      <RadioGroup
                          value={complianceState.fetaPaghri}
                          onValueChange={(value) => setComplianceState(prev => ({...prev, fetaPaghri: value as 'yes' | 'no' | 'safar'}))}
                          className="flex gap-4 mt-2"
                      >
                          <div className="flex items-center space-x-2">
                              <RadioGroupItem value="yes" id="feta-yes" />
                              <Label htmlFor="feta-yes">Yes</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                              <RadioGroupItem value="no" id="feta-no" />
                              <Label htmlFor="feta-no">No</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                              <RadioGroupItem value="safar" id="feta-safar" />
                              <Label htmlFor="feta-safar">Safar</Label>
                          </div>
                      </RadioGroup>
                  </div>
              )}
               {currentMiqaatDetails?.type === 'local' && currentMiqaatDetails?.attendanceRequirements?.koti && (
                  <div>
                      <Label className="text-base font-medium">Koti?</Label>
                      <RadioGroup
                          value={complianceState.koti}
                          onValueChange={(value) => setComplianceState(prev => ({...prev, koti: value as 'yes' | 'no' | 'safar'}))}
                          className="flex gap-4 mt-2"
                      >
                          <div className="flex items-center space-x-2">
                              <RadioGroupItem value="yes" id="koti-yes" />
                              <Label htmlFor="koti-yes">Yes</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                              <RadioGroupItem value="no" id="koti-no" />
                              <Label htmlFor="koti-no">No</Label>
                          </div>
                           <div className="flex items-center space-x-2">
                              <RadioGroupItem value="safar" id="koti-safar" />
                              <Label htmlFor="koti-safar">Safar</Label>
                          </div>
                      </RadioGroup>
                  </div>
              )}
               {currentMiqaatDetails?.type === 'international' && currentMiqaatDetails?.attendanceRequirements?.uniform && (
                  <div>
                      <Label className="text-base font-medium">Uniform (Dress/Jacket & Topi)?</Label>
                      <RadioGroup
                          value={complianceState.uniform}
                          onValueChange={(value) => setComplianceState(prev => ({...prev, uniform: value as 'proper' | 'improper'}))}
                          className="flex gap-4 mt-2"
                      >
                          <div className="flex items-center space-x-2">
                              <RadioGroupItem value="proper" id="uniform-proper" />
                              <Label htmlFor="uniform-proper">Proper</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                              <RadioGroupItem value="improper" id="uniform-improper" />
                              <Label htmlFor="uniform-improper">Improper</Label>
                          </div>
                      </RadioGroup>
                  </div>
              )}
              {currentMiqaatDetails?.type === 'international' && currentMiqaatDetails?.attendanceRequirements?.shoes && (
                  <div>
                      <Label className="text-base font-medium">Shoes?</Label>
                      <RadioGroup
                          value={complianceState.shoes}
                          onValueChange={(value) => setComplianceState(prev => ({...prev, shoes: value as 'proper' | 'improper'}))}
                          className="flex gap-4 mt-2"
                      >
                          <div className="flex items-center space-x-2">
                              <RadioGroupItem value="proper" id="shoes-proper" />
                              <Label htmlFor="shoes-proper">Proper</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                              <RadioGroupItem value="improper" id="shoes-improper" />
                              <Label htmlFor="shoes-improper">Improper</Label>
                          </div>
                      </RadioGroup>
                  </div>
              )}
              {currentMiqaatDetails?.attendanceRequirements?.nazrulMaqam && (
                <div className="space-y-2">
                   <Label htmlFor="nazrul-maqam-amount" className="text-base font-medium flex items-center gap-2"><HandCoins />Nazrul Maqam</Label>
                   <div className="grid grid-cols-3 gap-2">
                    <Input
                        id="nazrul-maqam-amount"
                        type="number"
                        placeholder="Amount"
                        value={nazrulMaqamAmount}
                        onChange={(e) => setNazrulMaqamAmount(e.target.value)}
                        className="col-span-2"
                    />
                     <Select value={nazrulMaqamCurrency} onValueChange={setNazrulMaqamCurrency}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="INR">INR</SelectItem>
                            <SelectItem value="PKR">PKR</SelectItem>
                            <SelectItem value="AED">AED</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="CAD">CAD</SelectItem>
                            <SelectItem value="AUD">AUD</SelectItem>
                            <SelectItem value="KWD">KWD</SelectItem>
                        </SelectContent>
                     </Select>
                   </div>
                </div>
              )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsComplianceDialogOpen(false);
              setIsProcessing(false);
            }}>Cancel</Button>
            <Button
              onClick={() => {
                if (memberForComplianceCheck) {
                  let finalComplianceState: Partial<UniformComplianceState> = { };
                  
                  if(currentMiqaatDetails?.type === 'local') {
                      finalComplianceState.fetaPaghri = complianceState.fetaPaghri;
                      finalComplianceState.koti = complianceState.koti;
                  } else {
                      finalComplianceState.uniform = complianceState.uniform;
                      finalComplianceState.shoes = complianceState.shoes;
                  }

                   if (currentMiqaatDetails?.attendanceRequirements?.nazrulMaqam && nazrulMaqamAmount) {
                     finalComplianceState.nazrulMaqam = {
                       amount: parseFloat(nazrulMaqamAmount),
                       currency: nazrulMaqamCurrency,
                     };
                   }
                  finalizeAttendance(memberForComplianceCheck, finalComplianceState as UniformComplianceState);
                }
              }}
              disabled={isSaving}
            >
              {isSaving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
              ) : (
                <><CheckSquare className="mr-2 h-4 w-4" /> Confirm and Mark Attendance</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
       {/* Sync Report Dialog */}
      <Dialog open={isSyncReportOpen} onOpenChange={setIsSyncReportOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Synchronization Report</DialogTitle>
                <DialogDescription>
                    Summary of the offline records synchronization process.
                </DialogDescription>
            </DialogHeader>
            {lastSyncReport && (
                <div className="space-y-4 py-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                        <div className="flex items-center gap-3">
                            <CheckCircle className="h-5 w-5 text-green-600"/>
                            <span className="font-medium text-green-800 dark:text-green-200">Synced Successfully</span>
                        </div>
                        <span className="font-bold text-lg text-green-900 dark:text-green-100">{lastSyncReport.success}</span>
                    </div>
                     <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                        <div className="flex items-center gap-3">
                            <AlertCircle className="h-5 w-5 text-yellow-600"/>
                            <span className="font-medium text-yellow-800 dark:text-yellow-200">Skipped (Conflicts)</span>
                        </div>
                        <span className="font-bold text-lg text-yellow-900 dark:text-yellow-100">{lastSyncReport.skipped}</span>
                    </div>
                     <div className="flex items-center justify-between p-3 rounded-lg bg-red-100 dark:bg-red-900/30">
                        <div className="flex items-center gap-3">
                            <XCircle className="h-5 w-5 text-red-600"/>
                            <span className="font-medium text-red-800 dark:text-red-200">Failed to Sync</span>
                        </div>
                        <span className="font-bold text-lg text-red-900 dark:text-red-100">{lastSyncReport.failed}</span>
                    </div>
                </div>
            )}
             <DialogFooter>
                <DialogClose asChild>
                    <Button>Close</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
