

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Users, CalendarCheck, ScanLine, Loader2, Camera, CheckCircle2, XCircle, AlertCircleIcon, SwitchCamera, FileText, UserX, Edit, X, CalendarClock, CalendarDays, FilePenLine, Files, Building, BarChart2, ExternalLink, BookOpen } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  ChartContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ChartTooltip,
  ChartLegendContent,
  ChartLegend,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { UserRole, UserDesignation, Miqaat, MiqaatAttendanceEntryItem, Form as FormType, User } from "@/types";
import { getMiqaats, markAttendanceInMiqaat } from "@/lib/firebase/miqaatService";
import { getUsers, getUsersCount, getUserByItsOrBgkId as fetchUserByItsId, checkDuaForWeek } from "@/lib/firebase/userService";
import { getMohallahsCount } from "@/lib/firebase/mohallahService";
import { getForms, getFormResponsesForUser, getFormResponses } from "@/lib/firebase/formService";
import { getFeatureFlags } from "@/lib/firebase/settingsService";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { DialogFooter } from "@/components/ui/dialog";
import Image from "next/image";
import Link from "next/link";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { FunkyLoader } from "@/components/ui/funky-loader";


interface AdminStat {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  isLoading: boolean;
}

interface ScanDisplayMessage {
  text: string;
  type: 'success' | 'error' | 'info';
  miqaatName?: string;
  time?: string;
  status?: 'present' | 'late' | 'early';
}

interface DashboardAlert {
    id: string;
    type: 'miqaat' | 'form-non-respondent' | 'form-pending' | 'dua-pending';
    title: string;
    description: string;
    action: () => void;
    actionLabel: string;
    variant: 'destructive' | 'default';
    icon: React.ElementType;
}

const TEAM_LEAD_DESIGNATIONS: UserDesignation[] = ["Captain", "Vice Captain", "Group Leader", "Asst.Grp Leader", "Major"];
const TOP_LEVEL_LEADERS: UserDesignation[] = ["Major", "Captain"];
const MID_LEVEL_LEADERS: UserDesignation[] = ["Vice Captain"];
const GROUP_LEVEL_LEADERS: UserDesignation[] = ["Group Leader", "Asst.Grp Leader"];
const qrReaderElementId = "qr-reader-dashboard";

type ChartDataItem = {
  name: string;
  present: number;
  late: number;
  absent: number;
};
const chartConfig = {
  present: { label: "Present", color: "hsl(var(--primary))" },
  late: { label: "Late", color: "hsl(var(--accent))" },
  absent: { label: "Absent", color: "hsl(var(--destructive) / 0.5)" },
};


