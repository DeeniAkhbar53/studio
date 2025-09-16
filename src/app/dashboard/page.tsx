
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Users, CalendarCheck, ScanLine, Loader2, Camera, CheckCircle2, XCircle, AlertCircleIcon, SwitchCamera, FileText, UserX, Edit, X } from "lucide-react";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { UserRole, UserDesignation, Miqaat, MiqaatAttendanceEntryItem, Form as FormType, User } from "@/types";
import { getMiqaats, markAttendanceInMiqaat } from "@/lib/firebase/miqaatService";
import { getUsers, getUsersCount, getUserByItsOrBgkId as fetchUserByItsId } from "@/lib/firebase/userService";
import { getMohallahsCount } from "@/lib/firebase/mohallahService";
import { getForms, getFormResponsesForUser } from "@/lib/firebase/formService";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { DialogFooter } from "@/components/ui/dialog";
import Image from "next/image";
import Link from "next/link";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";


interface AdminStat {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  isLoading?: boolean;
}

interface ScanDisplayMessage {
  text: string;
  type: 'success' | 'error' | 'info';
  miqaatName?: string;
  time?: string;
  status?: 'present' | 'late' | 'early';
}

const TEAM_LEAD_DESIGNATIONS: UserDesignation[] = ["Captain", "Vice Captain", "Group Leader", "Asst.Grp Leader", "Major"];
const TOP_LEVEL_LEADERS: UserDesignation[] = ["Major", "Captain"];
const MID_LEVEL_LEADERS: UserDesignation[] = ["Vice Captain"];
const GROUP_LEVEL_LEADERS: UserDesignation[] = ["Group Leader", "Asst.Grp Leader"];
const qrReaderElementId = "qr-reader-dashboard";

