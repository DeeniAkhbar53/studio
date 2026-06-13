"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, CalendarRange, UserSearch, CheckSquare, ShieldAlert, BadgeInfo, Check, AlertTriangle, AlertCircle } from "lucide-react";
import { getMiqaats, markAttendanceInMiqaat, batchMarkSafarInMiqaat, editUserAttendanceInMiqaat } from "@/lib/firebase/miqaatService";
import { getUserByItsOrBgkId } from "@/lib/firebase/userService";
import type { Miqaat, User, UserRole, MiqaatAttendanceEntryItem, MiqaatSafarEntryItem, MiqaatSession } from "@/types";
import { findNavItem } from "@/components/dashboard/sidebar-nav";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

type ComplianceState = {
    fetaPaghri: 'yes' | 'no' | 'safar';
    koti: 'yes' | 'no' | 'safar';
    uniform: 'proper' | 'improper';
    shoes: 'proper' | 'improper';
    nazrulMaqam?: {
        amount: number;
        currency: string;
    }
};

export default function MultiMiqaatAttendancePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  
  // State for Miqaats
  const [allMiqaats, setAllMiqaats] = useState<Miqaat[]>([]);
  const [isLoadingMiqaats, setIsLoadingMiqaats] = useState(true);
  const [miqaatSearch, setMiqaatSearch] = useState("");
  const [selectedMiqaatIds, setSelectedMiqaatIds] = useState<string[]>([]);
  const [selectedMiqaatSessions, setSelectedMiqaatSessions] = useState<Map<string, string>>(new Map()); // miqaatId -> sessionId
  
  // Member States
  const [memberIdSearch, setMemberIdSearch] = useState("");
  const [foundMember, setFoundMember] = useState<User | null>(null);
  const [isSearchingMember, setIsSearchingMember] = useState(false);
  const [memberSearchError, setMemberSearchError] = useState<string | null>(null);

  // Marking Options
  const [attendanceStatus, setAttendanceStatus] = useState<'present' | 'late' | 'early' | 'safar' | 'absent'>('present');
  const [compliance, setCompliance] = useState<ComplianceState>({
    fetaPaghri: 'no',
    koti: 'no',
    uniform: 'proper',
    shoes: 'proper'
  });
  const [nazrulMaqamAmount, setNazrulMaqamAmount] = useState("");
  const [nazrulMaqamCurrency, setNazrulMaqamCurrency] = useState("KES");
  const [manualNote, setManualNote] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [currentUserMohallahId, setCurrentUserMohallahId] = useState<string | null>(null);
  const [markerItsId, setMarkerItsId] = useState<string | null>(null);

  // Auth check & page access
  useEffect(() => {
    const role = typeof window !== "undefined" ? localStorage.getItem('userRole') as UserRole : null;
    const pageRightsRaw = typeof window !== "undefined" ? localStorage.getItem('userPageRights') : '[]';
    const pageRights = JSON.parse(pageRightsRaw || '[]');
    const navItem = findNavItem('/dashboard/mark-attendance/multi-miqaat-attendance');
    
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

  // Load user profile properties
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

  // Fetch Miqaats from DB
  useEffect(() => {
    if (!isAuthorized) return;
    setIsLoadingMiqaats(true);
    const unsubscribe = getMiqaats((fetchedMiqaats) => {
      setAllMiqaats(fetchedMiqaats);
      setIsLoadingMiqaats(false);
    });
    return () => unsubscribe();
  }, [isAuthorized]);

  // Filter Miqaats for checkbox list
  const filteredMiqaats = useMemo(() => {
    if (isLoadingMiqaats) return [];
    
    // Admins can see all, Mohallah admins see theirs
    let accessible = allMiqaats;
    if (currentUserRole !== 'superadmin' && currentUserMohallahId) {
      accessible = allMiqaats.filter(m => {
        if (!m.mohallahIds || m.mohallahIds.length === 0) return true;
        return m.mohallahIds.includes(currentUserMohallahId);
      });
    }

    if (!miqaatSearch.trim()) return accessible;
    
    const query = miqaatSearch.toLowerCase();
    return accessible.filter(m => 
      m.name.toLowerCase().includes(query) || 
      format(new Date(m.startTime), "P").includes(query)
    );
  }, [allMiqaats, currentUserMohallahId, currentUserRole, isLoadingMiqaats, miqaatSearch]);

  const selectedMiqaats = useMemo(() => {
    return allMiqaats.filter(m => selectedMiqaatIds.includes(m.id));
  }, [allMiqaats, selectedMiqaatIds]);

  // Initialize sessions when a miqaat is checked
  const handleMiqaatToggle = (miqaatId: string, checked: boolean) => {
    if (checked) {
      setSelectedMiqaatIds(prev => [...prev, miqaatId]);
      const miqaat = allMiqaats.find(m => m.id === miqaatId);
      if (miqaat && miqaat.sessions && miqaat.sessions.length > 0) {
        setSelectedMiqaatSessions(prev => {
          const newMap = new Map(prev);
          newMap.set(miqaatId, miqaat.sessions![0].id);
          return newMap;
        });
      }
    } else {
      setSelectedMiqaatIds(prev => prev.filter(id => id !== miqaatId));
      setSelectedMiqaatSessions(prev => {
        const newMap = new Map(prev);
        newMap.delete(miqaatId);
        return newMap;
      });
    }
  };

  // Check if compliance options are needed for selected Miqaats
  const requiredComplianceFields = useMemo(() => {
    const fields = { fetaPaghri: false, koti: false, uniform: false, shoes: false, nazrulMaqam: false };
    selectedMiqaats.forEach(m => {
      if (m.attendanceRequirements) {
        if (m.attendanceRequirements.fetaPaghri) fields.fetaPaghri = true;
        if (m.attendanceRequirements.koti) fields.koti = true;
        if (m.attendanceRequirements.uniform) fields.uniform = true;
        if (m.attendanceRequirements.shoes) fields.shoes = true;
        if (m.attendanceRequirements.nazrulMaqam) fields.nazrulMaqam = true;
      }
    });
    return fields;
  }, [selectedMiqaats]);

  // Handle searching the member
  const handleSearchMember = async () => {
    if (!memberIdSearch.trim()) {
      toast({ title: "ITS/BGK ID Required", description: "Please enter the member's ITS or BGK ID.", variant: "destructive" });
      return;
    }
    
    setIsSearchingMember(true);
    setFoundMember(null);
    setMemberSearchError(null);

    try {
      const member = await getUserByItsOrBgkId(memberIdSearch.trim());
      if (member) {
        setFoundMember(member);
      } else {
        setMemberSearchError(`No member found with ID: ${memberIdSearch}`);
      }
    } catch (e) {
      console.error("Error finding member:", e);
      setMemberSearchError("An error occurred during member search.");
    } finally {
      setIsSearchingMember(false);
    }
  };

  // Perform multi-miqaat attendance marking
  const handleMarkAttendance = async () => {
    if (selectedMiqaatIds.length === 0) {
      toast({ title: "Selection Required", description: "Please select at least one Miqaat.", variant: "destructive" });
      return;
    }
    if (!foundMember) {
      toast({ title: "Member Required", description: "Please search and resolve a member first.", variant: "destructive" });
      return;
    }
    if (isOffline) {
      toast({ title: "Offline Mode", description: "Marking attendance in batch requires an active connection.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    let successCount = 0;
    let failedCount = 0;
    const markerId = markerItsId || 'System';

    for (const miqaat of selectedMiqaats) {
      try {
        const sessionId = selectedMiqaatSessions.get(miqaat.id);
        const session = miqaat.sessions?.find(s => s.id === sessionId);

        // Check if eligibility applies
        const isEligibleForMiqaat = 
            (!miqaat.mohallahIds || miqaat.mohallahIds.length === 0) &&
            (!miqaat.teams || miqaat.teams.length === 0) &&
            (!miqaat.eligibleItsIds || miqaat.eligibleItsIds.length === 0);

        if (!isEligibleForMiqaat) {
          let hasAccess = false;
          const eligibleById = !!miqaat.eligibleItsIds?.includes(foundMember.itsId);
          const eligibleByTeam = !!foundMember.team && !!miqaat.teams?.includes(foundMember.team);
          const eligibleByMohallah = !!foundMember.mohallahId && !!miqaat.mohallahIds?.includes(foundMember.mohallahId);

          if (miqaat.eligibleItsIds && miqaat.eligibleItsIds.length > 0) {
             hasAccess = eligibleById;
          } else {
             hasAccess = eligibleByMohallah || eligibleByTeam;
          }

          if (!hasAccess) {
             console.warn(`User ${foundMember.itsId} is not eligible for Miqaat ${miqaat.name}`);
             failedCount++;
             continue; // Skip this miqaat
          }
        }

        // Setup compliance parameters
        const finalCompliance: any = {};
        if (miqaat.attendanceRequirements?.fetaPaghri) finalCompliance.fetaPaghri = compliance.fetaPaghri;
        if (miqaat.attendanceRequirements?.koti) finalCompliance.koti = compliance.koti;
        if (miqaat.attendanceRequirements?.uniform) finalCompliance.uniform = compliance.uniform;
        if (miqaat.attendanceRequirements?.shoes) finalCompliance.shoes = compliance.shoes;
        if (miqaat.attendanceRequirements?.nazrulMaqam && nazrulMaqamAmount) {
            finalCompliance.nazrulMaqam = {
                amount: parseFloat(nazrulMaqamAmount),
                currency: nazrulMaqamCurrency
            };
        }

        // Call editUserAttendanceInMiqaat to ensure we wipe previous states and write the new one
        await editUserAttendanceInMiqaat(
          miqaat.id,
          foundMember.itsId,
          attendanceStatus,
          sessionId || undefined,
          foundMember.name
        );

        // Trigger confirmation email
        if (attendanceStatus !== 'absent') {
          fetch('/api/attendance/send-confirmation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  userItsId: foundMember.itsId,
                  miqaatId: miqaat.id,
                  status: attendanceStatus === 'present' ? 'present' : attendanceStatus,
                  markedAt: new Date().toISOString(),
                  sessionId: sessionId || undefined,
                  reason: manualNote || "Marked via Multi-Miqaat dashboard"
              })
          }).catch(err => console.error('Failed to trigger confirmation email:', err));
        }

        successCount++;
      } catch (error) {
        console.error(`Failed to mark attendance in ${miqaat.name}:`, error);
        failedCount++;
      }
    }

    toast({
      title: "Batch Marking Complete",
      description: `Successfully marked user in ${successCount} Miqaat(s). Failed: ${failedCount}.`,
      variant: failedCount > 0 ? "destructive" : "default"
    });

    // Reset inputs
    setFoundMember(null);
    setMemberIdSearch("");
    setManualNote("");
    setNazrulMaqamAmount("");
    setIsSaving(false);
  };

  if (isAuthorized === null) {
    return (
      <div className="flex h-full w-full items-center justify-center min-h-[50vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center min-h-[50vh]">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
        <p className="text-muted-foreground mt-2">You do not have permissions to view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.push("/dashboard/mark-attendance")} className="h-9 w-9">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarRange className="h-6 w-6 text-primary" />
            Multi-Miqaat Attendance Marking
          </h1>
          <p className="text-sm text-muted-foreground">Check in a member into multiple Miqaat events at once.</p>
        </div>
      </div>

      {isOffline && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="font-semibold text-destructive">Offline Mode Active</p>
              <p className="text-xs text-muted-foreground">Batch marking requires a live connection and is disabled while offline.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Miqaat Selection List */}
        <Card className="lg:col-span-1 border-border/60 shadow-md bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base">1. Select Target Miqaats</CardTitle>
            <CardDescription>Search and check all events you want to mark.</CardDescription>
            <div className="relative pt-2">
              <Input
                placeholder="Search Miqaats..."
                value={miqaatSearch}
                onChange={(e) => setMiqaatSearch(e.target.value)}
                className="h-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[350px] pr-2">
              {isLoadingMiqaats ? (
                <div className="flex items-center justify-center h-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : filteredMiqaats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No accessible Miqaats found.</p>
              ) : (
                <div className="space-y-3">
                  {filteredMiqaats.map((m) => (
                    <div key={m.id} className="flex items-start gap-2.5 p-2 rounded-md hover:bg-muted/40 transition-colors">
                      <Checkbox
                        id={`miqaat-${m.id}`}
                        checked={selectedMiqaatIds.includes(m.id)}
                        onCheckedChange={(checked) => handleMiqaatToggle(m.id, !!checked)}
                        className="mt-1"
                      />
                      <label htmlFor={`miqaat-${m.id}`} className="text-xs font-medium cursor-pointer leading-normal select-none flex-grow">
                        <span className="block font-semibold text-foreground text-sm line-clamp-1">{m.name}</span>
                        <span className="block text-muted-foreground mt-0.5">{format(new Date(m.startTime), "P")}</span>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Member Search and Configuration */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Selected Session Layout */}
          {selectedMiqaats.length > 0 && (
            <Card className="border-border/60 shadow-md bg-card/60 backdrop-blur-sm">
              <CardHeader className="py-4">
                <CardTitle className="text-base">2. Event Session Configuration</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Miqaat Name</TableHead>
                      <TableHead>Event Type</TableHead>
                      <TableHead>Session Selector</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedMiqaats.map(m => (
                      <TableRow key={m.id}>
                        <TableCell className="font-semibold text-xs py-2.5">{m.name}</TableCell>
                        <TableCell className="py-2.5"><Badge variant={m.type === 'local' ? 'outline' : 'secondary'}>{m.type}</Badge></TableCell>
                        <TableCell className="py-2.5">
                          {m.sessions && m.sessions.length > 0 ? (
                            <Select 
                              value={selectedMiqaatSessions.get(m.id)}
                              onValueChange={(val) => {
                                setSelectedMiqaatSessions(prev => {
                                  const newMap = new Map(prev);
                                  newMap.set(m.id, val);
                                  return newMap;
                                });
                              }}
                            >
                              <SelectTrigger className="h-8 max-w-[180px]">
                                <SelectValue placeholder="Select session" />
                              </SelectTrigger>
                              <SelectContent>
                                {m.sessions.map((s: MiqaatSession) => (
                                  <SelectItem key={s.id} value={s.id}>{s.name} (Day {s.day})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-xs text-muted-foreground">Main Session (Default)</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Member Resolution & Batch Form */}
          <Card className="border-border/60 shadow-md bg-card/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base">3. Resolve Member & Choose Action</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Member Search input */}
              <div className="flex gap-3 items-end">
                <div className="space-y-1.5 flex-1">
                  <Label htmlFor="search-its">ITS / BGK ID</Label>
                  <Input
                    id="search-its"
                    placeholder="Enter ITS or BGK ID"
                    value={memberIdSearch}
                    onChange={(e) => setMemberIdSearch(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSearchMember(); }}
                    disabled={isSearchingMember || isSaving || isOffline}
                    className="h-10"
                  />
                </div>
                <Button 
                  onClick={handleSearchMember} 
                  disabled={!memberIdSearch.trim() || isSearchingMember || isSaving || isOffline}
                  className="h-10 font-semibold"
                >
                  {isSearchingMember ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserSearch className="mr-2 h-4 w-4" />}
                  Resolve User
                </Button>
              </div>

              {memberSearchError && (
                <div className="flex items-center gap-2 p-3 rounded-md border border-destructive/20 bg-destructive/5 text-destructive text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{memberSearchError}</span>
                </div>
              )}

              {/* Resolved Member Panel */}
              {foundMember && (
                <div className="p-4 rounded-lg border border-border/80 bg-muted/20 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border/40">
                    <div>
                      <h4 className="font-bold text-foreground">{foundMember.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">ITS: {foundMember.itsId} {foundMember.bgkId ? `| BGK ID: ${foundMember.bgkId}` : ''}</p>
                    </div>
                    <Badge className="bg-primary/10 hover:bg-primary/20 text-primary uppercase font-bold border-transparent">{foundMember.role}</Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                    <div><strong>Team:</strong> <span className="text-foreground font-medium">{foundMember.team || "N/A"}</span></div>
                    <div><strong>Designation:</strong> <span className="text-foreground font-medium">{foundMember.designation || "Member"}</span></div>
                  </div>

                  {/* Attendance options */}
                  <div className="border-t border-border/40 pt-4 space-y-4">
                    <div className="space-y-2">
                      <Label>Attendance status for this batch:</Label>
                      <RadioGroup 
                        value={attendanceStatus} 
                        onValueChange={(val) => setAttendanceStatus(val as any)} 
                        className="flex flex-wrap gap-4 pt-1"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="present" id="status-present" />
                          <Label htmlFor="status-present">Present</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="late" id="status-late" />
                          <Label htmlFor="status-late">Late</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="early" id="status-early" />
                          <Label htmlFor="status-early">Early</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="safar" id="status-safar" />
                          <Label htmlFor="status-safar">Safar</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="absent" id="status-absent" />
                          <Label htmlFor="status-absent">Absent (Remove)</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Uniform requirements */}
                    {attendanceStatus !== 'absent' && (
                      <div className="space-y-4 pt-2 border-t border-border/30">
                        <h5 className="font-semibold text-xs text-primary uppercase tracking-wider">Uniform Compliance Details (If required by events)</h5>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {requiredComplianceFields.fetaPaghri && (
                            <div className="space-y-2">
                              <Label className="text-xs">Feta / Paghri Check</Label>
                              <Select 
                                value={compliance.fetaPaghri} 
                                onValueChange={(val) => setCompliance(prev => ({...prev, fetaPaghri: val as any}))}
                              >
                                <SelectTrigger className="h-8.5">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="yes">Wearing (Yes)</SelectItem>
                                  <SelectItem value="no">Not Wearing (No)</SelectItem>
                                  <SelectItem value="safar">Safar (Traveling)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {requiredComplianceFields.koti && (
                            <div className="space-y-2">
                              <Label className="text-xs">Koti Check</Label>
                              <Select 
                                value={compliance.koti} 
                                onValueChange={(val) => setCompliance(prev => ({...prev, koti: val as any}))}
                              >
                                <SelectTrigger className="h-8.5">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="yes">Wearing (Yes)</SelectItem>
                                  <SelectItem value="no">Not Wearing (No)</SelectItem>
                                  <SelectItem value="safar">Safar (Traveling)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {requiredComplianceFields.uniform && (
                            <div className="space-y-2">
                              <Label className="text-xs">Uniform Dress</Label>
                              <Select 
                                value={compliance.uniform} 
                                onValueChange={(val) => setCompliance(prev => ({...prev, uniform: val as any}))}
                              >
                                <SelectTrigger className="h-8.5">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="proper">Proper Dress Code</SelectItem>
                                  <SelectItem value="improper">Improper Dress Code</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {requiredComplianceFields.shoes && (
                            <div className="space-y-2">
                              <Label className="text-xs">Uniform Shoes</Label>
                              <Select 
                                value={compliance.shoes} 
                                onValueChange={(val) => setCompliance(prev => ({...prev, shoes: val as any}))}
                              >
                                <SelectTrigger className="h-8.5">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="proper">Proper Shoes Code</SelectItem>
                                  <SelectItem value="improper">Improper Shoes Code</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {requiredComplianceFields.nazrulMaqam && (
                            <div className="col-span-1 sm:col-span-2 grid grid-cols-2 gap-3 items-end">
                              <div className="space-y-2">
                                <Label className="text-xs" htmlFor="nazrul-amount">Nazrul Maqam Amount</Label>
                                <Input
                                  id="nazrul-amount"
                                  type="number"
                                  placeholder="e.g. 500"
                                  value={nazrulMaqamAmount}
                                  onChange={(e) => setNazrulMaqamAmount(e.target.value)}
                                  className="h-8.5"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs" htmlFor="nazrul-currency">Currency</Label>
                                <Select value={nazrulMaqamCurrency} onValueChange={setNazrulMaqamCurrency}>
                                  <SelectTrigger id="nazrul-currency" className="h-8.5">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="KES">KES</SelectItem>
                                    <SelectItem value="USD">USD</SelectItem>
                                    <SelectItem value="INR">INR</SelectItem>
                                    <SelectItem value="GBP">GBP</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5 pt-2 border-t border-border/30">
                      <Label htmlFor="manual-note" className="text-xs">Reason / Note for log history</Label>
                      <Input
                        id="manual-note"
                        placeholder="e.g. Back-dated entry for traveler"
                        value={manualNote}
                        onChange={(e) => setManualNote(e.target.value)}
                        className="h-8.5"
                      />
                    </div>

                    <Button
                      onClick={handleMarkAttendance}
                      disabled={selectedMiqaatIds.length === 0 || isSaving || isOffline}
                      className="w-full mt-4 font-bold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/95 hover:to-primary/75 text-primary-foreground shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all duration-200 hover:-translate-y-[1px] active:translate-y-0"
                    >
                      {isSaving ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Marking Attendance...</>
                      ) : (
                        <><Check className="mr-2 h-4 w-4" />Confirm & Mark Attendance for ({selectedMiqaatIds.length}) Miqaats</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
              
              {!foundMember && (
                <div className="flex flex-col items-center justify-center p-8 rounded-lg border border-dashed text-muted-foreground">
                  <BadgeInfo className="h-8 w-8 text-muted-foreground/60 mb-2" />
                  <p className="text-sm">Please resolve a member above to select attendance actions.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
