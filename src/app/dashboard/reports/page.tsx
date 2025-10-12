
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Search, Download, Loader2, AlertTriangle, BarChartHorizontal, BarChart, PieChart as PieChartIcon, CheckSquare, ShieldAlert, UserCheck, Users, UserX, HandCoins } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { toPng } from "html-to-image";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import type { Miqaat, User, ReportResultItem, AttendanceRecord, UserRole, Mohallah, UserDesignation, MiqaatAttendanceEntryItem, MiqaatSafarEntryItem, MiqaatSession } from "@/types";
import { getMiqaats, batchMarkSafarInMiqaat } from "@/lib/firebase/miqaatService";
import { getUsers } from "@/lib/firebase/userService";
import { getMohallahs } from "@/lib/firebase/mohallahService";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ChartContainer,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from "@/components/ui/chart";
import { allNavItems } from "@/components/dashboard/sidebar-nav";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FunkyLoader } from "@/components/ui/funky-loader";
import { Badge } from "@/components/ui/badge";


const reportSchema = z.object({
  reportType: z.enum(["miqaat_summary", "miqaat_safar_list", "member_attendance", "overall_activity", "non_attendance_miqaat"], {
    required_error: "You need to select a report type.",
  }),
  miqaatId: z.string().optional(),
  day: z.string().optional(),
  sessionId: z.string().optional(),
  itsId: z.string().optional().refine(val => !val || /^\d{8}$/.test(val), {
    message: "ITS ID must be 8 digits if provided.",
  }),
  dateRange: z.object({
    from: z.date().optional(),
    to: z.date().optional(),
  }).optional(),
  mohallahId: z.string().optional(),
  team: z.string().optional(),
  designation: z.string().optional(),
  status: z.string().optional(),
}).superRefine((data, ctx) => {
    if ((data.reportType === "miqaat_summary" || data.reportType === "non_attendance_miqaat" || data.reportType === "miqaat_safar_list") && !data.miqaatId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Miqaat selection is required for this report type.",
            path: ["miqaatId"],
        });
    }
    if (data.reportType === "member_attendance" && !data.itsId) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "ITS ID is required for Member Attendance report.",
            path: ["itsId"],
        });
    }
     if (data.dateRange?.from && data.dateRange?.to && data.dateRange.from > data.dateRange.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Start date cannot be after end date.",
        path: ["dateRange", "from"],
      });
    }
});

type ReportFormValues = z.infer<typeof reportSchema>;
type ChartDataItem = { name: string; present: number; late: number; totalAttendance: number };
type ChartType = "vertical_bar" | "horizontal_bar" | "pie";
type SummaryStats = {
    totalEligible: number;
    present: number;
    late: number;
    early: number;
    absent: number;
    safar: number;
    attendancePercentage: number;
};

const ALL_DESIGNATIONS: UserDesignation[] = ["Asst.Grp Leader", "Captain", "Group Leader", "J.Member", "Major", "Member", "Vice Captain"];
const ALL_STATUSES: AttendanceRecord['status'][] = ["present", "late", "early", "absent", "safar", "not-eligible"];