export default function DashboardOverviewPage() {
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [currentUserDesignation, setCurrentUserDesignation] = useState<UserDesignation | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>("Valued Member");
  const [currentUserItsId, setCurrentUserItsId] = useState<string | null>(null);
  const [currentUserMohallahId, setCurrentUserMohallahId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const router = useRouter();

  const [stats, setStats] = useState({
    activeMiqaatsCount: 0,
    totalMiqaatsCount: 0,
    totalMembersCount: 0,
    totalMohallahsCount: 0,
    activeFormsCount: 0,
    totalFormsCount: 0,
  });

  const [loadingStats, setLoadingStats] = useState({
    miqaats: true,
    members: true,
    mohallahs: true,
    forms: true,
  });

  const [allMiqaatsList, setAllMiqaatsList] = useState<Pick<Miqaat, "id" | "name" | "type" | "startTime" | "endTime" | "reportingTime" | "mohallahIds" | "teams" | "eligibleItsIds" | "location" | "barcodeData" | "attendance" | "attendanceRequirements" | "sessions">[]>([]);
  const [allForms, setAllForms] = useState<FormType[]>([]);
  const [isBarcodeScanningEnabled, setIsBarcodeScanningEnabled] = useState(true);


  // Absentee Notification State
  const [absenteeData, setAbsenteeData] = useState<Map<string, { miqaatName: string; absentees: User[] }>>(new Map());
  const [isAbsenteeSheetOpen, setIsAbsenteeSheetOpen] = useState(false);
  const [isLoadingAbsentees, setIsLoadingAbsentees] = useState(false);
  const [selectedMiqaatForAbsentees, setSelectedMiqaatForAbsentees] = useState<string | null>(null);
  
  // Non-Respondent Form State (New logic)
  const [formsWithNonRespondents, setFormsWithNonRespondents] = useState<FormType[]>([]);
  const [selectedFormForNonRespondents, setSelectedFormForNonRespondents] = useState<string | null>(null);
  const [nonRespondentList, setNonRespondentList] = useState<User[]>([]);
  const [isNonRespondentSheetOpen, setIsNonRespondentSheetOpen] = useState(false);
  const [isLoadingNonRespondents, setIsLoadingNonRespondents] = useState(false);

  // Pending Forms State
  const [pendingForms, setPendingForms] = useState<FormType[]>([]);
  const [isPendingFormsSheetOpen, setIsPendingFormsSheetOpen] = useState(false);
  const [isLoadingPendingForms, setIsLoadingPendingForms] = useState(false);
  
  // Dua Pending State
  const [isDuaPending, setIsDuaPending] = useState(false);
  const [isLoadingDuaStatus, setIsLoadingDuaStatus] = useState(true);

  const [dashboardAlerts, setDashboardAlerts] = useState<DashboardAlert[]>([]);


  const [isScannerDialogOpen, setIsScannerDialogOpen] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [scanDisplayMessage, setScanDisplayMessage] = useState<ScanDisplayMessage | null>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  const [attendanceChartData, setAttendanceChartData] = useState<ChartDataItem[] | null>(null);
  const [isLoadingChartData, setIsLoadingChartData] = useState(true);

  const [activeFormsWithResponses, setActiveFormsWithResponses] = useState< (FormType & { responseRate: number, nonRespondentCount: number })[] | null >(null);
  const [isLoadingFormsData, setIsLoadingFormsData] = useState(true);


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
                
                const flags = await getFeatureFlags();
                setIsBarcodeScanningEnabled(flags.isBarcodeScanningEnabled);

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
    if (isLoadingUser || !currentUserItsId || !currentUserRole) return;

    // Fetch Miqaats
    const unsubscribeMiqaats = getMiqaats((fetchedMiqaats) => {
      let relevantMiqaats = fetchedMiqaats;
      if (currentUserRole === 'admin' && currentUserMohallahId) {
        relevantMiqaats = fetchedMiqaats.filter(m => 
          !m.mohallahIds?.length || m.mohallahIds.includes(currentUserMohallahId)
        );
      }
      setStats(prev => ({
        ...prev,
        totalMiqaatsCount: relevantMiqaats.length,
        activeMiqaatsCount: relevantMiqaats.filter(m => new Date(m.endTime) > new Date()).length
      }));
      setAllMiqaatsList(relevantMiqaats);
      setLoadingStats(prev => ({...prev, miqaats: false}));
    });

    // Fetch Forms
    getForms().then(forms => {
      let relevantForms = forms;
      if (currentUserRole === 'admin' && currentUserMohallahId) {
        relevantForms = forms.filter(f => {
          const isForAllAssignedMohallahs = f.mohallahIds?.includes(currentUserMohallahId) || false;
          return isForAllAssignedMohallahs;
        });
      }
      setStats(prev => ({
        ...prev,
        totalFormsCount: relevantForms.length,
        activeFormsCount: relevantForms.filter(f => f.status === 'open' && (!f.endDate || new Date(f.endDate) > new Date())).length
      }));
      setAllForms(relevantForms);
      setLoadingStats(prev => ({...prev, forms: false}));
    }).catch(err => {
      console.error("Failed to fetch forms stats", err);
      setLoadingStats(prev => ({...prev, forms: false}));
    });

    // Fetch Admin-specific counts
    if (currentUserRole === 'admin' || currentUserRole === 'superadmin') {
      getUsersCount(currentUserRole === 'admin' ? currentUserMohallahId || undefined : undefined)
        .then(count => {
          setStats(prev => ({...prev, totalMembersCount: count}));
          setLoadingStats(prev => ({...prev, members: false}));
        }).catch(err => {
          console.error("Failed to fetch member count", err);
          setLoadingStats(prev => ({...prev, members: false}));
        });
      
      if (currentUserRole === 'superadmin') {
        getMohallahsCount().then(count => {
          setStats(prev => ({...prev, totalMohallahsCount: count}));
          setLoadingStats(prev => ({...prev, mohallahs: false}));
        }).catch(err => {
          console.error("Failed to fetch mohallah count", err);
          setLoadingStats(prev => ({...prev, mohallahs: false}));
        });
      } else {
        setLoadingStats(prev => ({...prev, mohallahs: false}));
      }
    } else {
        setLoadingStats(prev => ({...prev, members: false, mohallahs: false}));
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
      const newAbsenteeData = new Map<string, { miqaatName: string; absentees: User[] }>();
      
      try {
        const now = new Date();
        const pastMiqaats = allMiqaatsList
            .filter(m => new Date(m.endTime) < now)
            .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.startTime).getTime());

        if (pastMiqaats.length === 0) {
            setIsLoadingAbsentees(false);
            return;
        }

        const latestMiqaat = pastMiqaats[0];
        
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
             baseVisibleUsers = [];
        }

        if(baseVisibleUsers.length === 0) {
            setIsLoadingAbsentees(false);
            return;
        }

        const isForEveryone = (!latestMiqaat.mohallahIds || latestMiqaat.mohallahIds.length === 0) && (!latestMiqaat.teams || latestMiqaat.teams.length === 0) && (!latestMiqaat.eligibleItsIds || latestMiqaat.eligibleItsIds.length === 0);
        
        const eligibleTeamMembers = baseVisibleUsers.filter(member => {
            if (latestMiqaat.eligibleItsIds && latestMiqaat.eligibleItsIds.length > 0) {
                return latestMiqaat.eligibleItsIds.includes(member.itsId);
            }
            if(isForEveryone) return true;
            let isEligible = false;
            if (latestMiqaat.mohallahIds && latestMiqaat.mohallahIds.length > 0) {
                isEligible = isEligible || (!!member.mohallahId && latestMiqaat.mohallahIds.includes(member.mohallahId));
            }
            if (latestMiqaat.teams && latestMiqaat.teams.length > 0) {
                isEligible = isEligible || (!!member.team && latestMiqaat.teams.includes(member.team));
            }
            if ((latestMiqaat.mohallahIds?.length || 0) + (latestMiqaat.teams?.length || 0) > 0) {
              return isEligible;
            }
            return isForEveryone;
        });

        const attendedItsIds = new Set(latestMiqaat.attendance?.map(a => a.userItsId) || []);
        const safarItsIds = new Set(latestMiqaat.safarList?.map(s => s.userItsId) || []);

        const absentMembers = eligibleTeamMembers.filter(member => {
            return !attendedItsIds.has(member.itsId) && !safarItsIds.has(member.itsId);
        });

        if (absentMembers.length > 0) {
            newAbsenteeData.set(latestMiqaat.id, { miqaatName: latestMiqaat.name, absentees: absentMembers });
        }
        setAbsenteeData(newAbsenteeData);

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
        
        const activeForms = allForms.filter(f => f.status === 'open' && (!f.endDate || new Date(f.endDate) > new Date()));

        const formsWithMissing: FormType[] = [];

        for (const form of activeForms) {
            const allFormResponses = await getFormResponses(form.id);
            const respondedItsIds = new Set(allFormResponses.map(r => r.submittedBy));
            
            const eligibleUsersForForm = visibleUsers.filter(user => {
                const isForEveryone = !form.mohallahIds?.length && !form.teams?.length && !form.eligibleItsIds?.length;
                if (isForEveryone) return true;
                const inMohallah = form.mohallahIds?.includes(user.mohallahId || '');
                const inTeam = form.teams?.includes(user.team || '');
                const inItsId = form.eligibleItsIds?.includes(user.itsId);
                return !!(inMohallah || inTeam || inItsId);
            });
        
            if (eligibleUsersForForm.length === 0) continue;

            const hasNonRespondents = eligibleUsersForForm.some(user => !respondedItsIds.has(user.itsId));

            if (hasNonRespondents) {
                formsWithMissing.push(form);
            }
        }
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

    setIsLoadingNonRespondents(true);
    try {
        const selectedForm = allForms.find(f => f.id === formId);
        if (!selectedForm || !currentUser) return;

        const allUsers = await getUsers();
        const allFormResponses = await getFormResponses(formId);
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

    } catch (e) { 
        console.error("Could not load non-respondents for selected form", e)
    } finally {
        setIsLoadingNonRespondents(false);
    }
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
  
  // Effect for User's Pending Dua
  useEffect(() => {
      if (isLoadingUser || !currentUser) return;

      const checkDuaStatus = async () => {
          setIsLoadingDuaStatus(true);
          const TARGET_MOHALLAH_ID = "ZMGsLMWcFQEM97jWD03x";
          const isTaheriMohallah = currentUser.mohallahId === TARGET_MOHALLAH_ID;
          const isSuperAdmin = currentUser.role === 'superadmin';

          if (!isTaheriMohallah && !isSuperAdmin) {
              setIsDuaPending(false);
              setIsLoadingDuaStatus(false);
              return;
          }

          const currentDay = new Date().getDay(); // Sunday = 0, Thursday = 4
          const isWithinWindow = currentDay >= 4 && currentDay <= 6; // Thurs, Fri, Sat

          if (!isWithinWindow) {
              setIsDuaPending(false);
              setIsLoadingDuaStatus(false);
              return;
          }
          
          const getWeekId = (date: Date) => {
              const year = date.getFullYear();
              const firstDayOfYear = new Date(year, 0, 1);
              const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
              const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
              return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
          };

          const weekId = getWeekId(new Date());
          const hasSubmitted = await checkDuaForWeek(currentUser.itsId, weekId);

          setIsDuaPending(!hasSubmitted);
          setIsLoadingDuaStatus(false);
      };

      checkDuaStatus();

  }, [isLoadingUser, currentUser]);


  useEffect(() => {
    const alerts: DashboardAlert[] = [];
    
    if (isDuaPending && !isLoadingDuaStatus) {
        alerts.push({
            id: `dua-pending`,
            type: 'dua-pending',
            title: 'Weekly Dua Pending',
            description: 'Your weekly Dua Tilawat submission is pending. Please submit it before Saturday.',
            action: () => router.push('/dashboard/dua'),
            actionLabel: "Submit Now",
            variant: 'default',
            icon: BookOpen,
        });
    }

    if (isTeamLead && !isLoadingAbsentees && absenteeData.size > 0) {
        absenteeData.forEach((data, miqaatId) => {
            alerts.push({
                id: `miqaat-${miqaatId}`,
                type: 'miqaat',
                title: 'Miqaat Attendance Alert',
                description: `For ${data.miqaatName}, you have ${data.absentees.length} absent member(s).`,
                action: () => {
                    setSelectedMiqaatForAbsentees(miqaatId);
                    setIsAbsenteeSheetOpen(true);
                },
                actionLabel: "View List",
                variant: 'destructive',
                icon: UserX,
            });
        });
    }

    if (isTeamLead && !isLoadingNonRespondents && formsWithNonRespondents.length > 0) {
        alerts.push({
            id: 'form-non-respondents',
            type: 'form-non-respondent',
            title: 'Form Non-Respondent Alert',
            description: `You have non-respondents for ${formsWithNonRespondents.length} active form(s).`,
            action: () => setIsNonRespondentSheetOpen(true),
            actionLabel: "View Details",
            variant: 'default',
            icon: FileText
        });
    }
    
    if (!isTeamLead && !isLoadingPendingForms && pendingForms.length > 0) {
         alerts.push({
            id: 'form-pending',
            type: 'form-pending',
            title: 'Pending Forms',
            description: `You have ${pendingForms.length} form(s) that need to be filled out.`,
            action: () => setIsPendingFormsSheetOpen(true),
            actionLabel: "View Forms",
            variant: 'default',
            icon: FileText
        });
    }

    setDashboardAlerts(alerts);
  }, [isTeamLead, isLoadingAbsentees, absenteeData, isLoadingNonRespondents, formsWithNonRespondents, isLoadingPendingForms, pendingForms, isDuaPending, isLoadingDuaStatus, router]);


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
    
    const sessions = targetMiqaat.sessions && targetMiqaat.sessions.length > 0 ? targetMiqaat.sessions : [{ id: 'main', startTime: targetMiqaat.startTime, endTime: targetMiqaat.endTime, reportingTime: targetMiqaat.reportingTime, name: 'Main Session', day: 1 }];
    const currentSession = sessions.find(s => now >= new Date(s.startTime) && now <= new Date(s.endTime));

    if (!currentSession) {
        setScanDisplayMessage({ type: 'error', text: `No active session found for ${targetMiqaat.name} at this time.` });
        setIsProcessingScan(false);
        setIsScannerDialogOpen(false);
        return;
    }

    const alreadyMarked = targetMiqaat.attendance?.some(entry => entry.userItsId === currentUserItsId && entry.sessionId === currentSession.id);
    if (alreadyMarked) {
      const existingEntry = targetMiqaat.attendance?.find(entry => entry.userItsId === currentUserItsId);
      setScanDisplayMessage({ type: 'info', text: `Already marked for ${targetMiqaat.name} (${existingEntry?.status || 'present'}).`, miqaatName: targetMiqaat.name, time: format(new Date(existingEntry?.markedAt || Date.now()), "PPp"), status: existingEntry?.status });
      setIsProcessingScan(false);
      setIsScannerDialogOpen(false);
      return;
    }

    
    const sessionReportingTime = currentSession.reportingTime ? new Date(currentSession.reportingTime) : new Date(currentSession.startTime);
    
    let attendanceStatus: 'early' | 'present' | 'late';
    if (now < sessionReportingTime) {
      attendanceStatus = 'early';
    } else if (now > new Date(currentSession.endTime)) {
      attendanceStatus = 'late';
    } else {
      attendanceStatus = 'present';
    }

    try {
      const attendanceEntry: MiqaatAttendanceEntryItem = {
        userItsId: currentUserItsId,
        userName: currentUserName,
        sessionId: currentSession.id,
        markedAt: now.toISOString(),
        markedByItsId: currentUserItsId,
        status: attendanceStatus,
      };

      await markAttendanceInMiqaat(targetMiqaat.id, attendanceEntry);
      setAllMiqaatsList(prev => prev.map(m => m.id === targetMiqaat.id ? { ...m, attendance: [...(m.attendance || []), attendanceEntry] } : m));
      setScanDisplayMessage({
        type: 'success',
        text: `Attendance marked ${attendanceStatus === 'late' ? '(Late)' : (attendanceStatus === 'early' ? '(Early)' : '')} successfully for ${targetMiqaat.name} at ${format(now, "p")}.`,
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
                errorMsg = `${errorMsg} Details: ${String(err)}`;
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

  useEffect(() => {
    if (!isTeamLead || allMiqaatsList.length === 0) {
      setIsLoadingChartData(false);
      return;
    }
    setIsLoadingChartData(true);
    const processChartData = async () => {
        try {
            const allUsers = await getUsers();
            const pastMiqaats = allMiqaatsList
                .filter(m => new Date(m.endTime) < new Date())
                .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                .slice(0, 5); // Take the 5 most recent
            
            const data: ChartDataItem[] = [];

            for (const miqaat of pastMiqaats) {
                const attendedItsIds = new Set(miqaat.attendance?.map(a => a.userItsId));
                const presentCount = miqaat.attendance?.filter(a => a.status === 'present' || a.status === 'early').length || 0;
                const lateCount = miqaat.attendance?.filter(a => a.status === 'late').length || 0;
                
                const isMiqaatForEveryone = !miqaat.mohallahIds?.length && !miqaat.teams?.length && !miqaat.eligibleItsIds?.length;
                
                const eligibleUsers = allUsers.filter(u => {
                    if (miqaat.eligibleItsIds?.length) return miqaat.eligibleItsIds.includes(u.itsId);
                    if (isMiqaatForEveryone) return true;
                    return (miqaat.mohallahIds?.includes(u.mohallahId || '')) || (miqaat.teams?.includes(u.team || ''));
                });

                const absentCount = eligibleUsers.length - attendedItsIds.size;

                data.unshift({ // unshift to keep chronological order
                    name: miqaat.name,
                    present: presentCount,
                    late: lateCount,
                    absent: absentCount > 0 ? absentCount : 0,
                });
            }
            setAttendanceChartData(data);
        } catch (e) {
            console.error("Failed to process chart data", e);
            setAttendanceChartData(null);
        } finally {
            setIsLoadingChartData(false);
        }
    };
    processChartData();
  }, [isTeamLead, allMiqaatsList]);

  useEffect(() => {
    if (!isTeamLead || allForms.length === 0 || !currentUser) {
      setIsLoadingFormsData(false);
      return;
    }
    setIsLoadingFormsData(true);
    const processFormsData = async () => {
        try {
            const allUsers = await getUsers();
            const activeForms = allForms.filter(f => f.status === 'open' && (!f.endDate || new Date(f.endDate) > new Date()));
            
            const formsWithRates: (FormType & { responseRate: number, nonRespondentCount: number })[] = [];

            let visibleUsersInScope: User[] = [];
            if (currentUser.role === 'admin' && currentUser.mohallahId) {
                visibleUsersInScope = allUsers.filter(u => u.mohallahId === currentUser.mohallahId);
            } else if (currentUser.role === 'superadmin') {
                visibleUsersInScope = allUsers;
            } else if (currentUser.designation && TEAM_LEAD_DESIGNATIONS.includes(currentUser.designation)) {
                 if (TOP_LEVEL_LEADERS.includes(currentUser.designation)) {
                    visibleUsersInScope = allUsers.filter(u => u.mohallahId === currentUser.mohallahId);
                } else if (MID_LEVEL_LEADERS.includes(currentUser.designation) && currentUser.managedTeams) {
                    const managedTeamsSet = new Set(currentUser.managedTeams);
                    visibleUsersInScope = allUsers.filter(u => u.team && managedTeamsSet.has(u.team) && u.mohallahId === currentUser.mohallahId);
                } else if (GROUP_LEVEL_LEADERS.includes(currentUser.designation) && currentUser.team) {
                    visibleUsersInScope = allUsers.filter(u => u.team === currentUser.team && u.mohallahId === currentUser.mohallahId);
                }
            }


            for (const form of activeForms) {
                const isFormForEveryone = !form.mohallahIds?.length && !form.teams?.length && !form.eligibleItsIds?.length;
                
                const eligibleUsersInScope = visibleUsersInScope.filter(u => {
                    if (form.eligibleItsIds?.length) return form.eligibleItsIds.includes(u.itsId);
                    if (isFormForEveryone) return true;
                    return (form.mohallahIds?.includes(u.mohallahId || '')) || (form.teams?.includes(u.team || ''));
                });
                
                if (eligibleUsersInScope.length === 0) continue;

                const allResponses = await getFormResponses(form.id);
                const responsesFromScope = allResponses.filter(r => eligibleUsersInScope.some(u => u.itsId === r.submittedBy));
                const responseCount = responsesFromScope.length;

                const responseRate = eligibleUsersInScope.length > 0 ? (responseCount / eligibleUsersInScope.length) * 100 : 0;
                const nonRespondentCount = eligibleUsersInScope.length - responseCount;
                
                formsWithRates.push({ ...form, responseRate, nonRespondentCount });
            }
            setActiveFormsWithResponses(formsWithRates);
        } catch (e) {
            console.error("Failed to process forms response rates", e);
            setActiveFormsWithResponses(null);
        } finally {
            setIsLoadingFormsData(false);
        }
    };
    processFormsData();
  }, [isTeamLead, allForms, currentUser]);



  const adminOverviewStats: AdminStat[] = [
    { title: "Active Miqaats", value: stats.activeMiqaatsCount, icon: CalendarClock, isLoading: loadingStats.miqaats },
    { title: "Total Miqaats", value: stats.totalMiqaatsCount, icon: CalendarDays, isLoading: loadingStats.miqaats },
    { title: "Active Forms", value: stats.activeFormsCount, icon: FilePenLine, isLoading: loadingStats.forms },
    { title: "Total Forms", value: stats.totalFormsCount, icon: Files, isLoading: loadingStats.forms },
    { title: "Total Members", value: stats.totalMembersCount, icon: Users, isLoading: loadingStats.members, trend: currentUserRole === 'admin' ? "In your Mohallah" : "System-wide" },
  ];

  if (currentUserRole === 'superadmin') {
    adminOverviewStats.push({ title: "Total Mohallahs", value: stats.totalMohallahsCount, icon: Building, isLoading: loadingStats.mohallahs });
  }

  const statsToDisplay = (currentUserRole === 'admin' || currentUserRole === 'superadmin' || currentUserRole === 'attendance-marker' || isTeamLead) ? adminOverviewStats : [];
  
  if (currentUserRole === 'attendance-marker') {
      statsToDisplay.splice(4, 2);
  }

  if (isLoadingUser && !currentUserItsId) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center h-full">
        <FunkyLoader size="lg">Loading user data...</FunkyLoader>
      </div>
    );
  }

  if (!currentUserItsId && !isLoadingUser) {
    return null; 
  }

  return (
    <div className="flex flex-col h-full">
       <div className="flex-grow space-y-6">
          {dashboardAlerts.length > 0 && (
              <div className="relative w-full">
                <Carousel className="w-full">
                    <CarouselContent>
                        {dashboardAlerts.map(alert => (
                            <CarouselItem key={alert.id}>
                                <div className="p-1">
                                    <Alert variant={alert.variant} className="relative">
                                        <alert.icon className="h-4 w-4" />
                                        <AlertTitle>{alert.title}</AlertTitle>
                                        <AlertDescription className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                            <span>{alert.description}</span>
                                            <Button variant={alert.variant === 'destructive' ? 'destructive' : 'default'} size="sm" onClick={alert.action} className="mt-2 sm:mt-0 shrink-0">
                                                {alert.actionLabel}
                                            </Button>
                                        </AlertDescription>
                                    </Alert>
                                </div>
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    {dashboardAlerts.length > 1 && (
                        <>
                            <CarouselPrevious className="absolute left-1 top-1/2 -translate-y-1/2 h-6 w-6 sm:h-8 sm:w-8 sm:-left-4 md:-left-12" />
                            <CarouselNext className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 sm:h-8 sm:w-8 sm:-right-4 md:-right-12" />
                        </>
                    )}
                </Carousel>
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
                  <stat.icon className="h-5 w-5 text-primary shrink-0" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground break-all">
                    {stat.isLoading ? <FunkyLoader size="sm" /> : stat.value}
                  </div>
                  {stat.trend && <p className="text-xs text-muted-foreground break-words">{stat.trend}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {isTeamLead && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="shadow-lg col-span-1 lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center"><BarChart2 className="mr-2 h-5 w-5 text-primary"/>Recent Miqaat Attendance</CardTitle>
                        <CardDescription>Attendance summary for the last 5 completed Miqaats.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoadingChartData ? (
                           <div className="flex items-center justify-center h-[350px]">
                            <FunkyLoader>Loading Chart Data...</FunkyLoader>
                           </div>
                        ) : attendanceChartData && attendanceChartData.length > 0 ? (
                            <ChartContainer config={chartConfig} className="w-full h-[350px]">
                                <BarChart accessibilityLayer data={attendanceChartData}>
                                    <CartesianGrid vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        tickLine={false}
                                        tickMargin={10}
                                        axisLine={false}
                                        tickFormatter={(value) => value.slice(0, 15) + (value.length > 15 ? '...' : '')}
                                    />
                                    <YAxis />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <ChartLegend content={<ChartLegendContent />} />
                                    <Bar dataKey="present" fill="var(--color-present)" radius={4} stackId="a" />
                                    <Bar dataKey="late" fill="var(--color-late)" radius={4} stackId="a" />
                                    <Bar dataKey="absent" fill="var(--color-absent)" radius={4} stackId="a" />
                                </BarChart>
                            </ChartContainer>
                        ) : (
                            <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                                No completed Miqaat data available to display.
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-lg col-span-1 lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center"><FilePenLine className="mr-2 h-5 w-5 text-primary"/>Active Form Response Rates</CardTitle>
                        <CardDescription>Overview of current form completion status within your scope.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {isLoadingFormsData ? (
                             <div className="flex items-center justify-center py-10">
                               <FunkyLoader>Loading Form Data...</FunkyLoader>
                             </div>
                        ) : activeFormsWithResponses && activeFormsWithResponses.length > 0 ? (
                            activeFormsWithResponses.map(form => (
                                <div key={form.id}>
                                    <div className="flex justify-between items-center mb-1">
                                        <Link href={`/dashboard/forms/${form.id}/responses`} className="font-medium text-sm hover:underline">{form.title}</Link>
                                        <span className="text-sm font-semibold">{form.responseRate.toFixed(0)}%</span>
                                    </div>
                                    <Progress value={form.responseRate} />
                                    <p className="text-xs text-muted-foreground mt-1">{form.nonRespondentCount} member(s) have not responded.</p>
                                </div>
                            ))
                        ) : (
                             <div className="text-center py-10 text-muted-foreground">
                                No active forms to display.
                             </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        )}
      </div>
      {isBarcodeScanningEnabled && (
        <Button
          onClick={() => { setScanDisplayMessage(null); setScannerError(null); setIsScannerDialogOpen(true); }}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 bg-primary hover:bg-primary/90 text-primary-foreground"
          size="icon"
          aria-label="Scan Attendance"
        >
          <ScanLine className="h-6 w-6" />
        </Button>
      )}

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
                <FunkyLoader>Initializing Camera...</FunkyLoader>
              </div>
            )}
            {isScannerActive && !isProcessingScan && (
              <div className="text-center text-green-600 py-2">
                <p>Scanning...</p>
              </div>
            )}
            {isProcessingScan && (
              <div className="text-center text-blue-600 py-2">
                <FunkyLoader>Processing Scan...</FunkyLoader>
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
            <SheetTitle>Absentee List for {selectedMiqaatForAbsentees ? absenteeData.get(selectedMiqaatForAbsentees)?.miqaatName : ''}</SheetTitle>
            <SheetDescription>
              The following members from your team(s) were marked absent.
            </SheetDescription>
          </SheetHeader>
          <div className="max-h-[80vh] overflow-y-auto my-4 pr-4">
            {selectedMiqaatForAbsentees && absenteeData.get(selectedMiqaatForAbsentees) && absenteeData.get(selectedMiqaatForAbsentees)!.absentees.length > 0 ? (
              <ul className="space-y-2">
                {absenteeData.get(selectedMiqaatForAbsentees)!.absentees.map(member => (
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
                      {isLoadingNonRespondents ? (
                          <div className="flex items-center justify-center p-4">
                            <FunkyLoader>Loading list...</FunkyLoader>
                          </div>
                      ) : selectedFormForNonRespondents ? (
                          nonRespondentList.length > 0 ? (
                            <>
                              <p className="text-sm text-muted-foreground px-1 mb-2">
                                  Found <span className="font-bold">{nonRespondentList.length}</span> non-respondent(s).
                              </p>
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
                            </>
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
               <SheetFooter className="border-t pt-4">
                {selectedFormForNonRespondents && (
                     <Button variant="outline" asChild>
                        <Link href={`/dashboard/forms/${selectedFormForNonRespondents}/responses`}>
                            <ExternalLink className="mr-2 h-4 w-4"/>
                            View Full Report
                        </Link>
                    </Button>
                )}
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
                <FunkyLoader>Loading forms...</FunkyLoader>
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