export default function DashboardOverviewPage() {
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [currentUserDesignation, setCurrentUserDesignation] = useState<UserDesignation | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>("Valued Member");
  const [currentUserItsId, setCurrentUserItsId] = useState<string | null>(null);
  const [currentUserMohallahId, setCurrentUserMohallahId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const router = useRouter();

  const [activeMiqaatsCount, setActiveMiqaatsCount] = useState<number>(0);
  const [totalMiqaatsCount, setTotalMiqaatsCount] = useState<number>(0);
  const [allMiqaatsList, setAllMiqaatsList] = useState<Pick<Miqaat, "id" | "name" | "startTime" | "endTime" | "reportingTime" | "mohallahIds" | "teams" | "eligibleItsIds" | "location" | "barcodeData" | "attendance" | "attendanceRequirements">[]>([]);
  const [totalMembersCount, setTotalMembersCount] = useState<number>(0);
  const [totalMohallahsCount, setTotalMohallahsCount] = useState<number>(0);
  const [totalFormsCount, setTotalFormsCount] = useState<number>(0);
  const [activeFormsCount, setActiveFormsCount] = useState<number>(0);
  const [allForms, setAllForms] = useState<FormType[]>([]);


  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Absentee Notification State
  const [absenteeData, setAbsenteeData] = useState<{ miqaatName: string; absentees: User[] } | null>(null);
  const [isAbsenteeSheetOpen, setIsAbsenteeSheetOpen] = useState(false);
  const [isLoadingAbsentees, setIsLoadingAbsentees] = useState(false);
  const [isAbsenteeAlertOpen, setIsAbsenteeAlertOpen] = useState(true);
  
  // Non-Respondent Form State (New logic)
  const [formsWithNonRespondents, setFormsWithNonRespondents] = useState<FormType[]>([]);
  const [selectedFormForNonRespondents, setSelectedFormForNonRespondents] = useState<string | null>(null);
  const [nonRespondentList, setNonRespondentList] = useState<User[]>([]);
  const [isNonRespondentSheetOpen, setIsNonRespondentSheetOpen] = useState(false);
  const [isLoadingNonRespondents, setIsLoadingNonRespondents] = useState(false);
  const [isNonRespondentAlertOpen, setIsNonRespondentAlertOpen] = useState(true);

  // Pending Forms State
  const [pendingForms, setPendingForms] = useState<FormType[]>([]);
  const [isPendingFormsSheetOpen, setIsPendingFormsSheetOpen] = useState(false);
  const [isLoadingPendingForms, setIsLoadingPendingForms] = useState(false);
  const [isPendingFormsAlertOpen, setIsPendingFormsAlertOpen] = useState(true);


  const [isScannerDialogOpen, setIsScannerDialogOpen] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [scanDisplayMessage, setScanDisplayMessage] = useState<ScanDisplayMessage | null>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  const isTeamLead = useMemo(() => {
    if (!currentUserRole || !currentUserDesignation) return false;
    const isAdmin = currentUserRole === 'admin' || currentUserRole === 'superadmin';
    if (isAdmin) return true; // Treat admins as team leads for alert purposes
    const hasLeadershipDesignation = TEAM_LEAD_DESIGNATIONS.includes(currentUserDesignation);
    return hasLeadershipDesignation;
  }, [currentUserRole, currentUserDesignation]);


  useEffect(() => {
    const fetchCurrentUserData = async () => {
        const storedRole = localStorage.getItem('userRole') as UserRole | null;
        const storedDesignation = localStorage.getItem('userDesignation') as UserDesignation | null;
        const storedName = localStorage.getItem('userName');
        const storedItsId = localStorage.getItem('userItsId');
        const storedMohallahId = localStorage.getItem('userMohallahId');

        if (storedItsId && storedRole) {
            setCurrentUserRole(storedRole);
            setCurrentUserDesignation(storedDesignation);
            setCurrentUserItsId(storedItsId);
            setCurrentUserMohallahId(storedMohallahId);
            if (storedName) setCurrentUserName(storedName);

            try {
                const userDetails = await fetchUserByItsId(storedItsId);
                setCurrentUser(userDetails);
            } catch (error) {
                console.error("Failed to fetch full user details for dashboard:", error);
            }

            setIsLoadingUser(false);
        } else {
            // This prevents a redirect flicker if the component loads before localStorage is ready
            if (!isLoadingUser) {
                router.push('/');
            }
        }
    };
    fetchCurrentUserData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isLoadingUser || !currentUserItsId || !currentUserRole) {
      setIsLoadingStats(false);
      setAllMiqaatsList([]);
      setActiveMiqaatsCount(0);
      setTotalMembersCount(0);
      setTotalMohallahsCount(0);
      setTotalFormsCount(0);
      setActiveFormsCount(0);
      setAllForms([]);
      return;
    }

    setIsLoadingStats(true);
    let miqaatsLoaded = false;
    let formsLoaded = false;
    let adminCountsLoaded = !(currentUserRole === 'admin' || currentUserRole === 'superadmin');

    const checkAndSetLoadingDone = () => {
      if (miqaatsLoaded && adminCountsLoaded && formsLoaded) {
        setIsLoadingStats(false);
      }
    };

    const unsubscribeMiqaats = getMiqaats((fetchedMiqaats) => {
      let relevantMiqaats = fetchedMiqaats;
      if (currentUserRole === 'admin' && currentUserMohallahId) {
        relevantMiqaats = fetchedMiqaats.filter(m => 
          !m.mohallahIds?.length || m.mohallahIds.includes(currentUserMohallahId)
        );
      }
      setTotalMiqaatsCount(relevantMiqaats.length);
      setActiveMiqaatsCount(relevantMiqaats.filter(m => new Date(m.endTime) > new Date()).length);
      setAllMiqaatsList(relevantMiqaats);
      miqaatsLoaded = true;
      checkAndSetLoadingDone();
    });

    const fetchFormsData = async () => {
        try {
          const forms = await getForms();
          let relevantForms = forms;
          if (currentUserRole === 'admin' && currentUserMohallahId) {
            relevantForms = forms.filter(f => {
              const isForAllAssignedMohallahs = f.mohallahIds?.includes(currentUserMohallahId) || false;
              return isForAllAssignedMohallahs;
            });
          }
          setTotalFormsCount(relevantForms.length);
          setActiveFormsCount(relevantForms.filter(f => f.status === 'open' && (!f.endDate || new Date(f.endDate) > new Date())).length);
          setAllForms(relevantForms);
        } catch (err) {
            console.error("Failed to fetch forms stats", err);
        } finally {
            formsLoaded = true;
            checkAndSetLoadingDone();
        }
    };
    fetchFormsData();
    

    if (currentUserRole === 'admin' || currentUserRole === 'superadmin') {
      const fetchAdminData = async () => {
        try {
          const membersCountPromise = getUsersCount(currentUserRole === 'admin' ? currentUserMohallahId || undefined : undefined);
          const mohallahsCountPromise = currentUserRole === 'superadmin' ? getMohallahsCount() : Promise.resolve(0);
          const [membersCount, mohallahsCountValue] = await Promise.all([membersCountPromise, mohallahsCountPromise]);
          setTotalMembersCount(membersCount);
          if (currentUserRole === 'superadmin') {
            setTotalMohallahsCount(mohallahsCountValue);
          }
        } catch (err) {
          console.error("Failed to fetch admin dashboard counts", err);
        } finally {
          adminCountsLoaded = true;
          checkAndSetLoadingDone();
        }
      };
      fetchAdminData();
    } else {
      adminCountsLoaded = true; // For non-admin roles, counts are considered loaded
      checkAndSetLoadingDone();
    }

    return () => {
      unsubscribeMiqaats();
    };
  }, [isLoadingUser, currentUserItsId, currentUserRole, currentUserMohallahId]);

   // Effect for Team Lead Absentee Notifications
  useEffect(() => {
    if (!isTeamLead || allMiqaatsList.length === 0 || !currentUser) {
      return;
    }

    const checkAbsentees = async () => {
      setIsLoadingAbsentees(true);
      setAbsenteeData(null);
      try {
        const now = new Date();
        const pastMiqaats = allMiqaatsList
            .filter(m => new Date(m.endTime) < now)
            .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());

        if (pastMiqaats.length === 0) {
            setIsLoadingAbsentees(false);
            return;
        }

        const lastMiqaat = pastMiqaats[0];
        
        const allUsers = await getUsers();
        let baseVisibleUsers: User[];

        // Admin role is the highest priority for data filtering
        if (currentUser.role === 'admin' && currentUser.mohallahId) {
            baseVisibleUsers = allUsers.filter(u => u.mohallahId === currentUser.mohallahId);
        } else if (currentUser.role === 'superadmin') {
            baseVisibleUsers = allUsers; // Superadmin sees everyone
        } else if (currentUser.designation && (TOP_LEVEL_LEADERS.includes(currentUser.designation))) {
             baseVisibleUsers = allUsers.filter(u => u.mohallahId === currentUser.mohallahId);
        } else if (currentUser.designation && MID_LEVEL_LEADERS.includes(currentUser.designation) && currentUser.managedTeams) {
            const managedTeamsSet = new Set(currentUser.managedTeams);
            baseVisibleUsers = allUsers.filter(u => u.team && managedTeamsSet.has(u.team) && u.mohallahId === currentUser.mohallahId);
        } else if (currentUser.designation && GROUP_LEVEL_LEADERS.includes(currentUser.designation) && currentUser.team) {
            baseVisibleUsers = allUsers.filter(u => u.team === currentUser.team && u.mohallahId === currentUser.mohallahId);
        } else {
            setIsLoadingAbsentees(false);
            return; // Not a role that should see this alert
        }


        if(baseVisibleUsers.length === 0) {
            setIsLoadingAbsentees(false);
            return;
        }
        
        const isForEveryone = (!lastMiqaat.mohallahIds || lastMiqaat.mohallahIds.length === 0) && (!lastMiqaat.teams || lastMiqaat.teams.length === 0) && (!lastMiqaat.eligibleItsIds || lastMiqaat.eligibleItsIds.length === 0);
        
        const eligibleTeamMembers = baseVisibleUsers.filter(member => {
            if (lastMiqaat.eligibleItsIds && lastMiqaat.eligibleItsIds.length > 0) {
                return lastMiqaat.eligibleItsIds.includes(member.itsId);
            }
            if(isForEveryone) return true;
            let isEligible = false;
            if (lastMiqaat.mohallahIds && lastMiqaat.mohallahIds.length > 0) {
                isEligible = isEligible || (!!member.mohallahId && lastMiqaat.mohallahIds.includes(member.mohallahId));
            }
            if (lastMiqaat.teams && lastMiqaat.teams.length > 0) {
                isEligible = isEligible || (!!member.team && lastMiqaat.teams.includes(member.team));
            }
            if ((lastMiqaat.mohallahIds?.length || 0) + (lastMiqaat.teams?.length || 0) > 0) {
              return isEligible;
            }
            return isForEveryone;
        });

        const attendedItsIds = new Set(lastMiqaat.attendance?.map(a => a.userItsId) || []);
        
        const absentMembers = eligibleTeamMembers.filter(member => !attendedItsIds.has(member.itsId));

        if (absentMembers.length > 0) {
            setAbsenteeData({ miqaatName: lastMiqaat.name, absentees: absentMembers });
        }

      } catch (error) {
        console.error("Error checking for team absentees:", error);
      } finally {
        setIsLoadingAbsentees(false);
      }
    };
    checkAbsentees();

  }, [isTeamLead, allMiqaatsList, currentUser]);

  const fetchAndSetNonRespondents = useCallback(async () => {
    if (!isTeamLead || allForms.length === 0 || !currentUser) {
        return;
    }
    setIsLoadingNonRespondents(true);
    setFormsWithNonRespondents([]);

    try {
        const allUsers = await getUsers();
        const userResponses = await getFormResponsesForUser(currentUser.itsId);
        const respondedFormIds = new Set(userResponses.map(r => r.formId));
        
        const activeForms = allForms.filter(f => f.status === 'open' && (!f.endDate || new Date(f.endDate) > new Date()));
        
        let visibleUsers: User[] = [];
        if (currentUser.role === 'admin' && currentUser.mohallahId) {
            visibleUsers = allUsers.filter(u => u.mohallahId === currentUser.mohallahId);
        } else if (currentUser.role === 'superadmin') {
            visibleUsers = allUsers;
        } else if (currentUser.designation && TEAM_LEAD_DESIGNATIONS.includes(currentUser.designation)) {
            if (TOP_LEVEL_LEADERS.includes(currentUser.designation)) {
                visibleUsers = allUsers.filter(u => u.mohallahId === currentUser.mohallahId);
            } else if (MID_LEVEL_LEADERS.includes(currentUser.designation) && currentUser.managedTeams) {
                const managedTeamsSet = new Set(currentUser.managedTeams);
                visibleUsers = allUsers.filter(u => u.team && managedTeamsSet.has(u.team) && u.mohallahId === currentUser.mohallahId);
            } else if (GROUP_LEVEL_LEADERS.includes(currentUser.designation) && currentUser.team) {
                visibleUsers = allUsers.filter(u => u.team === currentUser.team && u.mohallahId === currentUser.mohallahId);
            }
        }

        const formsWithMissing = activeForms.filter(form => {
            const eligibleUsersForForm = visibleUsers.filter(user => {
                const isForEveryone = !form.mohallahIds?.length && !form.teams?.length && !form.eligibleItsIds?.length;
                if (isForEveryone) return true;
                const inMohallah = form.mohallahIds?.includes(user.mohallahId || '');
                const inTeam = form.teams?.includes(user.team || '');
                const inItsId = form.eligibleItsIds?.includes(user.itsId);
                return !!(inMohallah || inTeam || inItsId);
            });

            if (eligibleUsersForForm.length === 0) return false;

            const respondedItsIds = new Set();
            (form as any).responses?.forEach((resp: any) => respondedItsIds.add(resp.submittedBy));
            const hasNonRespondents = eligibleUsersForForm.some(user => !respondedItsIds.has(user.itsId));

            return hasNonRespondents;
        });

        setFormsWithNonRespondents(formsWithMissing);

    } catch (error) {
        console.error("Error checking for form non-respondents:", error);
    } finally {
        setIsLoadingNonRespondents(false);
    }
  }, [isTeamLead, allForms, currentUser]);

  useEffect(() => {
    fetchAndSetNonRespondents();
  }, [fetchAndSetNonRespondents]);

  const handleNonRespondentFormSelect = async (formId: string) => {
    setSelectedFormForNonRespondents(formId);
    setNonRespondentList([]);
    if (!formId) return;

    try {
        const selectedForm = allForms.find(f => f.id === formId);
        if (!selectedForm) return;

        const allUsers = await getUsers();
        const userResponses = await getFormResponsesForUser(currentUser.itsId); // This may not be correct
        const allFormResponses = await getFormResponsesForUser(formId); // Need a way to get all responses for a form
        const respondedItsIds = new Set(allFormResponses.map(r => r.submittedBy));
        
        let visibleUsers: User[] = [];
         if (currentUser.role === 'admin' && currentUser.mohallahId) {
            visibleUsers = allUsers.filter(u => u.mohallahId === currentUser.mohallahId);
        } else if (currentUser.role === 'superadmin') {
            visibleUsers = allUsers;
        } else if (currentUser.designation && TEAM_LEAD_DESIGNATIONS.includes(currentUser.designation)) {
            if (TOP_LEVEL_LEADERS.includes(currentUser.designation)) {
                visibleUsers = allUsers.filter(u => u.mohallahId === currentUser.mohallahId);
            } else if (MID_LEVEL_LEADERS.includes(currentUser.designation) && currentUser.managedTeams) {
                const managedTeamsSet = new Set(currentUser.managedTeams);
                visibleUsers = allUsers.filter(u => u.team && managedTeamsSet.has(u.team) && u.mohallahId === currentUser.mohallahId);
            } else if (GROUP_LEVEL_LEADERS.includes(currentUser.designation) && currentUser.team) {
                visibleUsers = allUsers.filter(u => u.team === currentUser.team && u.mohallahId === currentUser.mohallahId);
            }
        }
        
        const nonRespondents = visibleUsers.filter(user => {
            const isForEveryone = !selectedForm.mohallahIds?.length && !selectedForm.teams?.length && !selectedForm.eligibleItsIds?.length;
            if (!isForEveryone) {
                const inMohallah = selectedForm.mohallahIds?.includes(user.mohallahId || '');
                const inTeam = selectedForm.teams?.includes(user.team || '');
                const inItsId = selectedForm.eligibleItsIds?.includes(user.itsId);
                if (!inMohallah && !inTeam && !inItsId) return false;
            }
            return !respondedItsIds.has(user.itsId);
        });

        setNonRespondentList(nonRespondents);

    } catch (e) { console.error("Could not load non-respondents for selected form", e)}
  };
  
  // Effect for User's Pending Forms
  useEffect(() => {
    if (isLoadingUser || !currentUser) return;
    setIsLoadingPendingForms(true);

    const checkPendingForms = async () => {
        try {
            const allActiveForms = allForms.filter(f => f.status === 'open' && (!f.endDate || new Date(f.endDate) > new Date()));
            if(allActiveForms.length === 0) {
                setPendingForms([]);
                setIsLoadingPendingForms(false);
                return;
            }
            const userResponses = await getFormResponsesForUser(currentUser.itsId);
            const respondedFormIds = new Set(userResponses.map(r => r.formId));

            const formsToFill = allActiveForms.filter(form => {
                if (respondedFormIds.has(form.id)) return false;
                
                const isForEveryone = !form.mohallahIds?.length && !form.teams?.length && !form.eligibleItsIds?.length;
                if (isForEveryone) return true;

                const eligibleById = form.eligibleItsIds?.includes(currentUser.itsId) || false;
                const eligibleByTeam = !!currentUser.team && (form.teams?.includes(currentUser.team) || false);
                const eligibleByMohallah = !!currentUser.mohallahId && (form.mohallahIds?.includes(currentUser.mohallahId) || false);

                return eligibleById || eligibleByTeam || eligibleByMohallah;
            });

            setPendingForms(formsToFill);

        } catch (error) {
            console.error("Error fetching user's pending forms:", error);
        } finally {
            setIsLoadingPendingForms(false);
        }
    };
    checkPendingForms();

  }, [isLoadingUser, currentUser, allForms]);


  const handleQrCodeScanned = useCallback(async (decodedText: string) => {
    if (!currentUserItsId || !currentUserName) {
      console.error("User details not found for QR scan processing.");
      setScanDisplayMessage({ type: 'error', text: "User details not found. Please log in again." });
      setIsProcessingScan(false);
      setIsScannerDialogOpen(false);
      return;
    }

    setIsProcessingScan(true);
    setScanDisplayMessage(null);

    const targetMiqaat = allMiqaatsList.find(m => m.id === decodedText || m.barcodeData === decodedText);

    if (!targetMiqaat) {
      setScanDisplayMessage({ type: 'error', text: `Miqaat not found for scanned data.` });
      setIsProcessingScan(false);
      setIsScannerDialogOpen(false);
      return;
    }
    
    const now = new Date();
    const miqaatStartTime = new Date(targetMiqaat.startTime);
    if (now < miqaatStartTime) {
        setScanDisplayMessage({ type: 'error', text: `This Miqaat (${targetMiqaat.name}) has not started yet.` });
        setIsProcessingScan(false);
        setIsScannerDialogOpen(false);
        return;
    }

    const miqaatEndTime = new Date(targetMiqaat.endTime);

    if (now > miqaatEndTime) {
      setScanDisplayMessage({ type: 'error', text: `This Miqaat (${targetMiqaat.name}) has ended and is no longer accepting attendance.` });
      setIsProcessingScan(false);
      setIsScannerDialogOpen(false);
      return;
    }

    const uniformReqs = targetMiqaat.attendanceRequirements;
    const isUniformRequired = uniformReqs && (uniformReqs.fetaPaghri || uniformReqs.koti);

    if (isUniformRequired) {
      setScanDisplayMessage({ type: 'error', text: `This Miqaat (${targetMiqaat.name}) requires a manual check-in by management. Please see an attendance marker.` });
      setIsProcessingScan(false);
      setIsScannerDialogOpen(false);
      return;
    }

    let isEligible = false;
    if (targetMiqaat.eligibleItsIds && targetMiqaat.eligibleItsIds.length > 0) {
      isEligible = targetMiqaat.eligibleItsIds.includes(currentUserItsId);
    } else {
      isEligible = !targetMiqaat.mohallahIds || targetMiqaat.mohallahIds.length === 0 || (!!currentUserMohallahId && targetMiqaat.mohallahIds.includes(currentUserMohallahId));
    }


    if (!isEligible) {
      setScanDisplayMessage({ type: 'error', text: `Not eligible for Miqaat: ${targetMiqaat.name}.` });
      setIsProcessingScan(false);
      setIsScannerDialogOpen(false);
      return;
    }

    const alreadyMarked = targetMiqaat.attendance?.some(entry => entry.userItsId === currentUserItsId);
    if (alreadyMarked) {
      const existingEntry = targetMiqaat.attendance?.find(entry => entry.userItsId === currentUserItsId);
      setScanDisplayMessage({ type: 'info', text: `Already marked for ${targetMiqaat.name} (${existingEntry?.status || 'present'}).`, miqaatName: targetMiqaat.name, time: format(new Date(existingEntry?.markedAt || Date.now()), "PPp"), status: existingEntry?.status });
      setIsProcessingScan(false);
      setIsScannerDialogOpen(false);
      return;
    }

    
    const miqaatReportingTime = targetMiqaat.reportingTime ? new Date(targetMiqaat.reportingTime) : null;
    
    let attendanceStatus: 'early' | 'present' | 'late';
    if (miqaatReportingTime && now < miqaatReportingTime) {
      attendanceStatus = 'early';
    } else if (now > miqaatEndTime) {
      attendanceStatus = 'late';
    } else {
      attendanceStatus = 'present';
    }

    try {
      const attendanceEntry: MiqaatAttendanceEntryItem = {
        userItsId: currentUserItsId,
        userName: currentUserName,
        markedAt: now.toISOString(),
        markedByItsId: currentUserItsId,
        status: attendanceStatus,
      };

      await markAttendanceInMiqaat(targetMiqaat.id, attendanceEntry);
      setAllMiqaatsList(prev => prev.map(m => m.id === targetMiqaat.id ? { ...m, attendance: [...(m.attendance || []), attendanceEntry] } : m));
      setScanDisplayMessage({
        type: 'success',
        text: `Attendance marked ${attendanceStatus === 'late' ? '(Late)' : ''} successfully for ${targetMiqaat.name} at ${format(now, "p")}.`,
        miqaatName: targetMiqaat.name,
        time: format(now, "PPp"),
        status: attendanceStatus,
      });
    } catch (error) {
      console.error("Error marking attendance from scanner:", error);
      setScanDisplayMessage({ type: 'error', text: `Failed to mark attendance for ${targetMiqaat.name}. ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      setIsProcessingScan(false);
      setIsScannerDialogOpen(false);
    }
  }, [currentUserItsId, currentUserName, currentUserMohallahId, allMiqaatsList]);


  useEffect(() => {
    let initDelay: NodeJS.Timeout;
    let scannerInstance: Html5Qrcode | null = null;

    if (isScannerDialogOpen) {
      setScannerError(null);
      setIsScannerActive(false);

      initDelay = setTimeout(() => {
        const qrReaderDiv = document.getElementById(qrReaderElementId);
        if (!qrReaderDiv) {
          console.error("QR Reader DOM element not found.");
          setScannerError("Scanner UI element not found. Please refresh.");
          return;
        }
        qrReaderDiv.innerHTML = '';

        try {
          console.log("Attempting to initialize Html5Qrcode instance...");
          scannerInstance = new Html5Qrcode(qrReaderElementId, { verbose: false });
          html5QrCodeRef.current = scannerInstance;

          const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };
          
          console.log(`Starting scanner with facingMode: ${facingMode}`);
          scannerInstance.start(
            { facingMode: facingMode },
            config,
            (decodedText, decodedResult) => {
              console.log("QR Code Scanned:", decodedText);
              if (html5QrCodeRef.current?.getState() === Html5QrcodeScannerState.SCANNING) {
                 html5QrCodeRef.current.stop().catch(err => {
                  console.warn("Scanner stop error on successful scan:", err);
                });
              }
              setIsScannerActive(false);
              handleQrCodeScanned(decodedText);
            },
            (errorMessageFromLib) => {
               console.debug("QR Scan frame error/info:", errorMessageFromLib);
            }
          )
            .then(() => {
              console.log("Scanner started successfully.");
              setIsScannerActive(true);
              setScannerError(null);
            })
            .catch((err) => {
              let errorMsg = "Could not start camera.";
              if (err instanceof Error) {
                errorMsg = `${errorMsg} (${err.name}): ${err.message}.`;
                if (err.name === "NotAllowedError") errorMsg = "Camera permission denied. Please enable it in browser settings.";
                else if (err.name === "NotFoundError") errorMsg = "No camera found or the selected camera is not available for the current facing mode.";
              } else {
                errorMsg = `${errorMsg} An unknown error occurred. Details: ${String(err)}`;
              }
              console.error("Error starting QR scanner:", err, errorMsg);
              setScannerError(errorMsg);
              setIsScannerActive(false);
              if (html5QrCodeRef.current?.getState() === Html5QrcodeScannerState.SCANNING) {
                html5QrCodeRef.current.stop().catch(stopErr => console.warn("Defensive stop failed after start error:", stopErr));
              }
            });
        } catch (initError) {
          let errorMsg = "Scanner component failed to load.";
          if (initError instanceof Error) {
            errorMsg = `${errorMsg} ${initError.message}`;
          } else {
            errorMsg = `${errorMsg} Details: ${String(initError)}`;
          }
          console.error("Failed to initialize Html5Qrcode instance:", initError, errorMsg);
          setScannerError(errorMsg);
          setIsScannerActive(false);
        }
      }, 100);
    } else {
      if (html5QrCodeRef.current && html5QrCodeRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
        console.log("Scanner dialog closed by onOpenChange or external state, stopping scanner.");
        html5QrCodeRef.current.stop()
          .then(() => console.log("Scanner stopped: dialog closed via onOpenChange."))
          .catch(err => console.error("Error stopping scanner on dialog onOpenChange close:", err));
      }
      setIsScannerActive(false);
      setIsProcessingScan(false);
      setScannerError(null);
    }

    return () => {
      clearTimeout(initDelay);
      const currentScanner = html5QrCodeRef.current;
      if (currentScanner && currentScanner.getState() === Html5QrcodeScannerState.SCANNING) {
        console.log("Scanner effect cleanup: stopping scanner.");
        currentScanner.stop()
          .then(() => console.log("Scanner stopped: effect cleanup."))
          .catch(err => console.error("Error stopping scanner in effect cleanup:", err));
      }
    };
  }, [isScannerDialogOpen, facingMode, handleQrCodeScanned]);

  useEffect(() => {
    const scannerOnUnmount = html5QrCodeRef.current;
    return () => {
      if (scannerOnUnmount && scannerOnUnmount.getState() === Html5QrcodeScannerState.SCANNING) {
        console.log("Component unmounting: stopping scanner.");
        scannerOnUnmount.stop()
          .then(() => console.log("Scanner stopped: component unmount."))
          .catch(err => console.error("Error stopping scanner on component unmount:", err));
      }
    };
  }, []);

  const handleSwitchCamera = () => {
    if (isProcessingScan || !isScannerDialogOpen) return;
    setFacingMode(prevMode => (prevMode === 'user' ? 'environment' : 'user'));
  };


  const attendanceMarkerStats: AdminStat[] = [
    { title: "Active Miqaats", value: activeMiqaatsCount, icon: CalendarCheck, isLoading: isLoadingStats },
    { title: "Total Miqaats", value: totalMiqaatsCount, icon: CalendarCheck, isLoading: isLoadingStats },
    { title: "Active Forms", value: activeFormsCount, icon: FileText, isLoading: isLoadingStats },
    { title: "Total Forms", value: totalFormsCount, icon: FileText, isLoading: isLoadingStats },
  ];

  const adminOverviewStats: AdminStat[] = [
    ...attendanceMarkerStats,
    { title: "Total Members", value: totalMembersCount, icon: Users, isLoading: isLoadingStats, trend: currentUserRole === 'admin' ? "In your Mohallah" : "System-wide" },
  ];

  if (currentUserRole === 'superadmin') {
    adminOverviewStats.splice(5, 0, { title: "Total Mohallahs", value: totalMohallahsCount, icon: Users, isLoading: isLoadingStats });
  }

  const statsToDisplay = (currentUserRole === 'admin' || currentUserRole === 'superadmin' || currentUserRole === 'attendance-marker' || isTeamLead) ? adminOverviewStats : [];
  
  if (currentUserRole === 'attendance-marker') {
      statsToDisplay.splice(4, 2);
  }

  const shouldRenderMiqaatAlert = isTeamLead && !isLoadingAbsentees && (absenteeData && isAbsenteeAlertOpen);
  const shouldRenderFormAlert = pendingForms.length > 0 && isPendingFormsAlertOpen && !isTeamLead;
  const shouldRenderNonRespondentAlert = isTeamLead && !isLoadingNonRespondents && formsWithNonRespondents.length > 0 && isNonRespondentAlertOpen;


  if (isLoadingUser && !currentUserItsId) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading user data...</p>
      </div>
    );
  }

  if (!currentUserItsId && !isLoadingUser) {
    return null; 
  }

  return (
    <div className="flex flex-col h-full">
       <div className="flex-grow space-y-6">
          {(shouldRenderMiqaatAlert || shouldRenderFormAlert || shouldRenderNonRespondentAlert) && (
          <div className="space-y-4">
            {shouldRenderMiqaatAlert && absenteeData && (
              <Alert variant="destructive" className="relative">
                <UserX className="h-4 w-4" />
                <AlertTitle>Miqaat Attendance Alert</AlertTitle>
                <AlertDescription className="flex justify-between items-center pr-8">
                  <span>
                    For <span className="font-semibold">{absenteeData.miqaatName}</span>, you have <span className="font-bold">{absenteeData.absentees.length}</span> absent member(s).
                  </span>
                  <Button variant="destructive" size="sm" onClick={() => setIsAbsenteeSheetOpen(true)} className="ml-4">View List</Button>
                </AlertDescription>
                <button onClick={() => setIsAbsenteeAlertOpen(false)} className="absolute top-2 right-2 p-1 rounded-full text-destructive/70 hover:text-destructive hover:bg-destructive/10">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </button>
              </Alert>
            )}

            {shouldRenderNonRespondentAlert && (
              <Alert variant="default" className="relative border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200 dark:border-amber-500/30">
                <FileText className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                <AlertTitle className="text-amber-800 dark:text-amber-200">Form Non-Respondent Alert</AlertTitle>
                <AlertDescription className="flex justify-between items-center pr-8 text-amber-700 dark:text-amber-300">
                  <span>
                    You have non-respondents for <span className="font-bold">{formsWithNonRespondents.length}</span> active form(s).
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setIsNonRespondentSheetOpen(true)} className="ml-4 border-amber-500/50 hover:bg-amber-500/20">View List</Button>
                </AlertDescription>
                <button onClick={() => setIsNonRespondentAlertOpen(false)} className="absolute top-2 right-2 p-1 rounded-full text-amber-700/70 hover:text-amber-700 hover:bg-amber-500/10">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </button>
              </Alert>
            )}
            
            {shouldRenderFormAlert && (
               <Alert variant="default" className="relative border-blue-500/50 bg-blue-500/10 text-blue-800 dark:text-blue-200 dark:border-blue-500/30">
                <FileText className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                <AlertTitle className="text-blue-800 dark:text-blue-200">Pending Forms</AlertTitle>
                <AlertDescription className="flex justify-between items-center pr-8 text-blue-700 dark:text-blue-300">
                  <span>
                    You have <span className="font-bold">{pendingForms.length}</span> form(s) that need to be filled out.
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setIsPendingFormsSheetOpen(true)} className="ml-4 border-blue-500/50 hover:bg-blue-500/20">View Forms</Button>
                </AlertDescription>
                <button onClick={() => setIsPendingFormsAlertOpen(false)} className="absolute top-2 right-2 p-1 rounded-full text-blue-700/70 hover:text-blue-700 hover:bg-blue-500/10">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </button>
              </Alert>
            )}
          </div>
        )}
      
        <Card className="shadow-lg bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-foreground">
                Welcome, {currentUserName}!
            </CardTitle>
            <CardDescription className="text-muted-foreground text-base mt-1">
                {currentUserDesignation && <span>{currentUserDesignation}</span>}
                {currentUserRole && <span> ({currentUserRole.charAt(0).toUpperCase() + currentUserRole.slice(1).replace(/-/g, ' ')})</span>}
            </CardDescription>
            <Separator className="my-4" />
            <CardDescription className="text-muted-foreground pt-1">
              Here's your overview. Use the sidebar to navigate to other sections.
            </CardDescription>
          </CardHeader>
          {currentUserRole === 'user' && (
            <CardContent>
              <p className="text-foreground">Please ensure you are on time for all Miqaats. Use the scanner button for quick check-in.</p>
            </CardContent>
          )}
        </Card>

        {scanDisplayMessage && (
          <Alert variant={scanDisplayMessage.type === 'error' ? 'destructive' : 'default'} className={`mt-4 ${scanDisplayMessage.type === 'success' ? 'border-green-500 bg-green-50 dark:bg-green-900/30' : scanDisplayMessage.type === 'info' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : ''}`}>
            {scanDisplayMessage.type === 'success' && <CheckCircle2 className="h-4 w-4" />}
            {scanDisplayMessage.type === 'error' && <XCircle className="h-4 w-4" />}
            {scanDisplayMessage.type === 'info' && <AlertCircleIcon className="h-4 w-4" />}
            <AlertTitle>
              {scanDisplayMessage.type === 'success' ? `Scan Successful ${scanDisplayMessage.status === 'late' ? '(Late)' : (scanDisplayMessage.status === 'early' ? '(Early)' : '')}` : scanDisplayMessage.type === 'error' ? "Scan Error" : "Scan Info"}
            </AlertTitle>
            <AlertDescription>{scanDisplayMessage.text}</AlertDescription>
          </Alert>
        )}

        {(currentUserRole === 'admin' || currentUserRole === 'superadmin' || currentUserRole === 'attendance-marker' || isTeamLead) && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {statsToDisplay.map((stat) => (
              <Card key={stat.title} className="shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground break-words">{stat.title}</CardTitle>
                  <stat.icon className="h-5 w-5 text-accent shrink-0" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground break-all">
                    {stat.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stat.value}
                  </div>
                  {stat.trend && <p className="text-xs text-muted-foreground break-words">{stat.trend}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {(isLoadingStats && (currentUserRole === 'admin' || currentUserRole === 'superadmin' || currentUserRole === 'attendance-marker' || isTeamLead)) && (
          <div className="flex justify-center items-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Loading system data...</p>
          </div>
        )}
      </div>
      <Button
        onClick={() => { setScanDisplayMessage(null); setScannerError(null); setIsScannerDialogOpen(true); }}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 bg-primary hover:bg-primary/90 text-primary-foreground"
        size="icon"
        aria-label="Scan Attendance"
      >
        <ScanLine className="h-6 w-6" />
      </Button>

      <Dialog open={isScannerDialogOpen} onOpenChange={(open) => {
        setIsScannerDialogOpen(open);
        if (!open) {
          if (html5QrCodeRef.current && html5QrCodeRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
            html5QrCodeRef.current.stop()
              .then(() => console.log("Scanner stopped: dialog closed via onOpenChange."))
              .catch(err => console.error("Error stopping scanner on dialog onOpenChange close:", err));
          }
          setIsScannerActive(false);
          setIsProcessingScan(false);
          setScannerError(null);
        }
      }}>
        <DialogContent className="sm:max-w-md p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center"><Camera className="mr-2 h-5 w-5" />Scan Miqaat Barcode</DialogTitle>
            <DialogDescription className="pt-1">
              Point your camera at the Miqaat QR code.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 space-y-3">
            <div id={qrReaderElementId} className="w-full aspect-square bg-muted rounded-md overflow-hidden flex items-center justify-center text-sm text-muted-foreground">
              {/* html5-qrcode will inject camera view here */}
            </div>
            {scannerError && (
              <Alert variant="destructive">
                <AlertCircleIcon className="h-4 w-4" />
                <AlertTitle>Scanner Error</AlertTitle>
                <AlertDescription>{scannerError}</AlertDescription>
              </Alert>
            )}
            {!isScannerActive && !scannerError && !isProcessingScan && isScannerDialogOpen && (
              <div className="text-center text-muted-foreground py-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
                <p>Initializing Camera...</p>
              </div>
            )}
            {isScannerActive && !isProcessingScan && (
              <div className="text-center text-green-600 py-2">
                <p>Scanning...</p>
              </div>
            )}
            {isProcessingScan && (
              <div className="text-center text-blue-600 py-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
                <p>Processing Scan...</p>
              </div>
            )}
          </div>
          <DialogFooter className="p-4 pt-2 flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={handleSwitchCamera} disabled={isProcessingScan || !isScannerDialogOpen || !isScannerActive}>
              <SwitchCamera className="mr-2 h-4 w-4" /> Switch Camera
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={isAbsenteeSheetOpen} onOpenChange={setIsAbsenteeSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Absentee List for {absenteeData?.miqaatName}</SheetTitle>
            <SheetDescription>
              The following members from your team(s) were marked absent.
            </SheetDescription>
          </SheetHeader>
          <div className="max-h-[80vh] overflow-y-auto my-4 pr-4">
            {absenteeData && absenteeData.absentees.length > 0 ? (
              <ul className="space-y-2">
                {absenteeData.absentees.map(member => (
                  <li key={member.id} className="flex justify-between items-center p-2 rounded-md border">
                    <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-xs text-muted-foreground">BGK: {member.bgkId || 'N/A'}</p>
                    </div>
                    <span className="text-sm text-muted-foreground">ITS: {member.itsId}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-center">No absentees to display.</p>
            )}
          </div>
          <SheetFooter>
             <Button onClick={() => setIsAbsenteeSheetOpen(false)}>Close</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={isNonRespondentSheetOpen} onOpenChange={setIsNonRespondentSheetOpen}>
          <SheetContent className="w-full sm:max-w-lg">
              <SheetHeader>
                  <SheetTitle>Non-Respondent List</SheetTitle>
                  <SheetDescription>
                      Select a form to see which members have not yet responded.
                  </SheetDescription>
              </SheetHeader>
              <div className="py-4 space-y-4">
                  <Select onValueChange={handleNonRespondentFormSelect} value={selectedFormForNonRespondents || ""}>
                      <SelectTrigger>
                          <SelectValue placeholder="Select an active form..." />
                      </SelectTrigger>
                      <SelectContent>
                          {formsWithNonRespondents.map(form => (
                              <SelectItem key={form.id} value={form.id}>
                                  {form.title}
                              </SelectItem>
                          ))}
                      </SelectContent>
                  </Select>

                  <Separator />
                  
                  <div className="max-h-[60vh] overflow-y-auto pr-2">
                      {selectedFormForNonRespondents ? (
                          nonRespondentList.length > 0 ? (
                              <ul className="space-y-2">
                                  {nonRespondentList.map(member => (
                                      <li key={member.id} className="flex justify-between items-center p-2 rounded-md border">
                                          <div>
                                              <p className="font-medium">{member.name}</p>
                                              <p className="text-xs text-muted-foreground">Team: {member.team || 'N/A'}</p>
                                          </div>
                                          <span className="text-sm text-muted-foreground">ITS: {member.itsId}</span>
                                      </li>
                                  ))}
                              </ul>
                          ) : (
                              <p className="text-center text-muted-foreground py-4">
                                  All eligible members in your scope have responded to this form.
                              </p>
                          )
                      ) : (
                          <p className="text-center text-muted-foreground py-4">Please select a form to view the list.</p>
                      )}
                  </div>
              </div>
              <SheetFooter>
                  <Button onClick={() => setIsNonRespondentSheetOpen(false)}>Close</Button>
              </SheetFooter>
          </SheetContent>
      </Sheet>
      
      <Sheet open={isPendingFormsSheetOpen} onOpenChange={setIsPendingFormsSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Pending Forms To-Do List</SheetTitle>
            <SheetDescription>
              You have {pendingForms.length} form(s) that need to be filled out.
            </SheetDescription>
          </SheetHeader>
          <div className="max-h-[80vh] overflow-y-auto my-4 pr-4">
            {isLoadingPendingForms ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : pendingForms.length > 0 ? (
              <ul className="space-y-3">
                {pendingForms.map(form => (
                  <li key={form.id}>
                    <Link href={`/dashboard/forms/${form.id}`} onClick={() => setIsPendingFormsSheetOpen(false)} className="block p-3 rounded-md border hover:bg-accent transition-colors">
                        <p className="font-medium">{form.title}</p>
                        <p className="text-xs text-muted-foreground">
                            {form.endDate ? `Due: ${format(new Date(form.endDate), "PP")}` : "No deadline"}
                        </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-center">You're all caught up! No pending forms.</p>
            )}
          </div>
          <SheetFooter>
             <Button onClick={() => setIsPendingFormsSheetOpen(false)}>Close</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

    </div>
  );
}