export default function ReportsPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [reportData, setReportData] = useState<ReportResultItem[] | null>(null);
  const [reportSearchTerm, setReportSearchTerm] = useState("");
  const [reportSummary, setReportSummary] = useState<SummaryStats | null>(null);
  const [chartData, setChartData] = useState<ChartDataItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [allMiqaats, setAllMiqaats] = useState<Pick<Miqaat, "id" | "name" | "startTime" | "endTime" | "reportingTime" | "mohallahIds" | "teams" | "eligibleItsIds" | "location" | "barcodeData" | "attendance" | "safarList" | "attendedUserItsIds" | "attendanceRequirements" | "sessions" | "type" | "attendanceType">[]>([]);
  const [allMohallahs, setAllMohallahs] = useState<Mohallah[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [currentUserMohallahId, setCurrentUserMohallahId] = useState<string | null>(null);
  const [currentUserItsId, setCurrentUserItsId] = useState<string | null>(null);
  const [miqaatTypeFilter, setMiqaatTypeFilter] = useState<'local' | 'international' | 'all'>('all');


  const [isGraphDialogOpen, setIsGraphDialogOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [chartType, setChartType] = useState<ChartType>("vertical_bar");
  const [downloadOptions, setDownloadOptions] = useState({ includeTitle: true, includeLegend: true });
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkMarking, setIsBulkMarking] = useState(false);

  const chartRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      reportType: undefined,
      miqaatId: "",
      day: "all",
      sessionId: "all",
      itsId: "",
      dateRange: { from: undefined, to: undefined },
      mohallahId: "all",
      team: "all",
      designation: "all",
      status: "all",
    },
  });

  useEffect(() => {
    const role = typeof window !== "undefined" ? localStorage.getItem('userRole') as UserRole : null;
    const mohallahId = typeof window !== "undefined" ? localStorage.getItem('userMohallahId') : null;
    const itsId = typeof window !== "undefined" ? localStorage.getItem('userItsId') : null;
    const pageRightsRaw = typeof window !== "undefined" ? localStorage.getItem('userPageRights') : '[]';
    const pageRights = JSON.parse(pageRightsRaw || '[]');
    const navItem = allNavItems.find(item => item.href === '/dashboard/reports');
    
    if (navItem) {
      const hasRoleAccess = navItem.allowedRoles?.includes(role || 'user');
      const hasPageRight = pageRights.includes(navItem.href);
      
      if (hasRoleAccess || hasPageRight) {
        setIsAuthorized(true);
        setCurrentUserRole(role);
        setCurrentUserMohallahId(mohallahId);
        setCurrentUserItsId(itsId);
        if (role === 'admin' && mohallahId) {
            form.setValue('mohallahId', mohallahId);
        }
      } else {
        setIsAuthorized(false);
        setTimeout(() => router.replace('/dashboard'), 2000);
      }
    } else {
       setIsAuthorized(false);
       setTimeout(() => router.replace('/dashboard'), 2000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);
  
  useEffect(() => {
    if (!isAuthorized) return;
    setIsLoadingOptions(true);
    const unsubMiqaats = getMiqaats(setAllMiqaats);
    const unsubMohallahs = getMohallahs(setAllMohallahs);
    
    getUsers().then(users => {
        setAllUsers(users);
    }).catch(err => {
        console.error("Failed to fetch teams for reports page", err);
    }).finally(() => {
        setIsLoadingOptions(false);
    });

    return () => {
        unsubMiqaats();
        unsubMohallahs();
    };
  }, [isAuthorized]);

  const { availableMiqaats, availableMohallahs, availableTeams } = useMemo(() => {
    let roleFilteredMiqaats = allMiqaats;
    if (miqaatTypeFilter !== 'all') {
      roleFilteredMiqaats = roleFilteredMiqaats.filter(m => m.type === miqaatTypeFilter);
    }
    
    if (currentUserRole === 'superadmin') {
      const allTeams = [...new Set(allUsers.map(u => u.team).filter(Boolean) as string[])].sort();
      return { availableMiqaats: roleFilteredMiqaats, availableMohallahs: allMohallahs, availableTeams: allTeams };
    }
    if (currentUserRole === 'admin' && currentUserMohallahId) {
      const filteredMiqaatsForAdmin = roleFilteredMiqaats.filter(m => !m.mohallahIds?.length || m.mohallahIds.includes(currentUserMohallahId));
      const filteredMohallahs = allMohallahs.filter(m => m.id === currentUserMohallahId);
      const usersInMohallah = allUsers.filter(u => u.mohallahId === currentUserMohallahId);
      const teamsInMohallah = [...new Set(usersInMohallah.map(u => u.team).filter(Boolean) as string[])].sort();
      return { availableMiqaats: filteredMiqaatsForAdmin, availableMohallahs: filteredMohallahs, availableTeams: teamsInMohallah };
    }
    return { availableMiqaats: [], availableMohallahs: [], availableTeams: [] };
  }, [currentUserRole, currentUserMohallahId, allMiqaats, allMohallahs, allUsers, miqaatTypeFilter]);


  const watchedReportType = form.watch("reportType");
  const watchedMiqaatId = form.watch("miqaatId");
  const watchedDay = form.watch("day");

  const selectedMiqaatForForm = useMemo(() => {
    return allMiqaats.find(m => m.id === watchedMiqaatId);
  }, [watchedMiqaatId, allMiqaats]);

  const availableDays = useMemo(() => {
    if (!selectedMiqaatForForm || selectedMiqaatForForm.type !== 'international') return [];
    return [...new Set(selectedMiqaatForForm.sessions?.map(s => s.day))].sort((a, b) => a - b);
  }, [selectedMiqaatForForm]);

  const availableSessionsForDay = useMemo(() => {
    if (!selectedMiqaatForForm || !watchedDay || watchedDay === 'all') return [];
    return selectedMiqaatForForm.sessions?.filter(s => s.day.toString() === watchedDay) || [];
  }, [selectedMiqaatForForm, watchedDay]);

  const onSubmit = async (values: ReportFormValues) => {
    setIsLoading(true);
    setReportData(null);
    setReportSearchTerm("");
    setChartData(null);
    setReportSummary(null);
    setSelectedIds([]);
    
    let reportResultItems: ReportResultItem[] = [];

    try {
      const allUsersForReport = await getUsers(); // Fetch latest user data for report generation
      const userMap = new Map(allUsersForReport.map(u => [u.itsId, u]));
      const selectedMiqaat = allMiqaats.find(m => m.id === values.miqaatId);

      const isSpecificMemberMiqaat = selectedMiqaat?.eligibleItsIds && selectedMiqaat.eligibleItsIds.length > 0;

      if (values.reportType === "miqaat_summary" && selectedMiqaat) {
          const attendanceRecords = selectedMiqaat.attendance || [];
          const safarRecords = selectedMiqaat.safarList || [];
          
          let eligibleUsers: User[];
          if (isSpecificMemberMiqaat) {
              eligibleUsers = allUsersForReport.filter(user => selectedMiqaat.eligibleItsIds!.includes(user.itsId));
          } else if (selectedMiqaat.mohallahIds && selectedMiqaat.mohallahIds.length > 0) {
              eligibleUsers = allUsersForReport.filter(user => user.mohallahId && selectedMiqaat.mohallahIds!.includes(user.mohallahId));
          } else if (selectedMiqaat.teams && selectedMiqaat.teams.length > 0) {
              eligibleUsers = allUsersForReport.filter(user => user.team && selectedMiqaat.teams!.includes(user.team));
          } else {
              eligibleUsers = allUsersForReport; // Open to all
          }

          const combinedRecords = eligibleUsers.map(user => {
              const allUserEntries = attendanceRecords.filter(a => a.userItsId === user.itsId);
              
              if (allUserEntries.length > 0) {
                  const regularEntry = allUserEntries[0];
                  const session = selectedMiqaat.sessions?.find(s => s.id === regularEntry.sessionId);
                  return { id: `${selectedMiqaat.id}-${user.itsId}`, userName: user.name, userItsId: user.itsId, bgkId: user.bgkId, team: user.team, miqaatName: selectedMiqaat.name, miqaatType: selectedMiqaat.type, day: session?.day, sessionName: session?.name || 'Main', date: regularEntry.markedAt, status: regularEntry.status || 'present', markedByItsId: regularEntry.markedByItsId, uniformCompliance: regularEntry.uniformCompliance };
              }

              const safarEntry = safarRecords.find(s => s.userItsId === user.itsId);
              if (safarEntry) {
                   const session = selectedMiqaat.sessions?.find(s => s.id === safarEntry.sessionId);
                  return { id: `${selectedMiqaat.id}-${user.itsId}`, userName: user.name, userItsId: user.itsId, bgkId: user.bgkId, team: user.team, miqaatName: selectedMiqaat.name, miqaatType: selectedMiqaat.type, day: session?.day, sessionName: session?.name || 'Main', date: safarEntry.markedAt, status: 'safar' as const, markedByItsId: safarEntry.markedByItsId };
              }
              return { id: `${selectedMiqaat.id}-${user.itsId}`, userName: user.name, userItsId: user.itsId, bgkId: user.bgkId, team: user.team, miqaatName: selectedMiqaat.name, miqaatType: selectedMiqaat.type, day: undefined, sessionName: 'N/A', date: selectedMiqaat.startTime, status: 'absent' as const };
          });
          
          if (!isSpecificMemberMiqaat) {
            allUsersForReport.forEach(user => {
              if (!eligibleUsers.some(eu => eu.id === user.id) && !combinedRecords.some(cr => cr.userItsId === user.itsId)) {
                combinedRecords.push({ id: `${selectedMiqaat.id}-${user.itsId}`, userName: user.name, userItsId: user.itsId, bgkId: user.bgkId, team: user.team, miqaatName: selectedMiqaat.name, miqaatType: selectedMiqaat.type, day: undefined, sessionName: 'N/A', date: selectedMiqaat.startTime, status: 'not-eligible' as const, });
              }
            });
          }

          reportResultItems = combinedRecords;

          const totalEligible = eligibleUsers.length;
          const presentCount = combinedRecords.filter(r => r.status === 'present').length;
          const lateCount = combinedRecords.filter(r => r.status === 'late').length;
          const earlyCount = combinedRecords.filter(r => r.status === 'early').length;
          const safarCount = combinedRecords.filter(r => r.status === 'safar').length;
          const absentCount = totalEligible - (presentCount + lateCount + earlyCount + safarCount);
          const totalAttended = presentCount + lateCount + earlyCount;
          const attendancePercentage = totalEligible > 0 ? (totalAttended / totalEligible) * 100 : 0;
          setReportSummary({
              totalEligible,
              present: presentCount,
              late: lateCount,
              early: earlyCount,
              absent: absentCount,
              safar: safarCount,
              attendancePercentage,
          });


      } else if (values.reportType === "miqaat_safar_list" && selectedMiqaat) {
          const safarList = selectedMiqaat.safarList || [];
          reportResultItems = safarList.map(safarEntry => {
            const session = selectedMiqaat.sessions?.find(s => s.id === safarEntry.sessionId);
            return {
              id: `${selectedMiqaat.id}-${safarEntry.userItsId}`, userName: safarEntry.userName, userItsId: safarEntry.userItsId, bgkId: userMap.get(safarEntry.userItsId)?.bgkId, team: userMap.get(safarEntry.userItsId)?.team, miqaatName: selectedMiqaat.name, miqaatType: selectedMiqaat.type, day: session?.day, sessionName: session?.name || 'Main', date: safarEntry.markedAt, status: 'safar', markedByItsId: safarEntry.markedByItsId,
            }
          });
      } else if (values.reportType === "member_attendance" && values.itsId) {
            const member = userMap.get(values.itsId);
            if (!member) {
                toast({ title: "User Not Found", description: `User with ITS ID ${values.itsId} not found.`, variant: "destructive" });
                setIsLoading(false);
                return;
            }

            const eligibleMiqaats = allMiqaats.filter(miqaat => {
                const isForEveryone = !miqaat.mohallahIds?.length && !miqaat.teams?.length && !miqaat.eligibleItsIds?.length;
                if (isForEveryone) return true;
                const eligibleById = !!miqaat.eligibleItsIds?.includes(member.itsId);
                const eligibleByTeam = !!member.team && !!miqaat.teams?.includes(member.team);
                const eligibleByMohallah = !!member.mohallahId && !!miqaat.mohallahIds?.includes(member.mohallahId);
                return eligibleById || eligibleByTeam || eligibleByMohallah;
            });

            const memberHistory: ReportResultItem[] = [];
            for (const miqaat of eligibleMiqaats) {
                const attendedEntry = miqaat.attendance?.find(a => a.userItsId === values.itsId);
                const safarEntry = miqaat.safarList?.find(s => s.userItsId === values.itsId);
                const session = miqaat.sessions?.find(s => s.id === (attendedEntry?.sessionId || safarEntry?.sessionId));

                if (attendedEntry) {
                    memberHistory.push({ id: `${miqaat.id}-${attendedEntry.userItsId}`, userName: attendedEntry.userName, userItsId: attendedEntry.userItsId, bgkId: member.bgkId, team: member.team, miqaatName: miqaat.name, miqaatType: miqaat.type, day: session?.day, sessionName: session?.name || 'Main', date: attendedEntry.markedAt, status: attendedEntry.status || 'present', markedByItsId: attendedEntry.markedByItsId, uniformCompliance: attendedEntry.uniformCompliance });
                } else if (safarEntry) {
                    memberHistory.push({ id: `${miqaat.id}-${safarEntry.userItsId}`, userName: safarEntry.userName, userItsId: safarEntry.userItsId, bgkId: member.bgkId, team: member.team, miqaatName: miqaat.name, miqaatType: miqaat.type, day: session?.day, sessionName: session?.name || 'Main', date: safarEntry.markedAt, status: 'safar', markedByItsId: safarEntry.markedByItsId });
                } else if (new Date() > new Date(miqaat.endTime)) { // Only show absent if Miqaat has ended
                    memberHistory.push({ id: `${miqaat.id}-${member.itsId}`, userName: member.name, userItsId: member.itsId, bgkId: member.bgkId, team: member.team, miqaatName: miqaat.name, miqaatType: miqaat.type, day: undefined, sessionName: "N/A", date: miqaat.startTime, status: 'absent' });
                }
            }
            reportResultItems = memberHistory.sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime());

      } else if (values.reportType === "overall_activity") {
          let allRecords: ReportResultItem[] = [];
          for (const miqaat of allMiqaats) {
              const attendanceRecords = miqaat.attendance || [];
              const safarRecords = miqaat.safarList || [];
              
              attendanceRecords.forEach(att => {
                const session = miqaat.sessions?.find(s => s.id === att.sessionId);
                allRecords.push({ id: `${miqaat.id}-${att.userItsId}`, userName: att.userName, userItsId: att.userItsId, bgkId: userMap.get(att.userItsId)?.bgkId, team: userMap.get(att.userItsId)?.team, miqaatName: miqaat.name, miqaatType: miqaat.type, day: session?.day, sessionName: session?.name || 'Main', date: att.markedAt, status: att.status || 'present', markedByItsId: att.markedByItsId, uniformCompliance: att.uniformCompliance })
              });

              safarRecords.forEach(safar => {
                const session = miqaat.sessions?.find(s => s.id === safar.sessionId);
                allRecords.push({ id: `${miqaat.id}-${safar.userItsId}`, userName: safar.userName, userItsId: safar.userItsId, bgkId: userMap.get(safar.userItsId)?.bgkId, team: userMap.get(safar.userItsId)?.team, miqaatName: miqaat.name, miqaatType: miqaat.type, day: session?.day, sessionName: session?.name || 'Main', date: safar.markedAt, status: 'safar', markedByItsId: safar.markedByItsId })
              });
          }
          reportResultItems = allRecords;

      } else if (values.reportType === "non_attendance_miqaat" && selectedMiqaat) {
          const attendedItsIds = new Set([
            ...(selectedMiqaat.attendance || []).map(a => a.userItsId),
            ...(selectedMiqaat.safarList || []).map(s => s.userItsId)
          ]);
        
          let eligibleUsers: User[];
          if (isSpecificMemberMiqaat) {
            eligibleUsers = allUsersForReport.filter(user => selectedMiqaat.eligibleItsIds!.includes(user.itsId));
          } else if (selectedMiqaat.mohallahIds && selectedMiqaat.mohallahIds.length > 0) {
            eligibleUsers = allUsersForReport.filter(user => user.mohallahId && selectedMiqaat.mohallahIds!.includes(user.mohallahId));
          } else if (selectedMiqaat.teams && selectedMiqaat.teams.length > 0) {
            eligibleUsers = allUsersForReport.filter(user => user.team && selectedMiqaat.teams!.includes(user.team));
          } else {
              eligibleUsers = allUsersForReport;
          }

          const nonAttendantUsers = eligibleUsers.filter(user => !attendedItsIds.has(user.itsId));
          reportResultItems = nonAttendantUsers.map(user => ({ id: user.id, userName: user.name, userItsId: user.itsId, bgkId: user.bgkId, team: user.team, miqaatName: selectedMiqaat.name, miqaatType: selectedMiqaat.type, day: undefined, sessionName: "N/A", date: new Date(selectedMiqaat.startTime).toISOString(), status: "absent", }));
      }

      let filteredData = [...reportResultItems];
      
      if (currentUserRole === 'admin' && currentUserMohallahId) {
          filteredData = filteredData.filter(record => {
              const userDetails = userMap.get(record.userItsId);
              return userDetails?.mohallahId === currentUserMohallahId;
          });
      }

      if (values.dateRange?.from) {
        filteredData = filteredData.filter(r => r.date && new Date(r.date) >= values.dateRange!.from!);
      }
      if (values.dateRange?.to) {
        filteredData = filteredData.filter(r => r.date && new Date(r.date) <= values.dateRange!.to!);
      }

      if (values.day && values.day !== 'all') {
        filteredData = filteredData.filter(r => r.day?.toString() === values.day);
      }
      if (values.sessionId && values.sessionId !== 'all') {
        const session = selectedMiqaatForForm?.sessions?.find(s => s.id === values.sessionId);
        filteredData = filteredData.filter(r => r.sessionName === session?.name);
      }

      filteredData = filteredData.filter(record => {
        const userDetails = userMap.get(record.userItsId);
        if (!userDetails) return false; 
        
        const mohallahMatch = values.mohallahId === 'all' || !values.mohallahId || userDetails.mohallahId === values.mohallahId;
        const teamMatch = values.team === 'all' || !values.team || userDetails.team === values.team;
        const designationMatch = values.designation === 'all' || !values.designation || userDetails.designation === values.designation;
        const statusMatch = values.status === 'all' || !values.status || record.status === values.status;

        return mohallahMatch && teamMatch && designationMatch && statusMatch;
      });
      
      setReportData(filteredData);

      if (values.reportType === "miqaat_summary" || values.reportType === "overall_activity") {
        const attendanceByMiqaat: { [key: string]: { present: number; late: number; totalAttendance: number } } = {};
        filteredData.forEach(record => {
          if (!attendanceByMiqaat[record.miqaatName]) {
            attendanceByMiqaat[record.miqaatName] = { present: 0, late: 0, totalAttendance: 0 };
          }
          if (record.status === "present" || record.status === "early") {
            attendanceByMiqaat[record.miqaatName].present++;
            attendanceByMiqaat[record.miqaatName].totalAttendance++;
          } else if (record.status === "late") {
            attendanceByMiqaat[record.miqaatName].late++;
            attendanceByMiqaat[record.miqaatName].totalAttendance++;
          }
        });
        const newChartData = Object.entries(attendanceByMiqaat).map(([name, counts]) => ({
          name,
          ...counts,
        }));
        setChartData(newChartData);
      } else {
        setChartData(null);
      }

      if (filteredData.length > 0) {
          toast({ title: "Report Generated", description: `Your report is ready below. Found ${filteredData.length} record(s).` });
      } else {
          toast({ title: "No Data", description: "No data found for the selected criteria.", variant: "default" });
      }

    } catch (error) {
        console.error("Error generating report:", error);
        toast({ title: "Report Generation Failed", description: "Could not generate report. Please try again.", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };

  const filteredReportData = useMemo(() => {
    if (!reportData) return null;
    if (!reportSearchTerm.trim()) return reportData;

    const lowercasedTerm = reportSearchTerm.toLowerCase();
    return reportData.filter(record => 
        record.userName.toLowerCase().includes(lowercasedTerm) ||
        record.userItsId.includes(lowercasedTerm) ||
        (record.bgkId || '').toLowerCase().includes(lowercasedTerm)
    );
  }, [reportData, reportSearchTerm]);

  const reportMiqaatType = useMemo(() => {
    if (!filteredReportData || filteredReportData.length === 0) return null;
    const miqaatId = form.getValues("miqaatId");
    if (miqaatId) {
      return allMiqaats.find(m => m.id === miqaatId)?.type || null;
    }
    return null;
  }, [filteredReportData, allMiqaats, form]);


  const handleExport = () => {
    if (!filteredReportData || filteredReportData.length === 0) {
      toast({ title: "No data to export", description: "Please generate a report first.", variant: "destructive" });
      return;
    }

    let headers = ["User Name", "ITS ID", "BGK ID", "Team", "Miqaat", "Miqaat Type", "Session Name", "Marked Date", "Marked Time", "Status", "Marked By ITS ID"];
    
    if (reportMiqaatType === 'local') {
      headers.push("Feta/Paghri", "Koti");
    } else if (reportMiqaatType === 'international') {
      headers.push("Uniform", "Shoes");
    }
    headers.push("NazrulMaqam Amount", "NazrulMaqam Currency");


    const csvRows = [
      headers.join(','),
      ...filteredReportData.map(row => {
          const date = row.date ? new Date(row.date) : null;
          let rowData = [
            `"${row.userName.replace(/"/g, '""')}"`,
            row.userItsId,
            row.bgkId || 'N/A',
            row.team || 'N/A',
            `"${row.miqaatName.replace(/"/g, '""')}"`,
            row.miqaatType,
            row.sessionName || 'N/A',
            date ? format(date, "yyyy-MM-dd") : "N/A",
            date ? format(date, "HH:mm:ss") : "N/A",
            row.status,
            row.markedByItsId || "N/A",
        ];

        if (reportMiqaatType === 'local') {
          rowData.push(
            row.uniformCompliance?.fetaPaghri ?? "N/A",
            row.uniformCompliance?.koti ?? "N/A",
          );
        } else if (reportMiqaatType === 'international') {
          rowData.push(
            row.uniformCompliance?.uniform ?? "N/A",
            row.uniformCompliance?.shoes ?? "N/A",
          );
        } else {
            // For reports that are not miqaat specific, add placeholders
            rowData.push("N/A", "N/A");
        }
        
        rowData.push(
            row.uniformCompliance?.nazrulMaqam?.amount?.toString() ?? "N/A",
            row.uniformCompliance?.nazrulMaqam?.currency ?? "N/A",
        );

        return rowData.join(',');
      })
    ];
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "attendance_report.csv");
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: "Report Exported", description: "CSV file downloaded." });
    } else {
      toast({ title: "Export Failed", description: "Your browser does not support this feature.", variant: "destructive" });
    }
  };
  
  const handleDownloadChart = () => {
    if (!chartRef.current) {
        toast({ title: "Error", description: "Chart element not found.", variant: "destructive" });
        return;
    }
    setIsDownloading(true);
    toPng(chartRef.current, { cacheBust: true, backgroundColor: '#ffffff', pixelRatio: 2 })
        .then((dataUrl) => {
            const link = document.createElement('a');
            const reportName = form.getValues("reportType").replace(/_/g, '-');
            link.download = `${reportName}_chart_${format(new Date(), 'yyyy-MM-dd')}.png`;
            link.href = dataUrl;
            link.click();
            toast({ title: "Chart Downloaded", description: "Image has been saved." });
        })
        .catch((err) => {
            console.error(err);
            toast({ title: "Download Failed", description: "Could not generate chart image.", variant: "destructive" });
        })
        .finally(() => setIsDownloading(false));
  };
  
  const handleBulkMarkAsSafar = async () => {
    const miqaatId = form.getValues("miqaatId");
    if (!miqaatId || selectedIds.length === 0) {
      toast({ title: "Selection Required", description: "Please select a Miqaat and at least one member to mark.", variant: "destructive" });
      return;
    }
    
    setIsBulkMarking(true);
    try {
      const markerId = currentUserItsId;
      if (!markerId) {
        throw new Error("Could not identify the person marking attendance.");
      }
      
      const safarEntries: MiqaatSafarEntryItem[] = filteredReportData!
        .filter(record => selectedIds.includes(record.userItsId))
        .map(record => ({
          userItsId: record.userItsId,
          userName: record.userName,
          markedAt: new Date().toISOString(),
          markedByItsId: markerId,
          status: 'safar',
        }));

      await batchMarkSafarInMiqaat(miqaatId, safarEntries);

      toast({
        title: "Bulk Update Successful",
        description: `${selectedIds.length} member(s) have been marked as 'Safar'.`,
      });
      
      await onSubmit(form.getValues());
      setSelectedIds([]);

    } catch (error) {
      console.error("Error during bulk mark as Safar:", error);
      toast({ title: "Update Failed", description: `Could not mark members as Safar. ${error instanceof Error ? error.message : 'Please try again.'}`, variant: "destructive" });
    } finally {
      setIsBulkMarking(false);
    }
  };


  const selectedMiqaatDetails = allMiqaats.find(m => m.id === form.getValues("miqaatId"));

  const chartConfig = {
      present: { label: "Present", color: "hsl(var(--chart-2))" },
      late: { label: "Late", color: "hsl(var(--chart-3))" },
      totalAttendance: { label: "Total", color: "hsl(var(--chart-1))" },
  };

  const pieChartColors = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
  const pieChartData = useMemo(() => {
    if (!chartData || chartType !== 'pie') return [];
    return chartData.map(item => ({ name: item.name, value: item.totalAttendance }));
  }, [chartData, chartType]);

  const canShowGraphButton = (watchedReportType === "miqaat_summary" || watchedReportType === "overall_activity") && chartData && chartData.length > 0;
  
  const dynamicChartHeight = useMemo(() => {
    if (chartType !== 'horizontal_bar' || !chartData) return 400; // Default height
    return Math.max(400, chartData.length * 40); // 40px per bar, with a minimum of 400px
  }, [chartData, chartType]);
  
  const isNonAttendanceReport = watchedReportType === 'non_attendance_miqaat';
  
  const handleSelectAllOnPage = (checked: boolean | string) => {
    if (checked && filteredReportData) {
      setSelectedIds(filteredReportData.map(r => r.userItsId));
    } else {
      setSelectedIds([]);
    }
  };

  if (isAuthorized === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <FunkyLoader size="lg" />
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
       <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
        <p className="text-muted-foreground mt-2">You do not have the required permissions to view this page.</p>
        <p className="text-sm text-muted-foreground mt-1">Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center"><BarChart className="mr-2 h-5 w-5 text-primary"/>Generate Attendance Report</CardTitle>
          <Separator className="my-2" />
          <CardDescription>Select criteria to generate a detailed attendance report from the system data.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                <FormField
                  control={form.control}
                  name="reportType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Report Type</FormLabel>
                      <Select onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue('miqaatId', ''); // Reset miqaat on report type change
                      }} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a report type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="miqaat_summary">Miqaat Summary (Roster)</SelectItem>
                          <SelectItem value="miqaat_safar_list">Miqaat Safar List</SelectItem>
                          <SelectItem value="non_attendance_miqaat">Miqaat Non-Attendance</SelectItem>
                          <SelectItem value="member_attendance">Member Full History</SelectItem>
                          <SelectItem value="overall_activity">Overall Activity Log</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {watchedReportType && (
                  <FormItem>
                      <FormLabel>Miqaat Type</FormLabel>
                      <RadioGroup
                          value={miqaatTypeFilter}
                          onValueChange={(value) => {
                              setMiqaatTypeFilter(value as 'local' | 'international' | 'all');
                              form.setValue('miqaatId', ''); // Reset miqaat selection
                          }}
                          className="flex space-x-4 pt-2"
                      >
                          <FormItem className="flex items-center space-x-2"><RadioGroupItem value="all" id="all-filter" /><Label htmlFor="all-filter">All</Label></FormItem>
                          <FormItem className="flex items-center space-x-2"><RadioGroupItem value="local" id="local-filter" /><Label htmlFor="local-filter">Local</Label></FormItem>
                          <FormItem className="flex items-center space-x-2"><RadioGroupItem value="international" id="international-filter" /><Label htmlFor="international-filter">International</Label></FormItem>
                      </RadioGroup>
                  </FormItem>
                )}

                {(watchedReportType === "miqaat_summary" || watchedReportType === "non_attendance_miqaat" || watchedReportType === "miqaat_safar_list") && (
                    <FormField
                      control={form.control}
                      name="miqaatId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Select Miqaat</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingOptions}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={isLoadingOptions ? "Loading Miqaats..." : "Select a Miqaat"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {isLoadingOptions && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                              {!isLoadingOptions && availableMiqaats.length === 0 && <SelectItem value="no-miqaats" disabled>No Miqaats available</SelectItem>}
                              {availableMiqaats.map(m => <SelectItem key={m.id} value={m.id}>{m.name} ({format(new Date(m.startTime), "P")})</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                )}


                {watchedReportType === "member_attendance" && (
                  <FormField
                    control={form.control}
                    name="itsId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ITS ID</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter 8-digit ITS ID" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                {selectedMiqaatForForm?.type === 'international' && (
                  <>
                    <FormField
                      control={form.control}
                      name="day"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Filter by Day</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="All Days" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="all">All Days</SelectItem>
                              {availableDays.map(day => <SelectItem key={day} value={day.toString()}>Day {day}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {selectedMiqaatForForm.attendanceType === 'multiple' && (
                       <FormField
                        control={form.control}
                        name="sessionId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Filter by Session</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} disabled={!watchedDay || watchedDay === 'all'}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="All Sessions for Day" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="all">All Sessions for Day</SelectItem>
                                {availableSessionsForDay.map(session => <SelectItem key={session.id} value={session.id}>{session.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </>
                )}

                <FormField
                  control={form.control}
                  name="dateRange"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date Range (for marked date)</FormLabel>
                       <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              id="date"
                              variant={"outline"}
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value?.from && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value?.from ? (
                                field.value.to ? (
                                  <>
                                    {format(field.value.from, "LLL dd, y")} -{" "}
                                    {format(field.value.to, "LLL dd, y")}
                                  </>
                                ) : (
                                  format(field.value.from, "LLL dd, y")
                                )
                              ) : (
                                <span>Pick a date range</span>
                              )}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={field.value?.from}
                            selected={field.value as DateRange | undefined}
                            onSelect={field.onChange}
                            numberOfMonths={2}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        Filters records based on their marked/event date.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

               <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="advanced-filters">
                  <AccordionTrigger>
                    <h3 className="text-md font-medium text-muted-foreground hover:no-underline">Advanced Filters</h3>
                  </AccordionTrigger>
                  <AccordionContent>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start pt-4">
                        <FormField
                            control={form.control}
                            name="mohallahId"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Filter by Mohallah</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingOptions || currentUserRole === 'admin'}>
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder={isLoadingOptions ? "Loading..." : "All Mohallahs"} />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="all">All Mohallahs</SelectItem>
                                        {availableMohallahs.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                 {currentUserRole === 'admin' && <FormDescription>Admins can only see reports for their own Mohallah.</FormDescription>}
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    
                     <FormField
                        control={form.control}
                        name="team"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Filter by Team</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingOptions}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder={isLoadingOptions ? "Loading..." : "All Teams"} />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="all">All Teams</SelectItem>
                                    {availableTeams.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="designation"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Filter by Designation</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Designations" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="all">All Designations</SelectItem>
                                    {ALL_DESIGNATIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Filter by Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Statuses" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    {ALL_STATUSES.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                 </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>


              <Button type="submit" disabled={isLoading || isLoadingOptions} className="min-w-[180px]">
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                {isLoading ? "Generating..." : isLoadingOptions ? "Loading Options..." : "Generate Report"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {reportData && (
        <Card className="shadow-lg mt-6">
          <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex-grow">
                <CardTitle>Report Results</CardTitle>
                <Separator className="my-2" />
                <CardDescription>
                    Displaying {filteredReportData?.length || 0} of {reportData.length} record(s) 
                    {(watchedReportType === "miqaat_summary" || watchedReportType === "non_attendance_miqaat" || watchedReportType === "miqaat_safar_list") && selectedMiqaatDetails && ` for Miqaat: ${selectedMiqaatDetails.name}`}
                    {watchedReportType === "member_attendance" && form.getValues("itsId") && ` for ITS ID: ${form.getValues("itsId")}`}
                    {form.getValues("dateRange.from") && ` from ${format(form.getValues("dateRange.from")!, "LLL dd, y")}`}
                    {form.getValues("dateRange.to") && ` to ${format(form.getValues("dateRange.to")!, "LLL dd, y")}`}.
                </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto shrink-0">
                {isNonAttendanceReport && selectedIds.length > 0 && (
                  <Button onClick={handleBulkMarkAsSafar} disabled={isBulkMarking} size="sm" className="w-full sm:w-auto">
                    {isBulkMarking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
                    Mark ({selectedIds.length}) as Safar
                  </Button>
                )}
                {canShowGraphButton && (
                  <Dialog open={isGraphDialogOpen} onOpenChange={setIsGraphDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full sm:w-auto">
                          <BarChart className="mr-2 h-4 w-4" /> Generate Graph
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[95vw] max-w-4xl h-[90vh] flex flex-col">
                        <DialogHeader>
                            <DialogTitle>Report Graph</DialogTitle>
                            <DialogDescription>
                                Visualize the attendance data from your report.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 flex-1 flex flex-col gap-4 min-h-0">
                            <div className="mb-4 p-4 border rounded-lg flex flex-col md:flex-row gap-4 items-center justify-between">
                                <div className="flex flex-col sm:flex-row gap-4 items-center">
                                    <div className="space-y-2">
                                        <Label htmlFor="chart-type">Chart Type</Label>
                                        <Select value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
                                            <SelectTrigger id="chart-type" className="w-full sm:w-[180px]">
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="vertical_bar">Vertical Bar</SelectItem>
                                                <SelectItem value="horizontal_bar">Horizontal Bar</SelectItem>
                                                <SelectItem value="pie">Pie Chart (by Miqaat)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2 self-start pt-2 sm:pt-0">
                                        <Label>Download Options</Label>
                                        <div className="flex gap-4 pt-2">
                                            <div className="flex items-center space-x-2">
                                                <Checkbox id="include-title" checked={downloadOptions.includeTitle} onCheckedChange={(c) => setDownloadOptions(prev => ({...prev, includeTitle: !!c}))} />
                                                <Label htmlFor="include-title" className="text-sm font-normal">Include Title</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Checkbox id="include-legend" checked={downloadOptions.includeLegend} onCheckedChange={(c) => setDownloadOptions(prev => ({...prev, includeLegend: !!c}))} />
                                                <Label htmlFor="include-legend" className="text-sm font-normal">Include Legend</Label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <Button onClick={handleDownloadChart} disabled={isDownloading} className="w-full md:w-auto">
                                    {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                    Download as PNG
                                </Button>
                            </div>

                            <div ref={chartRef} className="bg-background p-4 rounded-lg flex-1 overflow-auto">
                                {downloadOptions.includeTitle && <h3 className="text-lg font-semibold text-center mb-4">{form.getValues("reportType").replace(/_/g, ' ')} Report</h3>}
                                {chartData && chartData.length > 0 ? (
                                    <ChartContainer config={chartConfig} className="w-full" style={{ height: `${dynamicChartHeight}px`, minHeight: '400px' }}>
                                        {chartType === 'vertical_bar' && (
                                            <RechartsBarChart accessibilityLayer data={chartData}>
                                                <CartesianGrid vertical={false} />
                                                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} angle={-45} textAnchor="end" interval={0} height={120} />
                                                <YAxis />
                                                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                                                {downloadOptions.includeLegend && <ChartLegend content={<ChartLegendContent />} />}
                                                <Bar dataKey="present" fill="var(--color-present)" radius={4} stackId="a" />
                                                <Bar dataKey="late" fill="var(--color-late)" radius={4} stackId="a" />
                                            </RechartsBarChart>
                                        )}
                                        {chartType === 'horizontal_bar' && (
                                             <RechartsBarChart accessibilityLayer data={chartData} layout="vertical">
                                                <CartesianGrid horizontal={false} />
                                                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={8} width={150} interval={0} />
                                                <XAxis type="number" />
                                                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                                                {downloadOptions.includeLegend && <ChartLegend content={<ChartLegendContent />} />}
                                                <Bar dataKey="present" fill="var(--color-present)" radius={4} stackId="a" />
                                                <Bar dataKey="late" fill="var(--color-late)" radius={4} stackId="a" />
                                            </RechartsBarChart>
                                        )}
                                        {chartType === 'pie' && (
                                           <ResponsiveContainer width="100%" height="100%">
                                            <RechartsPieChart>
                                                 <ChartTooltip cursor={false} content={<ChartTooltipContent nameKey="name" indicator="dot" />} />
                                                 <Pie data={pieChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={'80%'} label>
                                                    {pieChartData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={pieChartColors[index % pieChartColors.length]} />
                                                    ))}
                                                 </Pie>
                                                  {downloadOptions.includeLegend && <ChartLegend content={<ChartLegendContent />} />}
                                            </RechartsPieChart>
                                            </ResponsiveContainer>
                                        )}
                                    </ChartContainer>
                                ) : (
                                    <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">
                                        <p>No data to display in chart.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </DialogContent>
                  </Dialog>
                )}
                <Button variant="outline" onClick={handleExport} disabled={!filteredReportData || filteredReportData.length === 0 || isLoading} size="sm" className="w-full sm:w-auto">
                  <Download className="mr-2 h-4 w-4" /> Export CSV
                </Button>
            </div>
          </CardHeader>
          <CardContent>
            {reportSummary && watchedReportType === 'miqaat_summary' && (
                <Card className="mb-6 bg-muted/30">
                    <CardHeader>
                        <CardTitle className="text-lg">Miqaat Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-center">
                            <div className="p-2 rounded-lg bg-background">
                                <p className="text-sm text-muted-foreground">Eligible</p>
                                <p className="text-2xl font-bold">{reportSummary.totalEligible}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                                <p className="text-sm text-green-800 dark:text-green-200">Present</p>
                                <p className="text-2xl font-bold text-green-900 dark:text-green-100">{reportSummary.present}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                                <p className="text-sm text-yellow-800 dark:text-yellow-200">Late</p>
                                <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{reportSummary.late}</p>
                            </div>
                             <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                                <p className="text-sm text-blue-800 dark:text-blue-200">Early</p>
                                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{reportSummary.early}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                                <p className="text-sm text-red-800 dark:text-red-200">Absent</p>
                                <p className="text-2xl font-bold text-red-900 dark:text-red-100">{reportSummary.absent}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                                <p className="text-sm text-indigo-800 dark:text-indigo-200">Safar</p>
                                <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">{reportSummary.safar}</p>
                            </div>
                        </div>
                         <div className="mt-4 text-center">
                                <p className="text-lg font-semibold">{reportSummary.attendancePercentage.toFixed(1)}%</p>
                                <p className="text-sm text-muted-foreground">Attendance Rate (Present+Late+Early / Eligible)</p>
                            </div>
                    </CardContent>
                </Card>
            )}

            <div className="relative mb-4">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search report results by name, ITS, or BGK ID..."
                className="pl-8 w-full md:w-1/2 lg:w-1/3"
                value={reportSearchTerm}
                onChange={(e) => setReportSearchTerm(e.target.value)}
              />
            </div>
            
            {filteredReportData && filteredReportData.length > 0 ? (
             <>
                <div className="md:hidden">
                  <Accordion type="single" collapsible className="w-full">
                    {filteredReportData.map((record, index) => (
                      <AccordionItem value={`${record.id}-${record.date || index}`} key={`${record.id}-${record.date || index}`}>
                        <div className="flex items-center w-full">
                          {isNonAttendanceReport && (
                            <div className="pl-4 py-4">
                              <Checkbox
                                id={`mobile-select-${record.userItsId}`}
                                checked={selectedIds.includes(record.userItsId)}
                                onCheckedChange={(checked) => {
                                  setSelectedIds(prev => checked ? [...prev, record.userItsId] : prev.filter(id => id !== record.userItsId));
                                }}
                                aria-label={`Select member ${record.userName}`}
                              />
                            </div>
                          )}
                          <AccordionTrigger className={cn("flex-grow", !isNonAttendanceReport && "pl-4")}>
                            <div className="flex items-center gap-4 flex-grow text-left">
                              <span className="text-sm font-mono text-muted-foreground">{index + 1}.</span>
                              <div className="flex-grow">
                                <p className="font-semibold text-card-foreground">{record.userName}</p>
                                <p className="text-xs text-muted-foreground">ITS: {record.userItsId}</p>
                              </div>
                              <span className={cn("px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap",
                                record.status === 'present' || record.status === 'early' ? 'bg-green-100 text-green-800' :
                                record.status === 'absent' ? 'bg-red-100 text-red-800' :
                                record.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                                record.status === 'safar' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              )}>
                                {record.status}
                              </span>
                            </div>
                          </AccordionTrigger>
                        </div>
                        <AccordionContent className="space-y-2 pt-2">
                          <div className="px-2 text-sm text-muted-foreground">
                            <div><strong>BGK ID:</strong> {record.bgkId || "N/A"}</div>
                            <div><strong>Team:</strong> {record.team || "N/A"}</div>
                            <div><strong>Miqaat:</strong> {record.miqaatName}</div>
                            <div><strong>Type:</strong> <Badge variant={record.miqaatType === 'local' ? 'outline' : 'secondary'}>{record.miqaatType}</Badge></div>
                            <div><strong>Session:</strong> {record.sessionName || "N/A"}</div>
                            <div><strong>Date:</strong> {record.date ? format(new Date(record.date), "PP p") : "N/A"}</div>
                            {(watchedReportType === "miqaat_summary" || watchedReportType === "overall_activity" || watchedReportType === "member_attendance") &&
                              <div><strong>Marked By:</strong> {record.markedByItsId || "N/A"}</div>
                            }
                            {record.uniformCompliance && (
                              <>
                                {reportMiqaatType === 'local' && <div><strong>Feta/Paghri:</strong> {record.uniformCompliance.fetaPaghri ?? 'N/A'}</div>}
                                {reportMiqaatType === 'local' && <div><strong>Koti:</strong> {record.uniformCompliance.koti ?? 'N/A'}</div>}
                                {reportMiqaatType === 'international' && <div><strong>Uniform:</strong> {record.uniformCompliance.uniform ?? 'N/A'}</div>}
                                {reportMiqaatType === 'international' && <div><strong>Shoes:</strong> {record.uniformCompliance.shoes ?? 'N/A'}</div>}
                                <div><strong>Nazrul Maqam:</strong> {record.uniformCompliance.nazrulMaqam ? `${record.uniformCompliance.nazrulMaqam.amount} ${record.uniformCompliance.nazrulMaqam.currency}` : 'N/A'}</div>
                              </>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>


                <div className="hidden md:block overflow-x-auto border rounded-lg">
                    <Table>
                    <TableHeader>
                        <TableRow>
                          {isNonAttendanceReport && (
                            <TableHead className="w-[50px]">
                              <Checkbox
                                onCheckedChange={handleSelectAllOnPage}
                                checked={filteredReportData.length > 0 && selectedIds.length === filteredReportData.length}
                                aria-label="Select all"
                              />
                            </TableHead>
                          )}
                        <TableHead className="w-[50px]">Sr.No.</TableHead>
                        <TableHead>Member Name</TableHead>
                        <TableHead>ITS ID</TableHead>
                        <TableHead>BGK ID</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead>Miqaat</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Session</TableHead>
                        <TableHead>Date / Time</TableHead>
                        <TableHead>Status</TableHead>
                        {reportMiqaatType === 'local' ? ( <>
                            <TableHead>Feta/Paghri</TableHead>
                            <TableHead>Koti</TableHead>
                        </> ) : reportMiqaatType === 'international' ? ( <>
                            <TableHead>Uniform</TableHead>
                            <TableHead>Shoes</TableHead>
                        </> ) : null}
                        <TableHead>N.Maqam Amount</TableHead>
                        <TableHead>N.Maqam Currency</TableHead>
                        { (watchedReportType === "miqaat_summary" || watchedReportType === "overall_activity" || watchedReportType === "member_attendance") &&
                            <TableHead className="text-right">Marked By</TableHead>
                        }
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredReportData.map((record, index) => (
                        <TableRow key={`${record.id}-${record.date || index}`}>
                            {isNonAttendanceReport && (
                                <TableCell>
                                    <Checkbox
                                    checked={selectedIds.includes(record.userItsId)}
                                    onCheckedChange={(checked) => {
                                        setSelectedIds(prev => checked ? [...prev, record.userItsId] : prev.filter(id => id !== record.userItsId));
                                    }}
                                    aria-label={`Select row for ${record.userName}`}
                                    />
                                </TableCell>
                            )}
                            <TableCell>{index + 1}</TableCell>
                            <TableCell className="font-medium">{record.userName}</TableCell>
                            <TableCell>{record.userItsId}</TableCell>
                            <TableCell>{record.bgkId || 'N/A'}</TableCell>
                            <TableCell>{record.team || 'N/A'}</TableCell>
                            <TableCell>{record.miqaatName}</TableCell>
                            <TableCell><Badge variant={record.miqaatType === 'local' ? 'outline' : 'secondary'}>{record.miqaatType}</Badge></TableCell>
                             <TableCell>{record.sessionName || 'N/A'}</TableCell>
                            <TableCell>{record.date ? format(new Date(record.date), "PP p") : "N/A"}</TableCell>
                            <TableCell>
                                <span className={cn("px-2 py-0.5 text-xs font-semibold rounded-full",
                                    record.status === 'present' || record.status === 'early' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                    record.status === 'absent' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                    record.status === 'late' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                    record.status === 'safar' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                )}>
                                    {record.status}
                                </span>
                            </TableCell>
                            {reportMiqaatType === 'local' && <>
                                <TableCell>{record.uniformCompliance?.fetaPaghri ?? 'N/A'}</TableCell>
                                <TableCell>{record.uniformCompliance?.koti ?? 'N/A'}</TableCell>
                            </>}
                             {reportMiqaatType === 'international' && <>
                                <TableCell>{record.uniformCompliance?.uniform ?? 'N/A'}</TableCell>
                                <TableCell>{record.uniformCompliance?.shoes ?? 'N/A'}</TableCell>
                            </>}
                            <TableCell>{record.uniformCompliance?.nazrulMaqam?.amount ?? 'N/A'}</TableCell>
                            <TableCell>{record.uniformCompliance?.nazrulMaqam?.currency ?? 'N/A'}</TableCell>
                            { (watchedReportType === "miqaat_summary" || watchedReportType === "overall_activity" || watchedReportType === "member_attendance") &&
                                <TableCell className="text-right">{record.markedByItsId || "N/A"}</TableCell>
                            }
                        </TableRow>
                        ))}
                    </TableBody>
                    </Table>
                </div>
             </>
            ) : (
              <div className="text-center text-muted-foreground py-6">No records found matching your search term.</div>
            )}
            {!filteredReportData && <div className="text-center text-muted-foreground py-6">No data found for the selected criteria.</div>}
          </CardContent>
        </Card>
      )}

      {!isLoading && reportData === null && !isLoadingOptions && (
         <Card className="shadow-lg mt-6">
            <CardContent className="py-10 flex flex-col items-center justify-center">
                <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
                <div className="text-center text-muted-foreground">
                    Please select your report criteria and click &quot;Generate Report&quot; to view data.
                </div>
            </CardContent>
         </Card>
      )}
      {(isLoadingOptions && reportData === null) && (
        <Card className="shadow-lg mt-6">
            <CardContent className="py-10 flex justify-center items-center">
                <FunkyLoader>
                    Loading report options...
                </FunkyLoader>
            </CardContent>
         </Card>
      )}
    </div>
  );
}
