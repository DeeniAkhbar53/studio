

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Users, CalendarCheck, ScanLine, Loader2, Camera, CheckCircle2, XCircle, AlertCircleIcon, SwitchCamera, FileText, UserX, Edit, X, CalendarClock, CalendarDays, FilePenLine, Files, Building, BarChart2, ExternalLink, BookOpen, Mail, UserSearch, Sparkles, Radio, TvMinimal, Maximize2, Minimize2, UserCheck, UserMinus, ChevronDown, ChevronUp, Search, Plane } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
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
import type { UserRole, UserDesignation, Miqaat, MiqaatAttendanceEntryItem, MiqaatSession, MiqaatSafarEntryItem, Form as FormType, User } from "@/types";
import { getMiqaats, markAttendanceInMiqaat, batchMarkSafarInMiqaat } from "@/lib/firebase/miqaatService";
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
import { db, getYearPath } from "@/lib/firebase/firebase";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { Clock, Timer } from "lucide-react";


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
    type: 'miqaat' | 'form-non-respondent'; // 'dua-pending' and 'form-pending' handled separately now
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
  const { toast } = useToast();
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

  const [allMiqaatsList, setAllMiqaatsList] = useState<Pick<Miqaat, "id" | "name" | "type" | "startTime" | "endTime" | "reportingTime" | "mohallahIds" | "teams" | "eligibleItsIds" | "location" | "barcodeData" | "attendance" | "safarList" | "attendanceRequirements" | "sessions">[]>([]);
  const [allForms, setAllForms] = useState<FormType[]>([]);
  const [isBarcodeScanningEnabled, setIsBarcodeScanningEnabled] = useState(true);


  // Absentee Notification State
  const [absenteeData, setAbsenteeData] = useState<Map<string, { miqaatName: string; absentees: User[] }>>(new Map());
  const [isAbsenteeSheetOpen, setIsAbsenteeSheetOpen] = useState(false);
  const [isLoadingAbsentees, setIsLoadingAbsentees] = useState(false);
  const [selectedMiqaatForAbsentees, setSelectedMiqaatForAbsentees] = useState<string | null>(null);
  const [isSendingAbsenteeEmails, setIsSendingAbsenteeEmails] = useState(false);
  const [sendingEmailItsId, setSendingEmailItsId] = useState<string | null>(null);
  const [lastLoginText, setLastLoginText] = useState<string>("Loading...");
  
  // Quick Attendance Widget State
  const [quickMemberId, setQuickMemberId] = useState("");
  const [quickMember, setQuickMember] = useState<User | null>(null);
  const [isQuickProcessing, setIsQuickProcessing] = useState(false);
  const [quickMarkStatus, setQuickMarkStatus] = useState<string | null>(null);
  const [sessionMinutes, setSessionMinutes] = useState<number>(0);
  
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

  // Live Attendance Tracker State
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isLiveDetailsOpen, setIsLiveDetailsOpen] = useState(false);
  const [liveDetailFilter, setLiveDetailFilter] = useState<'all' | 'present' | 'safar' | 'absent'>('all');
  const [scopedLiveUsers, setScopedLiveUsers] = useState<User[]>([]);
  const [isLoadingLiveUsers, setIsLoadingLiveUsers] = useState(false);
  const [liveSearchQuery, setLiveSearchQuery] = useState("");
  const [hasAutoSetLiveMode, setHasAutoSetLiveMode] = useState(false);
  const [liveTeamFilter, setLiveTeamFilter] = useState<string | null>(null);


  const isTeamLead = useMemo(() => {
    if (!currentUserRole || !currentUserDesignation) return false;
    const isAdmin = currentUserRole === 'admin' || currentUserRole === 'superadmin';
    if (isAdmin) return true; // Treat admins as team leads for alert purposes
    const hasLeadershipDesignation = TEAM_LEAD_DESIGNATIONS.includes(currentUserDesignation);
    return hasLeadershipDesignation;
  }, [currentUserRole, currentUserDesignation]);

  // Derived: current live miqaat
  const liveMiqaat = useMemo(() => {
    const now = new Date();
    return allMiqaatsList.find(m => new Date(m.startTime) <= now && new Date(m.endTime) >= now) || null;
  }, [allMiqaatsList]);

  // Is user eligible to see live tracker
  const canSeeLiveTracker = useMemo(() => {
    if (!currentUserRole) return false;
    if (currentUserRole === 'admin' || currentUserRole === 'superadmin') return true;
    if (currentUserDesignation && TEAM_LEAD_DESIGNATIONS.includes(currentUserDesignation)) return true;
    return false;
  }, [currentUserRole, currentUserDesignation]);

  // Load scoped users for live tracker (only when a live miqaat exists and user can see it)
  useEffect(() => {
    if (!liveMiqaat || !canSeeLiveTracker || !currentUser) {
      setScopedLiveUsers([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setIsLoadingLiveUsers(true);
      try {
        const allUsers = await getUsers();
        let scoped: User[] = [];
        if (currentUser.role === 'superadmin') {
          scoped = allUsers;
        } else if (currentUser.role === 'admin' && currentUser.mohallahId) {
          scoped = allUsers.filter(u => u.mohallahId === currentUser.mohallahId);
        } else if (currentUser.designation && TOP_LEVEL_LEADERS.includes(currentUser.designation)) {
          scoped = allUsers.filter(u => u.mohallahId === currentUser.mohallahId);
        } else if (currentUser.designation && MID_LEVEL_LEADERS.includes(currentUser.designation) && currentUser.managedTeams) {
          const mt = new Set(currentUser.managedTeams);
          scoped = allUsers.filter(u => u.team && mt.has(u.team) && u.mohallahId === currentUser.mohallahId);
        } else if (currentUser.designation && GROUP_LEVEL_LEADERS.includes(currentUser.designation) && currentUser.team) {
          scoped = allUsers.filter(u => u.team === currentUser.team && u.mohallahId === currentUser.mohallahId);
        }
        // Further filter by miqaat eligibility
        const isForEveryone = !liveMiqaat.mohallahIds?.length && !liveMiqaat.teams?.length && !liveMiqaat.eligibleItsIds?.length;
        const eligible = scoped.filter(u => {
          if (liveMiqaat.eligibleItsIds?.length) return liveMiqaat.eligibleItsIds.includes(u.itsId);
          if (isForEveryone) return true;
          let ok = false;
          if (liveMiqaat.mohallahIds?.length) ok = ok || (!!u.mohallahId && liveMiqaat.mohallahIds.includes(u.mohallahId));
          if (liveMiqaat.teams?.length) ok = ok || (!!u.team && liveMiqaat.teams.includes(u.team));
          return ok;
        });
        if (!cancelled) setScopedLiveUsers(eligible);
      } catch (e) {
        console.error('Failed to load live tracker users', e);
      } finally {
        if (!cancelled) setIsLoadingLiveUsers(false);
      }
    };
    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveMiqaat?.id, canSeeLiveTracker, currentUser]);

  // Live stats derived from real-time miqaat data
  const liveStats = useMemo(() => {
    if (!liveMiqaat || scopedLiveUsers.length === 0) return null;
    const attendedSet = new Set(liveMiqaat.attendance?.map(a => a.userItsId) || []);
    const safarSet = new Set(liveMiqaat.safarList?.map(s => s.userItsId) || []);

    const presentMembers = scopedLiveUsers.filter(u => attendedSet.has(u.itsId));
    const safarMembers = scopedLiveUsers.filter(u => safarSet.has(u.itsId) && !attendedSet.has(u.itsId));
    const absentMembers = scopedLiveUsers.filter(u => !attendedSet.has(u.itsId) && !safarSet.has(u.itsId));
    const markedCount = presentMembers.length + safarMembers.length;

    // Team breakdown
    const teamMap = new Map<string, { total: number; present: number; safar: number; absent: number }>();
    for (const u of scopedLiveUsers) {
      const team = u.team || 'No Team';
      if (!teamMap.has(team)) teamMap.set(team, { total: 0, present: 0, safar: 0, absent: 0 });
      const entry = teamMap.get(team)!;
      entry.total++;
      if (attendedSet.has(u.itsId)) entry.present++;
      else if (safarSet.has(u.itsId)) entry.safar++;
      else entry.absent++;
    }
    const teamBreakdown = Array.from(teamMap.entries())
      .map(([name, data]) => {
        const markedVal = data.present + data.safar;
        const pct = data.total > 0 ? Math.round((markedVal / data.total) * 100) : 0;
        return { name, ...data, pct };
      })
      .sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name));

    return {
      total: scopedLiveUsers.length,
      markedCount,
      presentMembers,
      safarMembers,
      absentMembers,
      teamBreakdown,
      percentage: scopedLiveUsers.length > 0 ? Math.round((markedCount / scopedLiveUsers.length) * 100) : 0,
    };
  }, [liveMiqaat, scopedLiveUsers]);

  // Auto-toggle live mode based on presence of a live miqaat
  useEffect(() => {
    if (liveMiqaat && canSeeLiveTracker) {
      if (!hasAutoSetLiveMode) {
        setIsLiveMode(true);
        setHasAutoSetLiveMode(true);
      }
    } else {
      setIsLiveMode(false);
      setHasAutoSetLiveMode(false);
    }
  }, [liveMiqaat?.id, canSeeLiveTracker, hasAutoSetLiveMode]);


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
    if (!currentUserItsId) return;

    const fetchLastLogin = async () => {
      try {
        const q = query(
          collection(db, getYearPath("login_logs")),
          where("userItsId", "==", currentUserItsId)
        );
        const snap = await getDocs(q);
        const logs = snap.docs.map(d => {
          const data = d.data();
          const date = data.timestamp instanceof Timestamp 
            ? data.timestamp.toDate() 
            : data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
          return { ...data, date };
        });

        // Sort in memory by date desc
        logs.sort((a, b) => b.date.getTime() - a.date.getTime());

        // The first log is the current login. The second is the previous login.
        if (logs.length > 1) {
          const prevLogin = logs[1];
          setLastLoginText(format(prevLogin.date, "PPpp"));
        } else if (logs.length === 1) {
          setLastLoginText(format(logs[0].date, "PPpp"));
        } else {
          setLastLoginText("First login session");
        }
      } catch (err) {
        console.error("Error fetching last login:", err);
        setLastLoginText("Unavailable");
      }
    };

    fetchLastLogin();
  }, [currentUserItsId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sessionId = localStorage.getItem("sessionId");
    if (!sessionId) return;
    const parts = sessionId.split("-");
    if (parts.length < 2) return;
    const loginTimeMs = parseInt(parts[1], 10);
    if (isNaN(loginTimeMs)) return;

    const updateMinutes = () => {
      const mins = Math.max(0, Math.floor((Date.now() - loginTimeMs) / 60000));
      setSessionMinutes(mins);
    };

    updateMinutes();
    const interval = setInterval(updateMinutes, 60000); // update every minute
    return () => clearInterval(interval);
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

  const handleSendEmailsFromDashboardSidebar = async () => {
    if (!selectedMiqaatForAbsentees) return;
    const data = absenteeData.get(selectedMiqaatForAbsentees);
    if (!data || data.absentees.length === 0) return;

    if (confirm(`Are you sure you want to send email notifications to all ${data.absentees.length} absent member(s) for "${data.miqaatName}"?`)) {
      setIsSendingAbsenteeEmails(true);
      try {
        const targetItsIds = data.absentees.map(member => member.itsId);
        const res = await fetch("/api/miqaat/send-absentee-emails", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            miqaatId: selectedMiqaatForAbsentees,
            adminMohallahId: currentUser?.mohallahId,
            targetItsIds
          }),
        });
        const result = await res.json();
        if (res.ok) {
          toast({
            title: "Absentee Emails Sent",
            description: `Successfully sent ${result.emailsSent} emails. ${result.emailsSkipped} members skipped.`,
          });
          setIsAbsenteeSheetOpen(false);
        } else {
          toast({
            title: "Failed to Send Emails",
            description: result.error || "An error occurred.",
            variant: "destructive",
          });
        }
      } catch (err) {
        toast({
          title: "Error",
          description: "An unexpected error occurred while sending emails.",
          variant: "destructive",
        });
      } finally {
        setIsSendingAbsenteeEmails(false);
      }
    }
  };

  const handleSendSingleAbsenteeEmail = async (member: User) => {
    if (!selectedMiqaatForAbsentees) return;
    setSendingEmailItsId(member.itsId);
    try {
      const res = await fetch("/api/miqaat/send-absentee-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          miqaatId: selectedMiqaatForAbsentees,
          adminMohallahId: currentUser?.mohallahId,
          targetItsIds: [member.itsId]
        }),
      });
      const result = await res.json();
      if (res.ok) {
        toast({
          title: "Email Sent",
          description: `Successfully sent email to ${member.name}.`,
        });
      } else {
        toast({
          title: "Failed to Send Email",
          description: result.error || "An error occurred.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred while sending the email.",
        variant: "destructive",
      });
    } finally {
      setSendingEmailItsId(null);
    }
  };

  const handleQuickLookup = async () => {
    if (!quickMemberId.trim()) {
      toast({ title: "ID Required", description: "Please enter an ITS or BGK ID.", variant: "destructive" });
      return;
    }
    setIsQuickProcessing(true);
    setQuickMember(null);
    setQuickMarkStatus(null);
    try {
      const user = await fetchUserByItsId(quickMemberId.trim());
      if (!user) {
        toast({ title: "Not Found", description: "No member found with this ID.", variant: "destructive" });
      } else {
        setQuickMember(user);
        
        // Find active Miqaat now
        const activeMiqaat = allMiqaatsList.find(m => {
          const now = new Date();
          return new Date(m.startTime) <= now && new Date(m.endTime) >= now;
        });

        if (activeMiqaat) {
          const alreadyMarked = activeMiqaat.attendance?.find(a => a.userItsId === user.itsId);
          const alreadySafar = activeMiqaat.safarList?.find(s => s.userItsId === user.itsId);
          if (alreadyMarked) {
            setQuickMarkStatus(`Present (${alreadyMarked.status})`);
          } else if (alreadySafar) {
            setQuickMarkStatus("Safar");
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to look up member.", variant: "destructive" });
    } finally {
      setIsQuickProcessing(false);
    }
  };

  const handleQuickMark = async (status: 'present' | 'safar') => {
    if (!quickMember) return;
    const activeMiqaat = allMiqaatsList.find(m => {
      const now = new Date();
      return new Date(m.startTime) <= now && new Date(m.endTime) >= now;
    });

    if (!activeMiqaat) {
      toast({ title: "No Active Miqaat", description: "There is no active Miqaat currently running.", variant: "destructive" });
      return;
    }

    setIsQuickProcessing(true);
    try {
      const markerId = currentUserItsId || 'System';
      const currentSession = (activeMiqaat.sessions?.[0] || { 
        id: 'main', 
        day: 1,
        name: 'Main Session', 
        startTime: activeMiqaat.startTime, 
        endTime: activeMiqaat.endTime,
        reportingTime: activeMiqaat.reportingTime
      }) as MiqaatSession;
      
      if (status === 'present') {
        const pad = (n: number) => n.toString().padStart(2, '0');
        const now = new Date();
        const currentTimeString = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
        let sessionReportingTimeString = "00:00";
        const miqaatReportingTime = currentSession.reportingTime || activeMiqaat.reportingTime;
        if (miqaatReportingTime) {
          if (miqaatReportingTime.includes('T')) {
            const rDate = new Date(miqaatReportingTime);
            sessionReportingTimeString = `${pad(rDate.getHours())}:${pad(rDate.getMinutes())}`;
          } else {
            sessionReportingTimeString = miqaatReportingTime;
          }
        }
        const attendanceStatus = currentTimeString < sessionReportingTimeString ? 'early' : 'late';

        const payload: MiqaatAttendanceEntryItem = {
          userItsId: quickMember.itsId,
          userName: quickMember.name,
          sessionId: currentSession.id,
          markedAt: new Date().toISOString(),
          markedByItsId: markerId,
          status: attendanceStatus as 'early' | 'late' | 'present',
        };

        await markAttendanceInMiqaat(activeMiqaat.id, payload);
        setQuickMarkStatus(`Present (${attendanceStatus})`);
        
        // Refresh local Miqaat record
        const updatedMiqaats = allMiqaatsList.map(m => {
          if (m.id === activeMiqaat.id) {
            return {
              ...m,
              attendance: [...(m.attendance || []), payload]
            };
          }
          return m;
        });
        setAllMiqaatsList(updatedMiqaats as any);

        toast({
          title: "Attendance Marked",
          description: `${quickMember.name} marked as present.`,
          className: 'border-green-500 bg-green-50 dark:bg-green-900/30',
        });
      } else {
        const payload: MiqaatSafarEntryItem = {
          userItsId: quickMember.itsId,
          userName: quickMember.name,
          markedAt: new Date().toISOString(),
          markedByItsId: markerId,
          status: 'safar',
          sessionId: currentSession.id,
        };
        await batchMarkSafarInMiqaat(activeMiqaat.id, [payload]);
        setQuickMarkStatus("Safar");

        // Refresh local Miqaat record
        const updatedMiqaats = allMiqaatsList.map(m => {
          if (m.id === activeMiqaat.id) {
            return {
              ...m,
              safarList: [...(m.safarList || []), payload]
            };
          }
          return m;
        });
        setAllMiqaatsList(updatedMiqaats as any);

        toast({
          title: "Marked as Safar",
          description: `${quickMember.name} marked as Safar.`,
          className: 'border-blue-500 bg-blue-50 dark:bg-blue-900/30',
        });
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Failed", description: "Could not record status.", variant: "destructive" });
    } finally {
      setIsQuickProcessing(false);
    }
  };

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
    
    setDashboardAlerts(alerts);
  }, [isTeamLead, isLoadingAbsentees, absenteeData, isLoadingNonRespondents, formsWithNonRespondents, isDuaPending, isLoadingDuaStatus, router]);


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

  const combinedMobileAlerts = useMemo(() => {
    const alertsList: {
      id: string;
      title: string;
      description: string;
      action: () => void;
      actionLabel: string;
      variant: "default" | "destructive";
      icon: React.ElementType;
    }[] = [];
    if (isDuaPending && !isLoadingDuaStatus) {
      alertsList.push({
        id: "dua-pending",
        title: "Weekly Dua Pending",
        description: "Your weekly Dua Tilawat submission is pending. Please submit it before Saturday.",
        action: () => router.push('/dashboard/dua'),
        actionLabel: "Submit Now",
        variant: 'default' as const,
        icon: BookOpen,
      });
    }
    if (pendingForms.length > 0 && !isLoadingPendingForms && !isTeamLead) {
      alertsList.push({
        id: "pending-forms",
        title: "Pending Forms",
        description: `You have ${pendingForms.length} form(s) that need to be filled out.`,
        action: () => setIsPendingFormsSheetOpen(true),
        actionLabel: "View Forms",
        variant: 'default' as const,
        icon: FileText,
      });
    }
    dashboardAlerts.forEach(alert => {
      alertsList.push({
        id: alert.id,
        title: alert.title,
        description: alert.description,
        action: alert.action,
        actionLabel: alert.actionLabel,
        variant: alert.variant,
        icon: alert.icon,
      });
    });
    return alertsList;
  }, [isDuaPending, isLoadingDuaStatus, pendingForms, isLoadingPendingForms, isTeamLead, dashboardAlerts, router]);

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
          {/* Mobile alerts grouped in a Carousel slider */}
          {combinedMobileAlerts.length > 0 && (
            <div className="block md:hidden relative w-full">
              <Carousel className="w-full">
                <CarouselContent>
                  {combinedMobileAlerts.map(alert => (
                    <CarouselItem key={alert.id}>
                      <div className="p-1">
                        <Alert variant={alert.variant} className="relative">
                          <alert.icon className="h-4 w-4" />
                          <AlertTitle>{alert.title}</AlertTitle>
                          <AlertDescription className="flex flex-col items-start justify-between gap-2">
                            <span className="text-xs">{alert.description}</span>
                            <Button variant={alert.variant === 'destructive' ? 'destructive' : 'default'} size="sm" onClick={alert.action} className="mt-2 shrink-0 self-end">
                              {alert.actionLabel}
                            </Button>
                          </AlertDescription>
                        </Alert>
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                {combinedMobileAlerts.length > 1 && (
                  <>
                    <CarouselPrevious className="absolute left-1 top-1/2 -translate-y-1/2 h-6 w-6" />
                    <CarouselNext className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6" />
                  </>
                )}
              </Carousel>
            </div>
          )}

          {/* Desktop alerts separated / stacked as originally designed */}
          <div className="hidden md:block space-y-4">
            {isDuaPending && !isLoadingDuaStatus && (
              <Alert variant='default' className="relative bg-primary/10 border-primary/20">
                  <BookOpen className="h-4 w-4" />
                  <AlertTitle>Weekly Dua Pending</AlertTitle>
                  <AlertDescription className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <span>Your weekly Dua Tilawat submission is pending. Please submit it before Saturday.</span>
                      <Button variant='default' size="sm" onClick={() => router.push('/dashboard/dua')} className="mt-2 sm:mt-0 shrink-0">
                          Submit Now
                      </Button>
                  </AlertDescription>
              </Alert>
            )}

            {pendingForms.length > 0 && !isLoadingPendingForms && !isTeamLead && (
               <Alert variant='default'>
                  <FileText className="h-4 w-4" />
                  <AlertTitle>Pending Forms</AlertTitle>
                  <AlertDescription className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <span>You have {pendingForms.length} form(s) that need to be filled out.</span>
                      <Button variant='default' size="sm" onClick={() => setIsPendingFormsSheetOpen(true)} className="mt-2 sm:mt-0 shrink-0">
                          View Forms
                      </Button>
                  </AlertDescription>
              </Alert>
            )}
            
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
          </div>
      
        <Card className="glass-surface border-white/20 shadow-sm">
          <CardHeader className="py-4 px-6">
            <CardTitle className="text-xl sm:text-2xl font-semibold text-foreground">
                Welcome, {currentUserName}!
            </CardTitle>
            <div className="flex flex-nowrap items-center gap-x-2 mt-1.5 text-xs sm:text-sm text-muted-foreground overflow-x-auto whitespace-nowrap pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <span className="font-medium text-foreground shrink-0">{currentUserDesignation || 'Member'}</span>
              {currentUserRole && (
                <span className="text-muted-foreground/80 shrink-0">
                  ({currentUserRole.charAt(0).toUpperCase() + currentUserRole.slice(1).replace(/-/g, ' ')})
                </span>
              )}
              <span className="text-muted-foreground/30 shrink-0 hidden md:inline">•</span>
              <span className="hidden md:inline-flex items-center gap-1 shrink-0">
                <Clock className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                <span className="shrink-0">Last login: <strong className="font-medium text-foreground">{lastLoginText}</strong></span>
              </span>
              <span className="text-muted-foreground/30 shrink-0 hidden md:inline">•</span>
              <span className="hidden md:inline-flex items-center gap-1 shrink-0">
                <Timer className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                <span className="shrink-0">Session: <strong className="font-medium text-foreground">{sessionMinutes} min</strong></span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-2">
              Here's your overview. Use the sidebar to navigate to other sections.
            </p>
          </CardHeader>
          {currentUserRole === 'user' && (
            <CardContent>
              <p className="text-foreground">Please ensure you are on time for all Miqaats. Use the scanner button for quick check-in.</p>
            </CardContent>
          )}
        </Card>

        {/* ========== LIVE ATTENDANCE TRACKER ========== */}
        {canSeeLiveTracker && liveMiqaat && liveStats && (
          <div className={cn(
            "transition-all duration-500",
            isLiveMode ? "fixed inset-0 z-40 overflow-y-auto bg-background" : "mt-6"
          )}>
            {/* Live Mode immersive background */}
            {isLiveMode && (
              <div className="fixed inset-0 bg-background/95 pointer-events-none" />
            )}
            <div className={cn(
              "relative",
              isLiveMode ? "min-h-screen flex flex-col p-4 sm:p-8 pt-6 max-w-7xl mx-auto w-full" : ""
            )}>
              {/* Fullscreen Live Mode Header */}
              {isLiveMode && (
                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-5 border-b border-border">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="relative shrink-0 flex items-center justify-center">
                      <span className="absolute h-5 w-5 rounded-full bg-red-500 animate-ping opacity-60" />
                      <span className="relative flex h-4 w-4 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">LIVE COMMAND CENTER</span>
                        <span className="text-xs text-muted-foreground">Real-time Attendance Tracker</span>
                      </div>
                      <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight truncate">{liveMiqaat.name}</h1>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono hidden md:inline">
                      Starts: {format(new Date(liveMiqaat.startTime), "p")} · Ends: {format(new Date(liveMiqaat.endTime), "p")}
                    </span>
                    <button
                      onClick={() => setIsLiveMode(false)}
                      className="flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold text-muted-foreground hover:text-foreground border border-border hover:border-border/80 bg-muted/50 hover:bg-muted transition-all duration-200"
                    >
                      <Minimize2 className="h-3.5 w-3.5" />
                      Exit Live Mode
                    </button>
                  </div>
                </div>
              )}

              <div className={cn(
                "relative overflow-hidden rounded-3xl transition-all duration-300",
                isLiveMode 
                  ? "border border-border bg-card shadow-2xl flex-1 flex flex-col" 
                  : "border border-primary/20 bg-card/60 backdrop-blur-md shadow-xl"
              )}>
                {/* Decorative glows */}
                {!isLiveMode && (
                  <>
                    <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
                  </>
                )}

                {/* Inline Card Header (only in Normal mode) */}
                {!isLiveMode && (
                  <div className="relative flex items-center justify-between px-6 py-5 border-b border-border/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0 flex items-center justify-center">
                        <span className="absolute h-4 w-4 rounded-full bg-red-500 animate-ping opacity-60" />
                        <span className="relative flex h-3.5 w-3.5 rounded-full bg-red-500 shadow-md" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-red-400">Live now</span>
                          <span className="text-[9px] text-muted-foreground/50">• Scoped Attendance</span>
                        </div>
                        <h3 className="font-extrabold text-base sm:text-lg text-foreground truncate tracking-tight">{liveMiqaat.name}</h3>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsLiveMode(true)}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground border border-border hover:border-primary/30 bg-muted/40 hover:bg-primary/5 transition-all duration-200"
                    >
                      <Maximize2 className="h-3 w-3 text-red-500" />
                      Live Mode
                    </button>
                  </div>
                )}

                {/* Body Content */}
                <div className={cn("p-6 flex flex-col gap-6", isLiveMode ? "flex-1 overflow-y-auto" : "")}>
                  {isLoadingLiveUsers ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                      <div className="relative h-12 w-12">
                        <span className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
                        <span className="relative flex h-12 w-12 rounded-full bg-red-500/10 border border-red-500/30 items-center justify-center">
                          <Radio className="h-5 w-5 text-red-400 animate-pulse" />
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Synergizing Live Data...</p>
                    </div>
                  ) : (
                    <div className={cn("grid grid-cols-1 gap-6", isLiveMode ? "lg:grid-cols-12" : "")}>
                      
                      {/* Left Block: Radial Progress & Stat Overview */}
                      <div className={cn("space-y-6 flex flex-col justify-center", isLiveMode ? "lg:col-span-5" : "")}>
                        
                        {/* Radial Indicator + Large Percentage info */}
                        <div className="flex flex-col sm:flex-row items-center gap-6 p-6 rounded-3xl bg-muted/20 border border-border/70 shadow-sm relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-red-500/5 blur-2xl pointer-events-none" />
                          
                          {/* Radial SVG meter */}
                          <div className="relative flex items-center justify-center w-28 h-28 sm:w-32 sm:h-32 shrink-0">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                              <defs>
                                <linearGradient id="liveProgressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                  <stop offset="0%" stopColor="hsl(var(--primary))" />
                                  <stop offset="100%" stopColor="hsl(var(--primary) / 0.75)" />
                                </linearGradient>
                                <filter id="liveGlow" x="-20%" y="-20%" width="140%" height="140%">
                                  <feGaussianBlur stdDeviation="3" result="blur" />
                                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                </filter>
                              </defs>
                              {/* Background circle */}
                              <circle cx="60" cy="60" r="48" className="stroke-muted dark:stroke-white/5" strokeWidth="8" fill="none" />
                              {/* Colored progress circle */}
                              <circle cx="60" cy="60" r="48" stroke="url(#liveProgressGrad)" strokeWidth="8" fill="none"
                                strokeDasharray={301.59} strokeDashoffset={301.59 - (301.59 * liveStats.percentage) / 100}
                                strokeLinecap="round" className="transition-all duration-1000 ease-out" filter="url(#liveGlow)" />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-3xl font-black text-foreground tracking-tight leading-none">{liveStats.percentage}%</span>
                              <span className="text-[9px] font-bold text-muted-foreground mt-1 uppercase tracking-widest">Marked</span>
                            </div>
                          </div>

                          {/* Info Column */}
                          <div className="flex-1 text-center sm:text-left min-w-0">
                            <span className="text-[9px] font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/10 dark:border-emerald-500/20 inline-block mb-3">
                              {liveStats.percentage >= 80 ? '✓ High Attendance' : liveStats.percentage >= 50 ? '● Active' : '○ Starting'}
                            </span>
                            <h4 className="text-foreground font-black text-lg tracking-tight leading-snug truncate">{liveMiqaat.name}</h4>
                            <p className="text-xs text-muted-foreground mt-1.5 font-medium">
                              {liveStats.markedCount} of {liveStats.total} members resolved.
                            </p>
                            <div className="mt-3.5 flex items-center justify-center sm:justify-start gap-1.5 text-xs text-muted-foreground/80">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                              </span>
                              <span className="font-semibold tracking-wide text-[11px] uppercase">Real-time Syncing</span>
                            </div>
                          </div>
                        </div>

                        {/* Interactive Stat Cards Grid */}
                        <div className="grid grid-cols-3 gap-3.5">
                          {/* Total Card */}
                          <button
                            onClick={() => { setLiveDetailFilter('all'); setLiveTeamFilter(null); setIsLiveDetailsOpen(true); }}
                            className="group relative flex flex-col items-start p-4 rounded-3xl border border-border bg-card hover:bg-muted/40 hover:shadow-md transition-all duration-300 text-left overflow-hidden shadow-sm"
                          >
                            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                              <Users className="h-10 w-10 text-foreground" />
                            </div>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total</span>
                            <span className="text-2xl sm:text-3xl font-black text-foreground mt-2.5 tabular-nums tracking-tight leading-none">{liveStats.total}</span>
                            <span className="text-[9px] font-semibold text-primary mt-3 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                              View All &rarr;
                            </span>
                          </button>

                          {/* Present Card */}
                          <button
                            onClick={() => { setLiveDetailFilter('present'); setLiveTeamFilter(null); setIsLiveDetailsOpen(true); }}
                            className="group relative flex flex-col items-start p-4 rounded-3xl border border-emerald-100 dark:border-emerald-950/60 bg-emerald-500/[0.02] dark:bg-emerald-500/[0.04] hover:bg-emerald-500/[0.06] dark:hover:bg-emerald-500/[0.08] hover:border-emerald-300 dark:hover:border-emerald-800 transition-all duration-300 text-left overflow-hidden shadow-sm"
                          >
                            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                              <UserCheck className="h-10 w-10 text-emerald-500" />
                            </div>
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Marked</span>
                            <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2.5 tabular-nums tracking-tight leading-none">{liveStats.markedCount}</span>
                            <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 mt-3 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                              View List &rarr;
                            </span>
                          </button>

                          {/* Remaining Card */}
                          <button
                            onClick={() => { setLiveDetailFilter('absent'); setLiveTeamFilter(null); setIsLiveDetailsOpen(true); }}
                            className="group relative flex flex-col items-start p-4 rounded-3xl border border-rose-100 dark:border-rose-950/60 bg-rose-500/[0.02] dark:bg-rose-500/[0.04] hover:bg-rose-500/[0.06] dark:hover:bg-rose-500/[0.08] hover:border-rose-300 dark:hover:border-rose-800 transition-all duration-300 text-left overflow-hidden shadow-sm"
                          >
                            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                              <UserMinus className="h-10 w-10 text-rose-500" />
                            </div>
                            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">Remaining</span>
                            <span className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 mt-2.5 tabular-nums tracking-tight leading-none">{liveStats.absentMembers.length}</span>
                            <span className="text-[9px] font-semibold text-rose-600 dark:text-rose-400 mt-3 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                              View List &rarr;
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Right Block: Team Breakdown & Leaderboard */}
                      <div className={cn("flex flex-col gap-4", isLiveMode ? "lg:col-span-7" : "")}>
                        
                        {/* A unified, styled panel for Team standings */}
                        <div className="border border-border bg-card rounded-3xl p-5 shadow-sm flex-grow flex flex-col min-h-0">
                          <div className="flex items-center justify-between pb-4 border-b border-border/60">
                            <div>
                              <h4 className="text-sm font-black text-foreground tracking-tight">Team Performance Ranks</h4>
                              <p className="text-[11px] text-muted-foreground mt-0.5">Click any team to filter its list</p>
                            </div>
                            <span className="text-[10px] font-bold bg-muted px-2.5 py-1 rounded-full text-muted-foreground font-mono">
                              {liveStats.teamBreakdown.length} Teams
                            </span>
                          </div>

                          {liveStats.teamBreakdown.length > 0 ? (
                            <div className={cn(
                              "grid gap-1.5 overflow-y-auto pr-1 mt-3 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-track]:bg-transparent",
                              isLiveMode ? "max-h-[50vh] lg:max-h-[55vh]" : "max-h-60"
                            )}>
                              {liveStats.teamBreakdown.map((row, idx) => {
                                const markedVal = row.present + row.safar;
                                const pct = row.total > 0 ? Math.round((markedVal / row.total) * 100) : 0;
                                return (
                                  <div
                                    key={row.name}
                                    onClick={() => { setLiveTeamFilter(row.name); setLiveDetailFilter('all'); setIsLiveDetailsOpen(true); }}
                                    className="group relative flex flex-col p-3 rounded-2xl border border-transparent hover:border-border hover:bg-muted/30 transition-all duration-200 cursor-pointer"
                                  >
                                    <div className="flex justify-between items-center gap-3">
                                      <div className="min-w-0 flex items-center gap-2.5">
                                        {/* Rank number or check dot */}
                                        <span className={cn(
                                          "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold font-mono shrink-0 shadow-sm border border-border/80",
                                          pct === 100
                                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900"
                                            : "bg-muted text-muted-foreground"
                                        )}>
                                          {idx + 1}
                                        </span>
                                        <div className="min-w-0">
                                          <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors block truncate max-w-[200px] sm:max-w-xs">{row.name}</span>
                                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                            <span>{row.present} present</span>
                                            {row.safar > 0 && (
                                              <>
                                                <span>•</span>
                                                <span>{row.safar} safar</span>
                                              </>
                                            )}
                                            <span>•</span>
                                            <span>{row.absent} remaining</span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="text-right shrink-0">
                                        <span className="font-black text-sm text-foreground tabular-nums">{pct}%</span>
                                        <p className="text-[10px] text-muted-foreground font-semibold mt-0.5 font-mono">{markedVal}/{row.total}</p>
                                      </div>
                                    </div>

                                    {/* Progress track */}
                                    <div className="mt-3 relative h-2 w-full rounded-full bg-muted overflow-hidden">
                                      {pct > 0 && (
                                        <div className="h-full rounded-full transition-all duration-700 ease-out"
                                          style={{
                                            width: `${pct}%`,
                                            background: pct >= 80 
                                              ? 'linear-gradient(90deg, #10b981, #34d399)' 
                                              : pct >= 40 
                                              ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' 
                                              : 'linear-gradient(90deg, #ef4444, #f87171)'
                                          }}
                                        />
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                              <span className="text-xs text-muted-foreground">No scoped teams found</span>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Hide normal dashboard when in live mode */}
        <div className={cn(isLiveMode ? "hidden" : "")}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Widget 1: Today's Miqaat Schedule */}
          <Card className="glass-surface border-white/20 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-primary shrink-0" />
                Today's Miqaat Schedule
              </CardTitle>
              <CardDescription>Scheduled events and sessions for today.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(() => {
                const today = new Date();
                const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
                const effectiveItsId = currentUser?.itsId || currentUserItsId;
                const effectiveMohallahId = currentUser?.mohallahId || currentUserMohallahId;
                const effectiveTeam = currentUser?.team;
                const isPrivilegedRole = currentUserRole === 'admin' || currentUserRole === 'superadmin' || currentUserRole === 'attendance-marker';

                const isEligibleForMiqaat = (miqaat: typeof allMiqaatsList[number]) => {
                  if (isPrivilegedRole) return true;
                  if (miqaat.eligibleItsIds?.length) {
                    return effectiveItsId ? miqaat.eligibleItsIds.includes(effectiveItsId) : false;
                  }

                  const isForEveryone = !miqaat.mohallahIds?.length && !miqaat.teams?.length;
                  if (isForEveryone) return true;

                  const eligibleByMohallah = !!effectiveMohallahId && !!miqaat.mohallahIds?.includes(effectiveMohallahId);
                  const eligibleByTeam = !!effectiveTeam && !!miqaat.teams?.includes(effectiveTeam);
                  return eligibleByMohallah || eligibleByTeam;
                };

                const resolveSessionDate = (value: string | undefined, fallback: string, day = 1) => {
                  if (value) {
                    const parsed = new Date(value);
                    if (!Number.isNaN(parsed.getTime())) return parsed;
                  }

                  const date = new Date(fallback);
                  date.setDate(date.getDate() + Math.max(day - 1, 0));
                  if (value && /^\d{1,2}:\d{2}/.test(value)) {
                    const [hours, minutes] = value.split(':').map(Number);
                    date.setHours(hours || 0, minutes || 0, 0, 0);
                  }
                  return date;
                };
                
                const todaysSchedule = allMiqaatsList
                  .filter(isEligibleForMiqaat)
                  .flatMap(miqaat => {
                    const sessions = miqaat.sessions?.length
                      ? miqaat.sessions
                      : [{ id: 'main', day: 1, name: 'Main Session', startTime: miqaat.startTime, endTime: miqaat.endTime }];

                    return sessions.map(session => {
                      const start = resolveSessionDate(session.startTime, miqaat.startTime, session.day || 1);
                      const end = resolveSessionDate(session.endTime, miqaat.endTime, session.day || 1);
                      return { miqaat, session, start, end };
                    });
                  })
                  .filter(item => item.start <= endOfToday && item.end >= startOfToday)
                  .sort((a, b) => a.start.getTime() - b.start.getTime());

                if (todaysSchedule.length === 0) {
                  return (
                    <div className="py-6 text-center text-muted-foreground text-sm">
                      No Miqaats scheduled for today.
                    </div>
                  );
                }

                return todaysSchedule.map(({ miqaat, session, start, end }) => {
                  const now = new Date();
                  const mStart = start;
                  const mEnd = end;
                  const isLive = now >= mStart && now <= mEnd;
                  const isUpcoming = now < mStart;
                  const isCompleted = now > mEnd;
                  const sessionId = session.id === 'main' ? undefined : session.id;
                  const attendanceForSession = sessionId
                    ? miqaat.attendance?.filter(a => a.sessionId === sessionId) || []
                    : miqaat.attendance || [];
                  const safarForSession = sessionId
                    ? miqaat.safarList?.filter(s => s.sessionId === sessionId) || []
                    : miqaat.safarList || [];

                  // Check own attendance status if regular member
                  let ownStatus = "Not Checked In";
                  if (effectiveItsId) {
                    const marked = attendanceForSession.find(a => a.userItsId === effectiveItsId);
                    const safar = safarForSession.find(s => s.userItsId === effectiveItsId);
                    if (marked) {
                      ownStatus = `Checked In (${marked.status.charAt(0).toUpperCase() + marked.status.slice(1)})`;
                    } else if (safar) {
                      ownStatus = "Excused (Safar)";
                    }
                  }

                  return (
                    <div key={`${miqaat.id}-${session.id}`} className="p-3 border border-border/40 rounded-lg bg-card/10 space-y-2.5">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="font-bold text-sm text-foreground">{miqaat.name}</h4>
                          <span className="text-xs text-muted-foreground">
                            {miqaat.type.charAt(0).toUpperCase() + miqaat.type.slice(1)} Miqaat
                            {session.name ? ` • ${session.name}` : ''}
                          </span>
                        </div>
                        <span className={cn(
                          "px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider",
                          isLive ? "bg-green-500/10 text-green-600 animate-pulse border border-green-500/20" :
                          isUpcoming ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {isLive ? "● Live Now" : isUpcoming ? "Upcoming" : "Completed"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground border-t border-border/20 pt-2">
                        <div><strong>Starts:</strong> {format(mStart, "p")}</div>
                        <div><strong>Ends:</strong> {format(mEnd, "p")}</div>
                      </div>

                      {/* Admin/Marker stats */}
                      {(currentUserRole === 'admin' || currentUserRole === 'superadmin' || currentUserRole === 'attendance-marker' || isTeamLead) ? (
                        <div className="flex justify-between items-center text-xs border-t border-border/20 pt-2 mt-1">
                          <div>
                            {(() => {
                              const presentItsIds = new Set(attendanceForSession.map(a => a.userItsId));
                              const uniqueSafarCount = safarForSession.filter(s => !presentItsIds.has(s.userItsId)).length || 0;
                              return (
                                <>
                                  <span>Present: <strong className="text-foreground">{attendanceForSession.length}</strong></span>
                                  <span className="mx-2 text-muted-foreground/30">|</span>
                                  <span>Safar: <strong className="text-foreground">{uniqueSafarCount}</strong></span>
                                  <span className="mx-2 text-muted-foreground/30">|</span>
                                  <span>Total (Inc. Safar): <strong className="text-primary font-bold">{attendanceForSession.length + uniqueSafarCount}</strong></span>
                                </>
                              );
                            })()}
                          </div>
                          <Button variant="ghost" size="sm" className="h-7 text-xs font-semibold text-primary px-2" asChild>
                            <Link href="/dashboard/mark-attendance">Mark Page →</Link>
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center text-xs border-t border-border/20 pt-2 mt-1">
                          <span>Your Status:</span>
                          <span className={cn(
                            "font-semibold",
                            ownStatus.startsWith("Checked In") ? "text-green-600 dark:text-green-400" :
                            ownStatus === "Excused (Safar)" ? "text-blue-600 dark:text-blue-400" :
                            "text-destructive"
                          )}>
                            {ownStatus}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </CardContent>
          </Card>

          {/* Widget 2: Quick Lookup & Mark (only for admins/markers) */}
          {(currentUserRole === 'admin' || currentUserRole === 'superadmin' || currentUserRole === 'attendance-marker') ? (
            <Card className="glass-surface border-white/20 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserSearch className="h-5 w-5 text-primary shrink-0" />
                  Quick Attendance Check
                </CardTitle>
                <CardDescription>Verify member status and mark present/safar instantly.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={(e) => { e.preventDefault(); handleQuickLookup(); }} className="flex gap-2">
                  <Input
                    placeholder="Enter ITS or BGK ID"
                    value={quickMemberId}
                    onChange={(e) => setQuickMemberId(e.target.value)}
                    className="text-sm h-9 flex-1"
                    disabled={isQuickProcessing}
                  />
                  <Button type="submit" size="sm" className="h-9" disabled={isQuickProcessing}>
                    {isQuickProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
                  </Button>
                </form>

                {quickMember && (
                  <div className="p-3 border border-border/40 rounded-lg bg-card/5 space-y-3 animate-in fade-in duration-300">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="font-bold text-sm">{quickMember.name}</p>
                        <p className="text-xs text-muted-foreground">ITS: {quickMember.itsId} | BGK: {quickMember.bgkId || "N/A"}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{quickMember.team || "No Team"} | {quickMember.mohallahId || "No Mohallah"}</p>
                      </div>
                      {quickMarkStatus && (
                        <span className={cn(
                          "px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider",
                          quickMarkStatus.startsWith("Present") ? "bg-green-500/10 text-green-600 border border-green-500/20" :
                          quickMarkStatus === "Safar" ? "bg-blue-500/10 text-blue-600 border border-blue-500/20" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {quickMarkStatus}
                        </span>
                      )}
                    </div>

                    {(() => {
                      const activeMiqaat = allMiqaatsList.find(m => {
                        const now = new Date();
                        return new Date(m.startTime) <= now && new Date(m.endTime) >= now;
                      });

                      if (!activeMiqaat) {
                        return <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">No active Miqaat currently running to mark attendance.</p>;
                      }

                      return (
                        <div className="space-y-2 pt-2 border-t border-border/10">
                          <p className="text-xs text-muted-foreground">Active Event: <strong className="text-foreground">{activeMiqaat.name}</strong></p>
                          {!quickMarkStatus ? (
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleQuickMark('present')}
                                size="sm"
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold text-xs h-8"
                                disabled={isQuickProcessing}
                              >
                                Mark Present
                              </Button>
                              <Button
                                onClick={() => handleQuickMark('safar')}
                                size="sm"
                                variant="outline"
                                className="flex-1 border-blue-500/30 hover:bg-blue-50 dark:hover:bg-blue-900/10 text-blue-600 dark:text-blue-400 font-semibold text-xs h-8"
                                disabled={isQuickProcessing}
                              >
                                Mark Safar
                              </Button>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">Already recorded for this event.</p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="glass-surface border-white/20 shadow-md flex flex-col justify-center items-center p-6 text-center">
              <Sparkles className="h-8 w-8 text-primary mb-3 shrink-0" />
              <h4 className="font-bold text-base text-foreground">Welcome to BGK Portal</h4>
              <CardDescription className="max-w-[80%] mt-1">
                Your attendance, daily Duas, and reports can be managed right from your sidebar menu options.
              </CardDescription>
            </Card>
          )}
        </div>
        </div>{/* end live-mode-hideable wrapper */}

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
              <Card key={stat.title} className="glass-surface border-white/20 glass-card-glow shadow-md overflow-hidden">
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
                <Card className="glass-surface border-white/20 shadow-md col-span-1 lg:col-span-2">
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

                <Card className="glass-surface border-white/20 shadow-md col-span-1 lg:col-span-2">
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

      {/* ========== LIVE DETAILS DIALOG (PREMIUM) ========== */}
      <Dialog open={isLiveDetailsOpen} onOpenChange={(open) => {
        setIsLiveDetailsOpen(open);
        if (!open) {
          setLiveSearchQuery("");
          setLiveTeamFilter(null);
        }
      }}>
        <DialogContent className="p-0 gap-0 w-[calc(100%-1.5rem)] sm:max-w-xl max-h-[85vh] flex flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl backdrop-blur-xl [&>button]:hidden">
          
          {/* Pulsing top red strip to indicate "Live" status */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-rose-400 to-red-600 animate-pulse z-10" />

          {/* Header */}
          <div className="relative px-4 py-5 sm:px-6 sm:pt-7 sm:pb-5 border-b border-border shrink-0 bg-muted/10">
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500">Live Attendance List</span>
                  {liveTeamFilter && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground flex items-center gap-1">
                      {liveTeamFilter}
                      <button onClick={() => setLiveTeamFilter(null)} className="hover:text-destructive transition-colors">
                        <X className="h-3 w-3 shrink-0" />
                      </button>
                    </span>
                  )}
                </div>
                <DialogTitle className="text-lg sm:text-xl font-black text-foreground tracking-tight">
                  {liveDetailFilter === 'all' ? 'All Eligible Members' :
                   liveDetailFilter === 'present' ? 'Present Members' :
                   liveDetailFilter === 'safar' ? 'Safar Members' : 'Remaining (Absent)'}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 font-medium">
                  <span>{liveMiqaat?.name}</span>
                </DialogDescription>
              </div>
              <DialogClose className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all duration-200">
                <X className="h-4 w-4" />
              </DialogClose>
            </div>

            {/* Search Box */}
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, ITS, or BGK ID..."
                value={liveSearchQuery}
                onChange={(e) => setLiveSearchQuery(e.target.value)}
                className="w-full bg-background border-border hover:border-border/80 focus:border-primary/30 pl-9 pr-8 sm:pl-10 sm:pr-9 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground rounded-2xl h-9 sm:h-10 transition-all focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary/50"
              />
              {liveSearchQuery && (
                <button onClick={() => setLiveSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Filter Tabs (Segmented Control style) */}
          {liveStats && (
            <div className="px-4 py-2.5 sm:px-6 sm:py-3 border-b border-border shrink-0 bg-muted/10">
              <div className="bg-muted/65 p-1 rounded-2xl flex gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                {(() => {
                  const filteredTotal = liveTeamFilter 
                    ? scopedLiveUsers.filter(u => (u.team || 'No Team') === liveTeamFilter).length
                    : liveStats.total;

                  const filteredPresent = liveTeamFilter
                    ? liveStats.presentMembers.filter(u => (u.team || 'No Team') === liveTeamFilter).length
                    : liveStats.presentMembers.length;

                  const filteredSafar = liveTeamFilter
                    ? liveStats.safarMembers.filter(u => (u.team || 'No Team') === liveTeamFilter).length
                    : liveStats.safarMembers.length;

                  const filteredAbsent = liveTeamFilter
                    ? liveStats.absentMembers.filter(u => (u.team || 'No Team') === liveTeamFilter).length
                    : liveStats.absentMembers.length;

                  return [
                    { key: 'all' as const, label: 'All', count: filteredTotal },
                    { key: 'present' as const, label: 'Present', count: filteredPresent },
                    { key: 'safar' as const, label: 'Safar', count: filteredSafar },
                    { key: 'absent' as const, label: 'Absent', count: filteredAbsent },
                  ].map(({ key, label, count }) => (
                    <button
                      key={key}
                      onClick={() => setLiveDetailFilter(key)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-[10px] sm:text-xs transition-all duration-300 min-w-0",
                        liveDetailFilter === key
                          ? "bg-background text-foreground shadow-sm font-black scale-[1.01]"
                          : "text-muted-foreground hover:text-foreground font-semibold"
                      )}
                    >
                      <span className="truncate">{label}</span>
                      <span className={cn(
                        "px-1 py-0.5 rounded-full text-[9px] font-black leading-none shrink-0",
                        liveDetailFilter === key ? "bg-muted text-foreground" : "bg-foreground/5 text-muted-foreground/80"
                      )}>
                        {count}
                      </span>
                    </button>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* List */}
          <div className="overflow-y-auto flex-1 px-4 py-3 sm:px-5 sm:py-4 min-h-[300px] bg-muted/5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25 [&::-webkit-scrollbar-track]:bg-transparent">
            {liveStats && (() => {
              // Filter by type
              let list = liveDetailFilter === 'all'
                ? scopedLiveUsers
                : liveDetailFilter === 'present'
                ? liveStats.presentMembers
                : liveDetailFilter === 'safar'
                ? liveStats.safarMembers
                : liveStats.absentMembers;

              // Filter by team if clicked
              if (liveTeamFilter) {
                list = list.filter(u => (u.team || 'No Team') === liveTeamFilter);
              }

              // Filter by search query
              if (liveSearchQuery.trim()) {
                const q = liveSearchQuery.toLowerCase();
                list = list.filter(u =>
                  u.name.toLowerCase().includes(q) ||
                  u.itsId.includes(q) ||
                  (u.bgkId && u.bgkId.toLowerCase().includes(q))
                );
              }

              if (list.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-muted border border-border flex items-center justify-center">
                      <Users className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">No matching members found</p>
                  </div>
                );
              }

              const getStatus = (m: User) => {
                if (liveMiqaat?.attendance?.find(a => a.userItsId === m.itsId)) return 'present';
                if (liveMiqaat?.safarList?.find(s => s.userItsId === m.itsId)) return 'safar';
                return 'absent';
              };

              return (
                <ul className="space-y-3 pb-4">
                  {list.map(m => {
                    const status = getStatus(m);
                    const initials = m.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <li key={m.id} className="flex items-center gap-2.5 sm:gap-4 p-2.5 sm:p-3.5 rounded-3xl border border-border bg-card hover:bg-muted/40 transition-all duration-200 shadow-sm hover:shadow-md">
                        <div className={cn(
                          "shrink-0 h-9 w-9 sm:h-11 sm:w-11 text-[10px] sm:text-xs rounded-2xl flex items-center justify-center font-black relative overflow-hidden",
                          status === 'present'
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-950"
                            : status === 'safar'
                            ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-950"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-950"
                        )}>
                          {initials || '?'}
                          {/* status small dot at bottom right */}
                          <span className={cn(
                            "absolute bottom-0 right-0 h-2 w-2 sm:h-2.5 sm:w-2.5 border border-background sm:border-2 rounded-full",
                            status === 'present' ? "bg-emerald-500" : status === 'safar' ? "bg-sky-500" : "bg-rose-500"
                          )} />
                        </div>
                        
                        <div className="flex-grow min-w-0">
                          <p className="font-extrabold text-xs sm:text-sm text-foreground truncate">{m.name}</p>
                          <div className="flex flex-wrap items-center gap-x-1.5 sm:gap-x-2 text-[9px] sm:text-[10px] text-muted-foreground mt-0.5 sm:mt-1 font-medium">
                            <span>ITS: <strong className="font-mono text-foreground/75 font-semibold">{m.itsId}</strong></span>
                            {m.bgkId && (
                              <>
                                <span className="text-muted-foreground/35">•</span>
                                <span>BGK: <strong className="font-mono text-foreground/75 font-semibold">{m.bgkId}</strong></span>
                              </>
                            )}
                            {m.team && (
                              <>
                                <span className="text-muted-foreground/35">•</span>
                                <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-bold text-[8px] sm:text-[9px] uppercase tracking-wide truncate max-w-[90px] sm:max-w-[150px]">{m.team}</span>
                              </>
                            )}
                          </div>
                        </div>
                        
                        <span className={cn(
                          "shrink-0 flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-2xl text-[8px] sm:text-[9px] font-black uppercase tracking-wider sm:tracking-widest border shadow-sm",
                          status === 'present'
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-950"
                            : status === 'safar'
                            ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-950"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-950"
                        )}>
                          {status === 'present' ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 shrink-0" />
                              <span>Present</span>
                            </>
                          ) : status === 'safar' ? (
                            <>
                              <Plane className="h-3 w-3 shrink-0" />
                              <span>Safar</span>
                            </>
                          ) : (
                            <>
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                              <span>Absent</span>
                            </>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              );
            })()}
          </div>
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
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">ITS: {member.itsId}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        disabled={sendingEmailItsId !== null || isSendingAbsenteeEmails}
                        onClick={() => handleSendSingleAbsenteeEmail(member)}
                      >
                        {sendingEmailItsId === member.itsId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Mail className="h-4 w-4" />
                        )}
                        <span className="sr-only">Email {member.name}</span>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-center">No absentees to display.</p>
            )}
          </div>
          <SheetFooter className="flex-row sm:justify-end gap-2">
             {selectedMiqaatForAbsentees && absenteeData.get(selectedMiqaatForAbsentees) && absenteeData.get(selectedMiqaatForAbsentees)!.absentees.length > 0 && (
               <Button 
                 onClick={handleSendEmailsFromDashboardSidebar} 
                 disabled={isSendingAbsenteeEmails}
                 className="flex-1 sm:flex-initial"
               >
                 {isSendingAbsenteeEmails ? (
                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                 ) : (
                   <Mail className="mr-2 h-4 w-4" />
                 )}
                 Email Absentees
               </Button>
             )}
             <Button variant="outline" onClick={() => setIsAbsenteeSheetOpen(false)} className="flex-1 sm:flex-initial">Close</Button>
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
