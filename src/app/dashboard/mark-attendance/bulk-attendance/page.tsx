"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Users2, UserSearch, CheckSquare, AlertCircle, Info, ShieldAlert, HandCoins, CalendarClock, Trash2 } from "lucide-react";
import { getMiqaats, markAttendanceInMiqaat } from "@/lib/firebase/miqaatService";
import { getUserByItsOrBgkId, getUsers } from "@/lib/firebase/userService";
import type { Miqaat, User, UserRole, MiqaatAttendanceEntryItem } from "@/types";
import { findNavItem } from "@/components/dashboard/sidebar-nav";
import { format } from "date-fns";
import { Alert, AlertDescription as ShadAlertDesc, AlertTitle as ShadAlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

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

export default function BulkAttendancePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  
  // Miqaat and session states
  const [selectedMiqaatId, setSelectedMiqaatId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [allMiqaats, setAllMiqaats] = useState<Pick<Miqaat, "id" | "name" | "startTime" | "endTime" | "reportingTime" | "sessions" | "type" | "mohallahIds" | "teams" | "eligibleItsIds" | "attendance" | "safarList" | "attendanceRequirements">[]>([]);
  const [isLoadingMiqaats, setIsLoadingMiqaats] = useState(true);
  const [miqaatTypeFilter, setMiqaatTypeFilter] = useState<'local' | 'international'>('local');

  // Search states
  const [bulkMemberIdsInput, setBulkMemberIdsInput] = useState("");
  const [bulkFoundMembers, setBulkFoundMembers] = useState<User[]>([]);
  const [bulkComplianceState, setBulkComplianceState] = useState<Map<string, Partial<UniformComplianceState>>>(new Map());
  const [isSearchingBulkMembers, setIsSearchingBulkMembers] = useState(false);
  const [bulkMarkingError, setBulkMarkingError] = useState<string | null>(null);
  const [bulkReason, setBulkReason] = useState("");

  // Saving states
  const [isSaving, setIsSaving] = useState(false);
  const [isAdminOverrideOpen, setIsAdminOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideTimestamp, setOverrideTimestamp] = useState<Date | undefined>(new Date());
  const [overrideTimestampInput, setOverrideTimestampInput] = useState("");

  // User details
  const [currentUserMohallahId, setCurrentUserMohallahId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [markerItsId, setMarkerItsId] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  // Authorization check
  useEffect(() => {
    const role = typeof window !== "undefined" ? localStorage.getItem('userRole') as UserRole : null;
    const pageRightsRaw = typeof window !== "undefined" ? localStorage.getItem('userPageRights') : '[]';
    const pageRights = JSON.parse(pageRightsRaw || '[]');
    const navItem = findNavItem('/dashboard/mark-attendance');
    
    if (navItem) {
      const hasRoleAccess = navItem.allowedRoles?.includes(role || 'user');
      const hasPageRight = pageRights.includes(navItem.href);
      
      if (hasRoleAccess || hasPageRight) {
        setIsAuthorized(true);
      } else {
        setIsAuthorized(false);
        setTimeout(() => router.replace('/dashboard'), 2000);
      }
    } else {
       setIsAuthorized(false);
       setTimeout(() => router.replace('/dashboard'), 2000);
    }
  }, [router]);

  // Load user data
  useEffect(() => {
    if (!isAuthorized) return;
    if (typeof window !== "undefined") {
      setMarkerItsId(localStorage.getItem('userItsId'));
      setCurrentUserMohallahId(localStorage.getItem('userMohallahId'));
      setCurrentUserRole(localStorage.getItem('userRole') as UserRole | null);
      setIsOffline(!navigator.onLine);
    }

    const updateOnlineStatus = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, [isAuthorized]);

  // Fetch Miqaats
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

  const currentMiqaatDetails = allMiqaats.find(m => m.id === selectedMiqaatId);
  const currentSessionDetails = currentMiqaatDetails?.type === 'international' 
    ? currentMiqaatDetails.sessions?.find(s => s.id === selectedSessionId)
    : currentMiqaatDetails?.sessions?.[0];

  const availableDays = useMemo(() => {
    if (!currentMiqaatDetails || currentMiqaatDetails.type !== 'international') return [];
    const days = [...new Set(currentMiqaatDetails.sessions?.map(s => s.day))].sort((a, b) => a - b);
    return days;
  }, [currentMiqaatDetails]);

  useEffect(() => {
    if (currentMiqaatDetails?.type === 'international' && availableDays.length === 1) {
      setSelectedDay(availableDays[0]);
    }
  }, [currentMiqaatDetails, availableDays]);

  const availableSessionsForDay = useMemo(() => {
    if (!currentMiqaatDetails || !selectedDay) return [];
    return currentMiqaatDetails.sessions?.filter(s => s.day === selectedDay) || [];
  }, [currentMiqaatDetails, selectedDay]);

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
            const member = isOffline ? await getUserByItsOrBgkId(id) : await getUserByItsOrBgkId(id); // Search
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
  
  const handleApplyAllCompliance = (field: keyof Omit<UniformComplianceState, 'nazrulMaqam'>, value: any) => {
    setBulkComplianceState(prev => {
        const newState = new Map(prev);
        bulkFoundMembers.forEach(member => {
            const userState = newState.get(member.itsId) || { fetaPaghri: 'no', koti: 'no', uniform: 'improper', shoes: 'improper' };
            newState.set(member.itsId, { ...userState, [field]: value });
        });
        return newState;
    });
  };

  const finalizeAttendance = async (member: User, compliance?: UniformComplianceState, overrideTimestamp?: Date, overrideReason?: string) => {
    const miqaatId = selectedMiqaatId;
    if (!miqaatId || !markerItsId || !currentSessionDetails) return;

    const attendanceTime = overrideTimestamp || new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const currentTimeString = `${pad(attendanceTime.getHours())}:${pad(attendanceTime.getMinutes())}`;

    let sessionReportingTimeString = "00:00";
    const miqaatReportingTime = currentSessionDetails.reportingTime || (currentMiqaatDetails?.reportingTime || null);

    if (miqaatReportingTime) {
      if (miqaatReportingTime.includes('T')) {
        const reportingDate = new Date(miqaatReportingTime);
        sessionReportingTimeString = `${pad(reportingDate.getHours())}:${pad(reportingDate.getMinutes())}`;
      } else if (miqaatReportingTime.includes(':')) {
        sessionReportingTimeString = miqaatReportingTime;
      }
    }

    const attendanceStatus: 'early' | 'late' = currentTimeString < sessionReportingTimeString ? 'early' : 'late';

    const attendanceEntryPayload: MiqaatAttendanceEntryItem = {
        userItsId: member.itsId,
        userName: member.name,
        sessionId: currentSessionDetails.id,
        markedAt: attendanceTime.toISOString(),
        markedByItsId: markerItsId,
        status: attendanceStatus,
        uniformCompliance: compliance,
        ...(overrideReason && { overrideReason }),
    };

    await markAttendanceInMiqaat(miqaatId, attendanceEntryPayload);

    // Confirmation Email Async trigger
    fetch('/api/attendance/send-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userItsId: attendanceEntryPayload.userItsId,
            miqaatId,
            status: attendanceEntryPayload.status,
            markedAt: attendanceEntryPayload.markedAt,
            sessionId: attendanceEntryPayload.sessionId,
            reason: attendanceEntryPayload.overrideReason
        })
    }).catch(err => console.error('Failed to trigger confirmation email:', err));
  };

  const handleBulkMarkAttendance = async (overrideData?: { timestamp: Date, reason: string }) => {
    if (bulkFoundMembers.length === 0 || !currentMiqaatDetails || !currentSessionDetails) return;
    if (isOffline) {
      toast({ title: "Offline Mode", description: "Bulk Attendance marking requires active connection.", variant: "destructive" });
      return;
    }

    const isExpired = new Date(currentMiqaatDetails.endTime) < new Date();
    if (isExpired && currentUserRole !== 'admin' && currentUserRole !== 'superadmin') {
        toast({ title: "Miqaat Expired", description: "This Miqaat has ended. Bulk attendance cannot be marked.", variant: "destructive" });
        return;
    }
    
    if (isExpired && !overrideData) {
        setOverrideTimestamp(new Date(currentMiqaatDetails.startTime));
        setOverrideTimestampInput(format(new Date(currentMiqaatDetails.startTime), "yyyy-MM-dd'T'HH:mm"));
        if (!overrideReason.trim()) {
          setOverrideReason(bulkReason || "Bulk marked by Administrator");
        }
        setIsAdminOverrideOpen(true);
        return;
    }

    setIsSaving(true);
    let successCount = 0;
    let failedCount = 0;

    for (const member of bulkFoundMembers) {
        try {
            const complianceData = bulkComplianceState.get(member.itsId);
            await finalizeAttendance(member, complianceData as UniformComplianceState, overrideData?.timestamp, overrideData?.reason || bulkReason || "Bulk marked by Administrator");
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

    setBulkMemberIdsInput("");
    setBulkReason("");
    setBulkFoundMembers([]);
    setBulkComplianceState(new Map());
    setBulkMarkingError(null);
    setIsSaving(false);
    setIsAdminOverrideOpen(false);
    setOverrideReason("");
    setOverrideTimestampInput("");
  };

  const openAdminOverrideDialog = () => {
    const defaultDate = currentSessionDetails?.startTime
      ? new Date(currentSessionDetails.startTime)
      : currentMiqaatDetails?.startTime
        ? new Date(currentMiqaatDetails.startTime)
        : new Date();
    setOverrideTimestamp(defaultDate);
    setOverrideTimestampInput(format(defaultDate, "yyyy-MM-dd'T'HH:mm"));
    setOverrideReason(bulkReason || "Bulk marked by Administrator");
    setIsAdminOverrideOpen(true);
  };

  const handleOverrideTimestampInputChange = (value: string) => {
    setOverrideTimestampInput(value);
    const nextDate = new Date(value);
    setOverrideTimestamp(Number.isNaN(nextDate.getTime()) ? undefined : nextDate);
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
        <p className="text-muted-foreground mt-2">You do not have permissions to view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.push("/dashboard/mark-attendance")} className="h-9 w-9">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users2 className="h-6 w-6 text-primary" />
            Bulk Attendance Marking
          </h1>
          <p className="text-sm text-muted-foreground">Mark present check-ins for multiple members simultaneously.</p>
        </div>
      </div>

      {isOffline && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="font-semibold text-destructive">Offline Mode Active</p>
              <p className="text-xs text-muted-foreground">Bulk attendance is locked during offline operation and requires server connection.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="glass-surface border-white/20 shadow-md">
        <CardHeader>
          <CardTitle>Configure Bulk Sessions</CardTitle>
          <CardDescription>Select a target Miqaat and session configuration to process bulk check-ins.</CardDescription>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="miqaat-select">Select Miqaat</Label>
              <Select
                onValueChange={(value) => {
                  setSelectedMiqaatId(value);
                  const miqaat = allMiqaats.find(m => m.id === value);
                  if (miqaat?.type === 'local') {
                      setSelectedDay(1);
                      setSelectedSessionId(miqaat.sessions?.[0]?.id || null);
                  } else {
                      const days = [...new Set(miqaat?.sessions?.map(s => s.day))];
                      if (days.length === 1) {
                          setSelectedDay(days[0]);
                      } else {
                          setSelectedDay(null);
                      }
                      setSelectedSessionId(null);
                  }
                  setBulkFoundMembers([]);
                }}
                value={selectedMiqaatId || undefined}
                disabled={isLoadingMiqaats || isSaving || isOffline}
              >
                <SelectTrigger id="miqaat-select">
                  <SelectValue placeholder={isLoadingMiqaats ? "Loading..." : "Choose a Miqaat"} />
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

            {currentMiqaatDetails?.type === 'international' && availableDays.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="day-select">Select Day</Label>
                <Select
                  onValueChange={(value) => {
                    setSelectedDay(Number(value));
                    setSelectedSessionId(null);
                    setBulkFoundMembers([]);
                  }}
                  value={selectedDay?.toString() || undefined}
                  disabled={!selectedMiqaatId || isSaving || isOffline}
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
                  onValueChange={(value) => {
                    setSelectedSessionId(value);
                    setBulkFoundMembers([]);
                  }}
                  value={selectedSessionId || undefined}
                  disabled={!selectedDay || isSaving || isOffline}
                >
                  <SelectTrigger id="session-select">
                    <SelectValue placeholder="Choose a session" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSessionsForDay.map(session => (
                      <SelectItem key={session.id} value={session.id}>
                        {session.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="glass-surface border-white/20 shadow-md">
        <CardHeader>
          <CardTitle>Pasted Members Lookup</CardTitle>
          <CardDescription>Paste list of 8-digit ITS or BGK IDs separated by spaces or newlines.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bulk-member-ids">Member IDs</Label>
            <Textarea
              id="bulk-member-ids"
              placeholder="52000001, 52000002&#10;52000003"
              value={bulkMemberIdsInput}
              onChange={(e) => setBulkMemberIdsInput(e.target.value)}
              disabled={!selectedMiqaatId || !currentSessionDetails || isSearchingBulkMembers || isSaving || isOffline}
              rows={5}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bulk-reason">Note / Reason (Optional)</Label>
            <Input
              id="bulk-reason"
              placeholder="e.g. Bulk marked check-ins"
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
              disabled={!selectedMiqaatId || !currentSessionDetails || isSaving || isOffline}
            />
          </div>
          <Button 
            onClick={handleBulkMemberSearch} 
            disabled={!selectedMiqaatId || !currentSessionDetails || !bulkMemberIdsInput.trim() || isSearchingBulkMembers || isSaving || isOffline}
            className="font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/95 hover:to-primary/75 text-primary-foreground shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all duration-200 hover:-translate-y-[1px] active:translate-y-0"
          >
            {isSearchingBulkMembers ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserSearch className="mr-2 h-4 w-4" />}
            Find Members
          </Button>

          {bulkMarkingError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <ShadAlertTitle>Unresolved IDs</ShadAlertTitle>
              <ShadAlertDesc>{bulkMarkingError}</ShadAlertDesc>
            </Alert>
          )}

          {bulkFoundMembers.length > 0 && (
            <div className="space-y-4 border-t border-white/10 pt-6 mt-4">
              <h4 className="font-semibold text-lg">Batch Marking ({bulkFoundMembers.length} members resolved)</h4>
              
              {miqaatHasAttendanceRequirements && (
                <div className="p-4 border bg-muted/40 rounded-lg space-y-3">
                  <h5 className="font-semibold text-sm text-primary">Apply uniform check to all:</h5>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {currentMiqaatDetails?.attendanceRequirements?.fetaPaghri && (
                      <div className="flex items-center space-x-2">
                        <Label className="text-xs">Feta/Paghri</Label>
                        <RadioGroup onValueChange={(val) => handleApplyAllCompliance('fetaPaghri', val)} className="flex gap-2">
                          <div className="flex items-center space-x-1"><RadioGroupItem value="yes" id="all-feta-yes" /><Label htmlFor="all-feta-yes" className="text-xs">Y</Label></div>
                          <div className="flex items-center space-x-1"><RadioGroupItem value="no" id="all-feta-no" /><Label htmlFor="all-feta-no" className="text-xs">N</Label></div>
                        </RadioGroup>
                      </div>
                    )}
                    {currentMiqaatDetails?.attendanceRequirements?.koti && (
                      <div className="flex items-center space-x-2">
                        <Label className="text-xs">Koti</Label>
                        <RadioGroup onValueChange={(val) => handleApplyAllCompliance('koti', val)} className="flex gap-2">
                          <div className="flex items-center space-x-1"><RadioGroupItem value="yes" id="all-koti-yes" /><Label htmlFor="all-koti-yes" className="text-xs">Y</Label></div>
                          <div className="flex items-center space-x-1"><RadioGroupItem value="no" id="all-koti-no" /><Label htmlFor="all-koti-no" className="text-xs">N</Label></div>
                        </RadioGroup>
                      </div>
                    )}
                    {currentMiqaatDetails?.attendanceRequirements?.uniform && (
                      <div className="flex items-center space-x-2">
                        <Label className="text-xs">Uniform</Label>
                        <RadioGroup onValueChange={(val) => handleApplyAllCompliance('uniform', val)} className="flex gap-2">
                          <div className="flex items-center space-x-1"><RadioGroupItem value="proper" id="all-uni-yes" /><Label htmlFor="all-uni-yes" className="text-xs">P</Label></div>
                          <div className="flex items-center space-x-1"><RadioGroupItem value="improper" id="all-uni-no" /><Label htmlFor="all-uni-no" className="text-xs">I</Label></div>
                        </RadioGroup>
                      </div>
                    )}
                    {currentMiqaatDetails?.attendanceRequirements?.shoes && (
                      <div className="flex items-center space-x-2">
                        <Label className="text-xs">Shoes</Label>
                        <RadioGroup onValueChange={(val) => handleApplyAllCompliance('shoes', val)} className="flex gap-2">
                          <div className="flex items-center space-x-1"><RadioGroupItem value="proper" id="all-shoes-yes" /><Label htmlFor="all-shoes-yes" className="text-xs">P</Label></div>
                          <div className="flex items-center space-x-1"><RadioGroupItem value="improper" id="all-shoes-no" /><Label htmlFor="all-shoes-no" className="text-xs">I</Label></div>
                        </RadioGroup>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="max-h-80 overflow-y-auto rounded-md border p-4 space-y-4">
                {bulkFoundMembers.map(member => (
                  <div key={member.itsId} className="p-3 border rounded-lg space-y-3 bg-muted/10">
                    <p className="font-medium text-sm">{member.name} ({member.itsId})</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {currentMiqaatDetails?.attendanceRequirements?.fetaPaghri && (
                        <div className="flex items-center space-x-2">
                          <Label className="font-normal text-xs">Feta/Paghri</Label>
                          <RadioGroup onValueChange={(val) => handleBulkComplianceChange(member.itsId, 'fetaPaghri', val)} value={bulkComplianceState.get(member.itsId)?.fetaPaghri || 'no'} className="flex gap-2">
                            <div className="flex items-center space-x-1"><RadioGroupItem value="yes" id={`feta-yes-${member.itsId}`} /><Label htmlFor={`feta-yes-${member.itsId}`} className="text-xs">Y</Label></div>
                            <div className="flex items-center space-x-1"><RadioGroupItem value="no" id={`feta-no-${member.itsId}`} /><Label htmlFor={`feta-no-${member.itsId}`} className="text-xs">N</Label></div>
                          </RadioGroup>
                        </div>
                      )}
                      {currentMiqaatDetails?.attendanceRequirements?.koti && (
                        <div className="flex items-center space-x-2">
                          <Label className="font-normal text-xs">Koti</Label>
                          <RadioGroup onValueChange={(val) => handleBulkComplianceChange(member.itsId, 'koti', val)} value={bulkComplianceState.get(member.itsId)?.koti || 'no'} className="flex gap-2">
                            <div className="flex items-center space-x-1"><RadioGroupItem value="yes" id={`koti-yes-${member.itsId}`} /><Label htmlFor={`koti-yes-${member.itsId}`} className="text-xs">Y</Label></div>
                            <div className="flex items-center space-x-1"><RadioGroupItem value="no" id={`koti-no-${member.itsId}`} /><Label htmlFor={`koti-no-${member.itsId}`} className="text-xs">N</Label></div>
                          </RadioGroup>
                        </div>
                      )}
                      {currentMiqaatDetails?.attendanceRequirements?.uniform && (
                        <div className="flex items-center space-x-2">
                          <Label className="font-normal text-xs">Uniform</Label>
                          <RadioGroup onValueChange={(val) => handleBulkComplianceChange(member.itsId, 'uniform', val)} value={bulkComplianceState.get(member.itsId)?.uniform || 'improper'} className="flex gap-2">
                            <div className="flex items-center space-x-1"><RadioGroupItem value="proper" id={`uni-yes-${member.itsId}`} /><Label htmlFor={`uni-yes-${member.itsId}`} className="text-xs">P</Label></div>
                            <div className="flex items-center space-x-1"><RadioGroupItem value="improper" id={`uni-no-${member.itsId}`} /><Label htmlFor={`uni-no-${member.itsId}`} className="text-xs">I</Label></div>
                          </RadioGroup>
                        </div>
                      )}
                      {currentMiqaatDetails?.attendanceRequirements?.shoes && (
                        <div className="flex items-center space-x-2">
                          <Label className="font-normal text-xs">Shoes</Label>
                          <RadioGroup onValueChange={(val) => handleBulkComplianceChange(member.itsId, 'shoes', val)} value={bulkComplianceState.get(member.itsId)?.shoes || 'improper'} className="flex gap-2">
                            <div className="flex items-center space-x-1"><RadioGroupItem value="proper" id={`shoes-yes-${member.itsId}`} /><Label htmlFor={`shoes-yes-${member.itsId}`} className="text-xs">P</Label></div>
                            <div className="flex items-center space-x-1"><RadioGroupItem value="improper" id={`shoes-no-${member.itsId}`} /><Label htmlFor={`shoes-no-${member.itsId}`} className="text-xs">I</Label></div>
                          </RadioGroup>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  onClick={() => handleBulkMarkAttendance()} 
                  disabled={isSaving || isOffline}
                  className="font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/95 hover:to-primary/75 text-primary-foreground shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all duration-200 hover:-translate-y-[1px] active:translate-y-0"
                >
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckSquare className="mr-2 h-4 w-4" />}
                  Mark All ({bulkFoundMembers.length}) as Present
                </Button>
                {(currentUserRole === 'admin' || currentUserRole === 'superadmin') && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={openAdminOverrideDialog}
                    disabled={isSaving || isOffline}
                  >
                    <CalendarClock className="mr-2 h-4 w-4" />
                    Mark with Custom Time
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin Override Dialog */}
      <Dialog open={isAdminOverrideOpen} onOpenChange={setIsAdminOverrideOpen}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Admin Override: Mark Attendance Time</DialogTitle>
            <DialogDescription>
              Select the exact attendance date and time to save for this bulk entry.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="override-reason">Reason for Manual Entry</Label>
              <Input
                id="override-reason"
                placeholder="Reason"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="override-timestamp">Date and Time</Label>
              <Input
                id="override-timestamp"
                type="datetime-local"
                value={overrideTimestampInput}
                min={currentMiqaatDetails?.startTime ? format(new Date(currentMiqaatDetails.startTime), "yyyy-MM-dd'T'HH:mm") : undefined}
                max={currentMiqaatDetails?.endTime ? format(new Date(currentMiqaatDetails.endTime), "yyyy-MM-dd'T'HH:mm") : undefined}
                onChange={(e) => handleOverrideTimestampInputChange(e.target.value)}
              />
              {overrideTimestamp && (
                <p className="text-xs text-muted-foreground">
                  Final timestamp: {format(overrideTimestamp, "PPP p")}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdminOverrideOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => handleBulkMarkAttendance({ timestamp: overrideTimestamp!, reason: overrideReason })} 
              disabled={!overrideReason.trim() || !overrideTimestamp}
              className="font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/95 hover:to-primary/75 text-primary-foreground shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all duration-200 hover:-translate-y-[1px] active:translate-y-0"
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
