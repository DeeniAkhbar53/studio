

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Users, CalendarCheck, ScanLine, Loader2, Camera, CheckCircle2, XCircle, AlertCircleIcon, SwitchCamera, FileText, UserX, Edit, X, CalendarClock, CalendarDays, FilePenLine, Files, Building, BarChart2, ExternalLink, BookOpen, Mail, UserSearch, Sparkles, ChevronUp, ChevronDown, Check, TrendingUp, ArrowUpRight, LayoutDashboard, CheckCircle } from "lucide-react";
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
import { db } from "@/lib/firebase/firebase";
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


  const isTeamLead = useMemo(() => {
    if (!currentUserRole || !currentUserDesignation) return false;
    const isAdmin = currentUserRole === 'admin' || currentUserRole === 'superadmin';
    if (isAdmin) return true; // Treat admins as team leads for alert purposes
    const hasLeadershipDesignation = TEAM_LEAD_DESIGNATIONS.includes(currentUserDesignation);
    return hasLeadershipDesignation;
  }, [currentUserRole, currentUserDesignation]);

  // Tab State for Majestic Tabs Card
  const [activeTab, setActiveTab] = useState<'overview' | 'dua' | 'forms'>('overview');

  const todayStats = useMemo(() => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    
    const todaysMiqaats = allMiqaatsList.filter(m => {
      const mStart = new Date(m.startTime);
      return mStart >= startOfToday && mStart <= endOfToday;
    });

    let present = 0;
    let late = 0;
    let safar = 0;
    let totalEligible = 0;

    todaysMiqaats.forEach(m => {
      present += m.attendance?.filter(a => a.status === 'present' || a.status === 'early').length || 0;
      late += m.attendance?.filter(a => a.status === 'late').length || 0;
      safar += m.safarList?.length || 0;
      
      if (m.eligibleItsIds?.length) {
        totalEligible += m.eligibleItsIds.length;
      } else {
        totalEligible += stats.totalMembersCount || 100;
      }
    });

    const totalAttended = present + late;
    const attendanceRate = totalEligible > 0 ? Math.round((totalAttended / totalEligible) * 100) : 0;

    return {
      todaysMiqaatsCount: todaysMiqaats.length,
      present,
      late,
      safar,
      attendanceRate
    };
  }, [allMiqaatsList, stats.totalMembersCount]);

  const tabStats = useMemo(() => {
    switch (activeTab) {
      case 'overview':
        return [
          { label: "Active Miqaats", value: stats.activeMiqaatsCount, icon: CalendarDays, desc: "Scheduled for today" },
          { label: "Present Today", value: todayStats.present, icon: CheckCircle2, desc: "Marked present/early" },
          { label: "Late Today", value: todayStats.late, icon: Clock, desc: "Checked in late" },
          { label: "Safar Today", value: todayStats.safar, icon: UserX, desc: "Marked as excused safar" },
          { label: "Attendance Rate", value: `${todayStats.attendanceRate}%`, icon: BarChart2, desc: "Present out of eligible" },
        ];
      case 'dua':
        return [
          { label: "Weekly Dua Tilawat", value: isDuaPending ? "Pending" : "Completed", icon: BookOpen, desc: "Tilawat Kamil status" },
          { label: "Surah Kahf Status", value: isDuaPending ? "Pending" : "Completed", icon: Files, desc: "Kahf recitation status" },
          { label: "Recitation Target", value: "1 / week", icon: Timer, desc: "Required Kamil tilawat" },
          { label: "Kahf Target", value: "1 / week", icon: CalendarClock, desc: "Required Friday recitation" },
          { label: "Deadline Status", value: isDuaPending ? "Urgent" : "Good", icon: AlertCircleIcon, desc: "Tilawat deadline: Saturday" },
        ];
      case 'forms':
        return [
          { label: "Active Forms", value: stats.activeFormsCount, icon: FilePenLine, desc: "Accepting submissions" },
          { label: "Pending Forms", value: pendingForms.length, icon: FileText, desc: "Forms to be completed by you" },
          { label: "Total Forms", value: stats.totalFormsCount, icon: Files, desc: "Total created in system" },
          { label: "Form Notifications", value: formsWithNonRespondents.length, icon: Mail, desc: "Forms with active alerts" },
          { label: "Form Response Rate", value: activeFormsWithResponses && activeFormsWithResponses.length > 0 ? `${Math.round(activeFormsWithResponses.reduce((acc, f) => acc + f.responseRate, 0) / activeFormsWithResponses.length)}%` : "0%", icon: BarChart2, desc: "Average completion rate" },
        ];
    }
  }, [activeTab, stats, todayStats, isDuaPending, pendingForms.length, formsWithNonRespondents.length, activeFormsWithResponses]);

  const recentCheckIns = useMemo(() => {
    const list: { name: string; itsId: string; status: string; miqaatName: string; markedAt: string; markedBy: string }[] = [];
    allMiqaatsList.forEach(m => {
      m.attendance?.forEach(a => {
        list.push({
          name: a.userName,
          itsId: a.userItsId,
          status: a.status,
          miqaatName: m.name,
          markedAt: a.markedAt,
          markedBy: a.markedByItsId
        });
      });
      m.safarList?.forEach(s => {
        list.push({
          name: s.userName,
          itsId: s.userItsId,
          status: 'safar',
          miqaatName: m.name,
          markedAt: s.markedAt,
          markedBy: s.markedByItsId
        });
      });
    });
    // Sort in memory by markedAt descending
    list.sort((a, b) => new Date(b.markedAt).getTime() - new Date(a.markedAt).getTime());
    return list.slice(0, 8);
  }, [allMiqaatsList]);


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
          collection(db, "login_logs"),
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
    <div className="flex flex-col h-full space-y-6">
      {/* SECTION 1: Greeting & Title Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
            Welcome back, <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{currentUserName}</span>!
          </h2>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{currentUserDesignation || 'Member'}</span>
            <span>(Role: {currentUserRole?.toUpperCase()})</span>
            <span>•</span>
            <span className="hover:underline flex items-center gap-1">
              <LayoutDashboard className="h-3 w-3" /> Dashboard
            </span>
            <span>/</span>
            <span className="text-foreground font-medium">Overview</span>
          </div>
        </div>
        
        {/* Right Side Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 shrink-0">
          <Button variant="outline" size="sm" className="h-9 glass-surface border-white/20 text-xs gap-1.5 hover:bg-white/5" asChild>
            <Link href="/dashboard/profile">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline">Recent Logs</span>
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="h-9 glass-surface border-white/20 text-xs gap-1.5 hover:bg-white/5" asChild>
            <Link href="/dashboard/mark-attendance">
              <CalendarCheck className="h-3.5 w-3.5 text-accent" />
              <span className="hidden sm:inline">Mark Page</span>
            </Link>
          </Button>
          {isBarcodeScanningEnabled && (
            <Button
              onClick={() => { setScanDisplayMessage(null); setScannerError(null); setIsScannerDialogOpen(true); }}
              size="sm"
              className="h-9 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
            >
              <ScanLine className="h-3.5 w-3.5" />
              Scan QR
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Banners Carousel */}
      {combinedMobileAlerts.length > 0 && (
        <div className="block md:hidden relative w-full">
          <Carousel className="w-full">
            <CarouselContent>
              {combinedMobileAlerts.map(alert => (
                <CarouselItem key={alert.id}>
                  <div className="p-1">
                    <Alert variant={alert.variant} className="relative glass-surface border-white/20">
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

      {/* Desktop Alerts */}
      <div className="hidden md:block space-y-4">
        {isDuaPending && !isLoadingDuaStatus && (
          <Alert variant='default' className="relative glass-surface border-primary/20 bg-primary/5">
              <BookOpen className="h-4 w-4 text-primary" />
              <AlertTitle className="font-semibold text-primary">Weekly Dua Pending</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-2">
                  <span className="text-sm">Your weekly Dua Tilawat submission is pending. Please submit it before Saturday.</span>
                  <Button variant='default' size="sm" onClick={() => router.push('/dashboard/dua')} className="shrink-0">
                      Submit Now
                  </Button>
              </AlertDescription>
          </Alert>
        )}

        {pendingForms.length > 0 && !isLoadingPendingForms && !isTeamLead && (
           <Alert variant='default' className="relative glass-surface border-accent/20 bg-accent/5">
              <FileText className="h-4 w-4 text-accent" />
              <AlertTitle className="font-semibold text-accent">Pending Forms</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-2">
                  <span className="text-sm">You have {pendingForms.length} form(s) that need to be filled out.</span>
                  <Button variant='default' size="sm" onClick={() => setIsPendingFormsSheetOpen(true)} className="shrink-0">
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
                                  <Alert variant={alert.variant} className="relative glass-surface border-white/20">
                                      <alert.icon className="h-4 w-4" />
                                      <AlertTitle className="font-semibold">{alert.title}</AlertTitle>
                                      <AlertDescription className="flex items-center justify-between gap-2">
                                          <span className="text-sm">{alert.description}</span>
                                          <Button variant={alert.variant === 'destructive' ? 'destructive' : 'default'} size="sm" onClick={alert.action} className="shrink-0">
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
                          <CarouselPrevious className="absolute left-1 top-1/2 -translate-y-1/2 h-6 w-6 sm:-left-4 md:-left-12" />
                          <CarouselNext className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 sm:-right-4 md:-right-12" />
                      </>
                  )}
              </Carousel>
            </div>
        )}
      </div>

      {/* SECTION 2: Majestic Horizontal Tabs Metrics Card */}
      <Card className="glass-surface border-white/20 shadow-md overflow-hidden">
        <div className="flex border-b border-white/10 bg-white/5 px-4 overflow-x-auto whitespace-nowrap">
          <button
            onClick={() => setActiveTab('overview')}
            className={cn(
              "px-6 py-4.5 font-bold text-sm border-b-2 transition-all cursor-pointer flex items-center gap-2",
              activeTab === 'overview' 
                ? "border-primary text-foreground bg-white/5" 
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <CalendarCheck className="h-4 w-4" />
            Attendance Overview
          </button>
          <button
            onClick={() => setActiveTab('dua')}
            className={cn(
              "px-6 py-4.5 font-bold text-sm border-b-2 transition-all cursor-pointer flex items-center gap-2",
              activeTab === 'dua' 
                ? "border-primary text-foreground bg-white/5" 
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <BookOpen className="h-4 w-4" />
            Dua Tilawat
          </button>
          <button
            onClick={() => setActiveTab('forms')}
            className={cn(
              "px-6 py-4.5 font-bold text-sm border-b-2 transition-all cursor-pointer flex items-center gap-2",
              activeTab === 'forms' 
                ? "border-primary text-foreground bg-white/5" 
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <FileText className="h-4 w-4" />
            Forms & Surveys
          </button>
        </div>
        
        <CardContent className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {tabStats.map((stat, idx) => (
              <div 
                key={stat.label} 
                className={cn(
                  "p-4 rounded-lg bg-white/5 border border-white/10 flex items-center gap-4 transition-all hover:bg-white/10 glass-card-glow",
                  idx === 4 && "col-span-2 sm:col-span-1"
                )}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary shrink-0 shadow-inner">
                  <stat.icon className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-wider truncate">{stat.label}</p>
                  <h4 className="text-xl sm:text-2xl font-black text-foreground mt-0.5 truncate">{stat.value}</h4>
                  <p className="text-[10px] text-muted-foreground/85 mt-0.5 truncate">{stat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* SECTION 3: Grid of 4 Carousel Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        
        {/* Card 1: Today's Attendance */}
        <Card className="glass-surface border-white/20 shadow-md">
          <Carousel className="w-full">
            <CarouselContent>
              <CarouselItem>
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Today's Attendance</h4>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
                      <ChevronUp className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="relative flex items-center justify-center h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin-slow shrink-0 shadow-inner">
                      <span className="font-black text-sm text-foreground">{todayStats.attendanceRate}%</span>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Attendance Rate</p>
                      <h3 className="text-2xl font-black text-foreground mt-0.5">{todayStats.attendanceRate}%</h3>
                      <div className="flex items-center gap-1 text-[10px] text-green-500 font-semibold mt-1">
                        <TrendingUp className="h-3 w-3" />
                        <span>Highly Active Today</span>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-white/10 pt-3 flex justify-between items-center text-xs">
                    <div>
                      <p className="text-muted-foreground">Present Today</p>
                      <h5 className="font-bold text-foreground text-sm mt-0.5">{todayStats.present} members</h5>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground">Safar Today</p>
                      <h5 className="font-bold text-foreground text-sm mt-0.5">{todayStats.safar} excused</h5>
                    </div>
                  </div>
                </div>
              </CarouselItem>
              <CarouselItem>
                <div className="p-6 space-y-4">
                  <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Active Events</h4>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-foreground">Today's Events: {todayStats.todaysMiqaatsCount}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      All checks and scanning are online. Make sure members scan their barcodes at entry.
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" className="w-full text-xs font-bold text-primary border border-primary/20 hover:bg-primary/5 mt-4" asChild>
                    <Link href="/dashboard/mark-attendance">Open Marker Screen →</Link>
                  </Button>
                </div>
              </CarouselItem>
            </CarouselContent>
          </Carousel>
        </Card>

        {/* Card 2: Dua & Kahf Logs */}
        <Card className="glass-surface border-white/20 shadow-md">
          <Carousel className="w-full">
            <CarouselContent>
              <CarouselItem>
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Dua Tilawat</h4>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-accent border border-accent/20">
                      <BookOpen className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 border border-accent/20 text-accent shrink-0">
                      <CheckCircle className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Weekly Status</p>
                      <h3 className="text-xl sm:text-2xl font-black text-foreground mt-0.5">{isDuaPending ? "Pending" : "Submitted"}</h3>
                      <p className="text-[10px] text-muted-foreground/80 mt-1">Dua Kamil recitation log</p>
                    </div>
                  </div>
                  <div className="border-t border-white/10 pt-3 flex justify-between items-center text-xs">
                    <div>
                      <p className="text-muted-foreground">Kamil Status</p>
                      <h5 className="font-bold text-foreground text-sm mt-0.5">{isDuaPending ? "Not Done" : "Done"}</h5>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground">Kahf Recited</p>
                      <h5 className="font-bold text-foreground text-sm mt-0.5">{isDuaPending ? "Pending" : "Recited"}</h5>
                    </div>
                  </div>
                </div>
              </CarouselItem>
              <CarouselItem>
                <div className="p-6 space-y-4">
                  <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Weekly Requirements</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dua Tilawat Kamil:</span>
                      <span className={cn("font-bold", isDuaPending ? "text-amber-500" : "text-green-500")}>{isDuaPending ? "Pending" : "Completed"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Surah Kahf:</span>
                      <span className={cn("font-bold", isDuaPending ? "text-amber-500" : "text-green-500")}>{isDuaPending ? "Pending" : "Completed"}</span>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="w-full text-xs font-bold text-accent border border-accent/20 hover:bg-accent/5 mt-4" asChild>
                    <Link href="/dashboard/dua">Submit Recitations →</Link>
                  </Button>
                </div>
              </CarouselItem>
            </CarouselContent>
          </Carousel>
        </Card>

        {/* Card 3: Active Surveys */}
        <Card className="glass-surface border-white/20 shadow-md">
          <Carousel className="w-full">
            <CarouselContent>
              <CarouselItem>
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Pending Forms</h4>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                      <FileText className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 shrink-0 font-black text-2xl">
                      {pendingForms.length}
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">To-Do Forms</p>
                      <h3 className="text-xl sm:text-2xl font-black text-foreground mt-0.5">{pendingForms.length} Pending</h3>
                      <p className="text-[10px] text-muted-foreground/80 mt-1">Please fill pending surveys</p>
                    </div>
                  </div>
                  <div className="border-t border-white/10 pt-3 flex justify-between items-center text-xs">
                    <div>
                      <p className="text-muted-foreground">Active Surveys</p>
                      <h5 className="font-bold text-foreground text-sm mt-0.5">{stats.activeFormsCount} Open</h5>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground">Total Forms</p>
                      <h5 className="font-bold text-foreground text-sm mt-0.5">{stats.totalFormsCount} Created</h5>
                    </div>
                  </div>
                </div>
              </CarouselItem>
              <CarouselItem>
                <div className="p-6 space-y-3">
                  <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Forms Quick Links</h4>
                  <div className="max-h-24 overflow-y-auto space-y-1.5 scrollbar-thin">
                    {pendingForms.length > 0 ? (
                      pendingForms.map(form => (
                        <Link key={form.id} href={`/dashboard/forms/${form.id}`} className="block text-[11px] hover:underline text-foreground/90 font-medium truncate">
                          • {form.title}
                        </Link>
                      ))
                    ) : (
                      <p className="text-[11px] text-muted-foreground italic">No pending surveys.</p>
                    )}
                  </div>
                  <Button onClick={() => setIsPendingFormsSheetOpen(true)} size="sm" variant="ghost" className="w-full text-xs font-bold text-primary border border-primary/20 hover:bg-primary/5 mt-2">
                    Open Surveys Sheet →
                  </Button>
                </div>
              </CarouselItem>
            </CarouselContent>
          </Carousel>
        </Card>

        {/* Card 4: System Directory */}
        <Card className="glass-surface border-white/20 shadow-md">
          <Carousel className="w-full">
            <CarouselContent>
              <CarouselItem>
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Member Registry</h4>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      <Users className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 shrink-0 font-black text-2xl">
                      {stats.totalMembersCount || "..."}
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Registered Members</p>
                      <h3 className="text-xl sm:text-2xl font-black text-foreground mt-0.5">{stats.totalMembersCount || "..."} Members</h3>
                      <p className="text-[10px] text-muted-foreground/80 mt-1">Total database directory</p>
                    </div>
                  </div>
                  <div className="border-t border-white/10 pt-3 flex justify-between items-center text-xs">
                    <div>
                      <p className="text-muted-foreground">Total Mohallahs</p>
                      <h5 className="font-bold text-foreground text-sm mt-0.5">{stats.totalMohallahsCount || "..."} Mohallahs</h5>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground">Active Forms</p>
                      <h5 className="font-bold text-foreground text-sm mt-0.5">{stats.activeFormsCount} Forms</h5>
                    </div>
                  </div>
                </div>
              </CarouselItem>
              <CarouselItem>
                <div className="p-6 space-y-3">
                  <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Directory Summary</h4>
                  <div className="space-y-1 text-[11px] text-muted-foreground">
                    <p>Mohallah IDs tracked: {stats.totalMohallahsCount || "Multiple"}</p>
                    <p>Admin Control Panel active: {currentUserRole === 'superadmin' ? 'Superadmin Level' : 'Standard Level'}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="w-full text-xs font-bold text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/5 mt-4" asChild>
                    <Link href="/dashboard/manage-members">Open Directory →</Link>
                  </Button>
                </div>
              </CarouselItem>
            </CarouselContent>
          </Carousel>
        </Card>
      </div>

      {/* SECTION 4: Two-Column Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Card: Miqaat Attendance Trends (col-span-2) */}
        <Card className="glass-surface border-white/20 shadow-md col-span-1 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-primary shrink-0" />
              Miqaat Attendance Trends
            </CardTitle>
            <CardDescription>Visual stats for the last 5 completed events.</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {isLoadingChartData ? (
               <div className="flex items-center justify-center h-[300px]">
                <FunkyLoader>Loading Attendance Statistics...</FunkyLoader>
               </div>
            ) : attendanceChartData && attendanceChartData.length > 0 ? (
                <ChartContainer config={chartConfig} className="w-full h-[300px]">
                    <BarChart accessibilityLayer data={attendanceChartData}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                            dataKey="name"
                            tickLine={false}
                            tickMargin={10}
                            axisLine={false}
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                            tickFormatter={(value) => value.slice(0, 12) + (value.length > 12 ? '...' : '')}
                        />
                        <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar dataKey="present" fill="var(--color-present)" radius={[4, 4, 0, 0]} stackId="a" />
                        <Bar dataKey="late" fill="var(--color-late)" radius={[4, 4, 0, 0]} stackId="a" />
                        <Bar dataKey="absent" fill="var(--color-absent)" radius={[4, 4, 0, 0]} stackId="a" />
                    </BarChart>
                </ChartContainer>
            ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm italic">
                    No completed events data available.
                </div>
            )}
          </CardContent>
        </Card>

        {/* Right Card: Overall Performance Summary (col-span-1) */}
        <Card className="glass-surface border-white/20 shadow-md col-span-1 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-accent shrink-0" />
              Overall Summary
            </CardTitle>
            <CardDescription>General performance metrics.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-around py-4">
            <div className="text-center py-6">
              <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-foreground bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">{todayStats.attendanceRate}%</h1>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-2">Average Attendance Rate</h4>
              <p className="text-xs text-muted-foreground/80 max-w-[80%] mx-auto mt-2">
                Overall check-in compliance calculated across today's active Miqaat sessions.
              </p>
            </div>
            
            <div className="border-t border-white/10 pt-4 space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" /> Present Today</span>
                <span className="font-bold text-foreground">{todayStats.present} members</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent" /> Late Check-Ins</span>
                <span className="font-bold text-foreground">{todayStats.late} members</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" /> Excused (Safar)</span>
                <span className="font-bold text-foreground">{todayStats.safar} members</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 5: Recent Check-ins Activity Table */}
      <Card className="glass-surface border-white/20 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary shrink-0" />
              Recent Attendance Check-Ins
            </span>
            <span className="text-xs font-semibold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full uppercase tracking-wider">Real-Time</span>
          </CardTitle>
          <CardDescription>Live log of the last 8 attendance check-ins recorded in the system.</CardDescription>
        </CardHeader>
        <CardContent className="pt-2 overflow-x-auto">
          {recentCheckIns.length > 0 ? (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-muted-foreground font-semibold">
                  <th className="py-2.5">Member Name</th>
                  <th className="py-2.5">ITS ID</th>
                  <th className="py-2.5">Miqaat Event</th>
                  <th className="py-2.5">Time</th>
                  <th className="py-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentCheckIns.map((log, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 font-semibold text-foreground">{log.name}</td>
                    <td className="py-2.5 text-muted-foreground">{log.itsId}</td>
                    <td className="py-2.5 text-muted-foreground max-w-[200px] truncate">{log.miqaatName}</td>
                    <td className="py-2.5 text-muted-foreground">{format(new Date(log.markedAt), "p")}</td>
                    <td className="py-2.5 text-right">
                      <span className={cn(
                        "px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider border",
                        log.status === 'present' || log.status === 'early' 
                          ? "bg-green-500/10 text-green-500 border-green-500/20" 
                          : log.status === 'late' 
                            ? "bg-amber-500/10 text-amber-500 border-amber-500/20" 
                            : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                      )}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-6 text-center text-muted-foreground text-sm italic">
              No recent check-ins recorded today.
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION 6: Bottom Grid (3 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Column 1: Quick Check-In Lookup (Blue Theme Glassmorphism) */}
        {(currentUserRole === 'admin' || currentUserRole === 'superadmin' || currentUserRole === 'attendance-marker') ? (
          <Card className="glass-surface border-white/20 shadow-md bg-gradient-to-b from-blue-500/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <UserSearch className="h-5 w-5 text-blue-500 shrink-0" />
                Quick Attendance Check
              </CardTitle>
              <CardDescription>Verify member status and mark present/safar instantly.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <form onSubmit={(e) => { e.preventDefault(); handleQuickLookup(); }} className="flex gap-2">
                <Input
                  placeholder="Enter ITS or BGK ID"
                  value={quickMemberId}
                  onChange={(e) => setQuickMemberId(e.target.value)}
                  className="text-sm h-9 flex-1 glass-field"
                  disabled={isQuickProcessing}
                />
                <Button type="submit" size="sm" className="h-9 bg-blue-600 hover:bg-blue-700 text-white" disabled={isQuickProcessing}>
                  {isQuickProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
                </Button>
              </form>

              {quickMember && (
                <div className="p-3 border border-blue-500/20 rounded-lg bg-blue-500/5 space-y-3 animate-in fade-in duration-300">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-bold text-sm text-foreground">{quickMember.name}</p>
                      <p className="text-xs text-muted-foreground">ITS: {quickMember.itsId} | BGK: {quickMember.bgkId || "N/A"}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{quickMember.team || "No Team"} | {quickMember.mohallahId || "No Mohallah"}</p>
                    </div>
                    {quickMarkStatus && (
                      <span className={cn(
                        "px-2 py-0.5 text-[9px] font-bold rounded-full uppercase tracking-wider border",
                        quickMarkStatus.startsWith("Present") ? "bg-green-500/10 text-green-500 border-green-500/20" :
                        quickMarkStatus === "Safar" ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                        "bg-muted text-muted-foreground border-muted-foreground/20"
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
                      return <p className="text-[11px] text-amber-500 font-semibold">No active event currently running to mark attendance.</p>;
                    }

                    return (
                      <div className="space-y-2 pt-2 border-t border-white/5">
                        <p className="text-[11px] text-muted-foreground">Active Event: <strong className="text-foreground">{activeMiqaat.name}</strong></p>
                        {!quickMarkStatus ? (
                          <div className="flex gap-2 pt-1">
                            <Button
                              onClick={() => handleQuickMark('present')}
                              size="sm"
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold text-[11px] h-8"
                              disabled={isQuickProcessing}
                            >
                              Mark Present
                            </Button>
                            <Button
                              onClick={() => handleQuickMark('safar')}
                              size="sm"
                              variant="outline"
                              className="flex-1 border-blue-500/30 hover:bg-blue-500/10 text-blue-400 font-semibold text-[11px] h-8"
                              disabled={isQuickProcessing}
                            >
                              Mark Safar
                            </Button>
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground italic">Recorded for this session.</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-surface border-white/20 shadow-md flex flex-col justify-center items-center p-6 text-center bg-gradient-to-b from-blue-500/5 to-transparent">
            <Sparkles className="h-8 w-8 text-blue-500 mb-3 shrink-0" />
            <h4 className="font-bold text-base text-foreground">Welcome to BGK Portal</h4>
            <CardDescription className="max-w-[80%] mt-1 text-xs leading-relaxed">
              Your attendance, daily Duas, and reports can be managed right from your sidebar menu options.
            </CardDescription>
          </Card>
        )}

        {/* Column 2: Today's Schedule & Countdown (Amber Theme Glassmorphism) */}
        <Card className="glass-surface border-white/20 shadow-md bg-gradient-to-b from-amber-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-amber-500 shrink-0" />
              Today's Schedule
            </CardTitle>
            <CardDescription>Scheduled events and active countdowns.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {(() => {
              const today = new Date();
              const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
              const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
              
              const todaysMiqaats = allMiqaatsList.filter(m => {
                const mStart = new Date(m.startTime);
                return mStart >= startOfToday && mStart <= endOfToday;
              });

              if (todaysMiqaats.length === 0) {
                return (
                  <div className="py-8 text-center text-muted-foreground text-xs italic">
                    No events scheduled for today.
                  </div>
                );
              }

              return todaysMiqaats.map(miqaat => {
                const now = new Date();
                const mStart = new Date(miqaat.startTime);
                const mEnd = new Date(miqaat.endTime);
                const isLive = now >= mStart && now <= mEnd;
                const isUpcoming = now < mStart;

                let ownStatus = "Unmarked";
                if (currentUserItsId) {
                  const marked = miqaat.attendance?.find(a => a.userItsId === currentUserItsId);
                  const safar = miqaat.safarList?.find(s => s.userItsId === currentUserItsId);
                  if (marked) {
                    ownStatus = `Present (${marked.status})`;
                  } else if (safar) {
                    ownStatus = "Safar";
                  }
                }

                return (
                  <div key={miqaat.id} className="p-3 border border-amber-500/20 rounded-lg bg-amber-500/5 space-y-2">
                    <div className="flex justify-between items-center gap-2">
                      <h4 className="font-bold text-xs text-foreground truncate max-w-[120px]">{miqaat.name}</h4>
                      <span className={cn(
                        "px-1.5 py-0.5 text-[9px] font-bold rounded-full uppercase tracking-wider border",
                        isLive ? "bg-green-500/10 text-green-500 border-green-500/20 animate-pulse" :
                        isUpcoming ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                        "bg-muted text-muted-foreground border-muted-foreground/20"
                      )}>
                        {isLive ? "● Live" : isUpcoming ? "Upcoming" : "Ended"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-muted-foreground border-t border-white/5 pt-1.5">
                      <span>Time: {format(mStart, "p")} - {format(mEnd, "p")}</span>
                      <span className={cn(
                        "font-semibold",
                        ownStatus.startsWith("Present") ? "text-green-500" :
                        ownStatus === "Safar" ? "text-blue-400" : "text-destructive"
                      )}>
                        {ownStatus}
                      </span>
                    </div>
                  </div>
                );
              });
            })()}
          </CardContent>
        </Card>

        {/* Column 3: Quick Navigation Shortcuts (Green Theme Glassmorphism) */}
        <Card className="glass-surface border-white/20 shadow-md bg-gradient-to-b from-green-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-green-500 shrink-0" />
              Quick Operations
            </CardTitle>
            <CardDescription>One-click links to core pages.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2.5 pt-2">
            <Button variant="outline" size="sm" className="h-14 glass-surface border-white/10 flex flex-col justify-center items-center gap-1 hover:bg-white/5 cursor-pointer text-xs" asChild>
              <Link href="/dashboard/mark-attendance">
                <CalendarCheck className="h-5 w-5 text-primary" />
                <span>Attendance</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="h-14 glass-surface border-white/10 flex flex-col justify-center items-center gap-1 hover:bg-white/5 cursor-pointer text-xs" asChild>
              <Link href="/dashboard/dua">
                <BookOpen className="h-5 w-5 text-accent" />
                <span>Dua Entry</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="h-14 glass-surface border-white/10 flex flex-col justify-center items-center gap-1 hover:bg-white/5 cursor-pointer text-xs" asChild>
              <Link href="/dashboard/reports">
                <BarChart2 className="h-5 w-5 text-blue-500" />
                <span>Reports</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="h-14 glass-surface border-white/10 flex flex-col justify-center items-center gap-1 hover:bg-white/5 cursor-pointer text-xs" asChild>
              <Link href="/dashboard/profile">
                <Users className="h-5 w-5 text-emerald-500" />
                <span>My Profile</span>
              </Link>
            </Button>
          </CardContent>
        </Card>
        
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
