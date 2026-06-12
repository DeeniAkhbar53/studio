

"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Search, Download, Loader2, AlertTriangle, BarChart, PieChart as PieChartIcon, CheckSquare, ShieldAlert, UserCheck, Users, UserX, HandCoins, Printer, X, Mail, FileSpreadsheet, RefreshCw } from "lucide-react";
import type { DateRange } from "react-day-picker";
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';


import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import type { Miqaat, User, ReportResultItem, AttendanceRecord, UserRole, Mohallah, UserDesignation, MiqaatAttendanceEntryItem, MiqaatSafarEntryItem, MiqaatSession, Form as FormType, FormResponse, SystemLog, DuaAttendance } from "@/types";
import { getMiqaats, batchMarkSafarInMiqaat } from "@/lib/firebase/miqaatService";
import { getUsers, getDuaAttendanceForUser, getUserByItsOrBgkId } from "@/lib/firebase/userService";
import { getLoginLogsForUser } from "@/lib/firebase/logService";
import { getMohallahs } from "@/lib/firebase/mohallahService";
import { getFormResponsesForUser, getForms } from "@/lib/firebase/formService";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogTrigger, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { findNavItem } from "@/components/dashboard/sidebar-nav";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FunkyLoader } from "@/components/ui/funky-loader";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";


const reportSchema = z.object({
  reportType: z.enum(["miqaat_summary", "miqaat_safar_list", "member_attendance", "overall_activity", "non_attendance_miqaat"], {
    required_error: "You need to select a report type.",
  }),
  miqaatIds: z.array(z.string()).optional(),
  day: z.string().optional(),
  sessionId: z.string().optional(),
  memberId: z.string().optional(),
  dateRange: z.object({
    from: z.date().optional(),
    to: z.date().optional(),
  }).optional(),
  mohallahId: z.string().optional(),
  team: z.string().optional(),
  designation: z.string().optional(),
  status: z.string().optional(),
}).superRefine((data, ctx) => {
    if ((data.reportType === "miqaat_summary" || data.reportType === "non_attendance_miqaat" || data.reportType === "miqaat_safar_list") && (!data.miqaatIds || data.miqaatIds.length === 0)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "At least one Miqaat selection is required for this report type.",
            path: ["miqaatIds"],
        });
    }
    if (data.reportType === "member_attendance" && !data.memberId) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "ITS or BGK ID is required for Member Report.",
            path: ["memberId"],
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
interface MemberProfileData {
    user: User;
    attendanceHistory: AttendanceRecord[];
    duaHistory: DuaAttendance[];
    formHistory: FormHistoryStatus[];
    loginHistory: SystemLog[];
}
interface FormHistoryStatus extends FormType {
  submissionStatus: 'Filled' | 'Not Filled';
  submittedAt?: string;
}

const ALL_DESIGNATIONS: UserDesignation[] = ["Asst.Grp Leader", "Captain", "Group Leader", "J.Member", "Major", "Member", "Vice Captain"];
const ALL_STATUSES: ('present' | 'late' | 'early' | 'absent' | 'safar')[] = ["present", "late", "early", "absent", "safar"];

const getFormattedStatus = (status: string) => {
  if (status === 'early' || status === 'late') {
    return `Present (${status.charAt(0).toUpperCase() + status.slice(1)})`;
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const MemberProfileReport = ({ data, generatorName }: { data: MemberProfileData; generatorName: string }) => {
    const { toast } = useToast();
    const pdfExportRef = useRef<HTMLDivElement>(null);

    const attendanceStats = useMemo(() => {
        return data.attendanceHistory.reduce((acc, record) => {
            if (record.status === 'present' || record.status === 'early') acc.present++;
            else if (record.status === 'late') acc.late++;
            else if (record.status === 'absent') acc.absent++;
            return acc;
        }, { present: 0, late: 0, absent: 0 });
    }, [data.attendanceHistory]);
    
    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            const printDocument = printWindow.document;
            const tables = {
                'Attendance History': data.attendanceHistory,
                'Dua Submissions': data.duaHistory,
                'Form History': data.formHistory,
            };

            const tableHeaders: { [key: string]: string[] } = {
                'Attendance History': ['#', 'Miqaat', 'Date', 'Status'],
                'Dua Submissions': ['#', 'Week ID', 'Dua Kamil', 'Surat Kahf', 'Submitted'],
                'Form History': ['#', 'Form Title', 'Status', 'Date'],
            };
            
            const tableRowRenderers: { [key: string]: (item: any, index: number) => string } = {
                'Attendance History': (item, i) => `<td>${i + 1}</td><td>${item.miqaatName}</td><td>${format(new Date(item.markedAt), "PP p")}</td><td>${getFormattedStatus(item.status)}</td>`,
                'Dua Submissions': (item, i) => `<td>${i + 1}</td><td>${item.weekId}</td><td>${item.duaKamilCount}</td><td>${item.kahfCount}</td><td>${format(new Date(item.markedAt), "PP p")}</td>`,
                'Form History': (item, i) => `<td>${i + 1}</td><td>${item.title}</td><td>${item.submissionStatus}</td><td>${item.submissionStatus === 'Filled' && item.submittedAt ? format(new Date(item.submittedAt), "PP p") : 'N/A'}</td>`,
            };

            const tableHtml = Object.entries(tables).map(([title, tableData]) => {
                if (!tableData || tableData.length === 0) return '';
                return `
                    <div class="table-container">
                        <h2>${title}</h2>
                        <table>
                            <thead>
                                <tr>${tableHeaders[title].map(h => `<th>${h}</th>`).join('')}</tr>
                            </thead>
                            <tbody>
                                ${tableData.map((item, i) => `<tr>${tableRowRenderers[title](item, i)}</tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }).join('');
            
             printDocument.write(`
                <html>
                    <head>
                        <title>Member Report - ${data.user.name}</title>
                        <style>
                            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; margin: 0; padding: 0; background-color: #fff; color: #1F2A37; }
                            .container { width: 100%; max-width: 100%; padding: 2rem; box-sizing: border-box; }
                            .header { text-align: center; margin-bottom: 2rem; }
                            .header h1 { font-size: 1.8rem; margin: 0; color: #0A314D; }
                            .header p { margin: 0.25rem 0; font-size: 1rem; color: #4A5568; }
                            .generated-by { font-size: 0.8rem; color: #718096; margin-top: 1rem; }
                            .summary { display: flex; justify-content: space-around; text-align: center; padding: 1.5rem 0; background-color: #F7F4EE; border-radius: 8px; margin-bottom: 2.5rem; }
                            .summary-item b { font-size: 1.5rem; display: block; color: #0A314D; }
                            .summary-item span { font-size: 0.9rem; color: #4A5568; }
                            .table-container { margin-bottom: 2.5rem; page-break-inside: avoid; }
                            h2 { font-size: 1.5rem; color: #0A314D; border-bottom: 2px solid #EABD13; padding-bottom: 0.5rem; margin-bottom: 1.5rem; }
                            table { width: 100%; border-collapse: collapse; }
                            thead { display: table-header-group; }
                            th, td { padding: 0.8rem 1rem; text-align: left; border-bottom: 1px solid #E2E8F0; }
                            th { background-color: #F7F4EE; font-weight: 600; color: #2D3748; }
                            tbody tr:nth-child(even) { background-color: #F7F4EE; }
                            footer { text-align: center; margin-top: 3rem; font-size: 0.8rem; color: #718096; border-top: 1px solid #E2E8F0; padding-top: 1rem; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>${data.user.name}</h1>
                                <p>ITS: ${data.user.itsId} / BGK: ${data.user.bgkId || 'N/A'}</p>
                                <p>${data.user.designation || "Member"} &middot; ${data.user.team || "No Team"}</p>
                                <p class="generated-by">Report Generated by: ${generatorName} on ${format(new Date(), "PP p")}</p>
                            </div>
                            <div class="summary">
                                <div class="summary-item"><b>${attendanceStats.present}</b><span>Present</span></div>
                                <div class="summary-item"><b>${attendanceStats.late}</b><span>Late</span></div>
                                <div class="summary-item"><b>${attendanceStats.absent}</b><span>Absent</span></div>
                                <div class="summary-item"><b>${data.attendanceHistory.length}</b><span>Total Events</span></div>
                            </div>
                            ${tableHtml}
                            <footer>End of Report</footer>
                        </div>
                    </body>
                </html>
            `);
            printDocument.close();
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        }
    };

    return (
        <Card className="glass-surface border-white/20 shadow-md mt-6" id="printable-area">
             <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 print-hide">
                <div className="flex-grow">
                    <CardTitle>Member Profile Report</CardTitle>
                    <Separator className="my-2" />
                    <CardDescription>
                        A comprehensive summary for {data.user.name} ({data.user.itsId}).
                    </CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto shrink-0">
                    <Button variant="outline" onClick={handlePrint} size="sm" className="w-full sm:w-auto">
                        <Printer className="mr-2 h-4 w-4" /> Print
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
                <Card>
                    <CardHeader className="flex flex-row items-center gap-4">
                        <Avatar className="h-20 w-20">
                            <AvatarImage src={data.user.avatarUrl} alt={data.user.name} />
                            <AvatarFallback>{data.user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                            <CardTitle className="text-2xl">{data.user.name}</CardTitle>
                            <CardDescription>ITS: {data.user.itsId} / BGK: {data.user.bgkId || 'N/A'}</CardDescription>
                             <p className="text-sm text-muted-foreground mt-1">{data.user.designation || "Member"} &middot; {data.user.team || "No Team"}</p>
                        </div>
                    </CardHeader>
                </Card>

                 <Card>
                    <CardHeader><CardTitle className="text-lg">Attendance Summary</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                        <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30"><p className="text-sm text-green-800 dark:text-green-200">Present</p><p className="text-2xl font-bold text-green-900 dark:text-green-100">{attendanceStats.present}</p></div>
                         <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30"><p className="text-sm text-yellow-800 dark:text-yellow-200">Late</p><p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{attendanceStats.late}</p></div>
                         <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30"><p className="text-sm text-red-800 dark:text-red-200">Absent</p><p className="text-2xl font-bold text-red-900 dark:text-red-100">{attendanceStats.absent}</p></div>
                        <div className="p-2 rounded-lg bg-background"><p className="text-sm text-muted-foreground">Total Events</p><p className="text-2xl font-bold">{data.attendanceHistory.length}</p></div>
                    </CardContent>
                </Card>
                
                <PaginatedTable title="Attendance History" data={data.attendanceHistory} headers={["Miqaat", "Date", "Status"]} renderRow={(rec: any) => (<><td>{rec.miqaatName}</td><td>{format(new Date(rec.markedAt), "PP p")}</td><td>{getFormattedStatus(rec.status)}</td></>)} />
                <PaginatedTable title="Dua Submissions" data={data.duaHistory} headers={["Week ID", "Dua e Kamil", "Surat al Kahf", "Submitted"]} renderRow={(rec: any) => (<><td>{rec.weekId}</td><td>{rec.duaKamilCount}</td><td>{rec.kahfCount}</td><td>{format(new Date(rec.markedAt), "PP p")}</td></>)} />
                <PaginatedTable title="Form History" data={data.formHistory} headers={["Form Title", "Status", "Date"]} renderRow={(rec: any) => (<><td>{rec.title}</td><td>{rec.submissionStatus}</td><td>{rec.submissionStatus === 'Filled' && rec.submittedAt ? format(new Date(rec.submittedAt), "PP p") : 'N/A'}</td></>)} />

            </CardContent>
        </Card>
    );
};

const PaginatedTable = ({ title, data, headers, renderRow }: { title: string, data: any[], headers: string[], renderRow: (item: any, index: number) => React.ReactNode }) => {
    const ITEMS_PER_PAGE = 5;
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);
    const currentData = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return data.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [data, currentPage]);
    
    if (data.length === 0) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                <Table>
                    <TableHeader><TableRow>{headers.map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
                    <TableBody>{currentData.map((item, index) => <TableRow key={item.id || index}>{renderRow(item, ((currentPage - 1) * ITEMS_PER_PAGE) + index)}</TableRow>)}</TableBody>
                </Table>
                </div>
            </CardContent>
             {totalPages > 1 && (
                <CardFooter className="justify-end gap-2 pt-4">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                    <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
                </CardFooter>
            )}
        </Card>
    );
};

// New component for the PDF/Print export view (no pagination)
const FullTable = ({ title, data, headers, renderRow }: { title: string, data: any[], headers: string[], renderRow: (item: any, index: number) => React.ReactNode }) => (
    <div className="space-y-2">
        <h2 className="text-xl font-semibold">{title}</h2>
        <table className="w-full text-sm border-collapse" style={{ border: '1px solid #ddd' }}>
            <thead>
                <tr className="bg-gray-100">
                    {headers.map(h => <th key={h} className="p-2 border text-left font-semibold">{h}</th>)}
                </tr>
            </thead>
            <tbody>
                {data.map((item, index) => (
                    <tr key={item.id || index} className="border-t">
                        {renderRow(item, index)}
                    </tr>
                ))}
            </tbody>
        </table>
         <style>{'table, th, td { border: 1px solid #ddd; } td, th { padding: 8px; }'}</style>
    </div>
);


export default function ReportsPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [reportData, setReportData] = useState<ReportResultItem[] | null>(null);
  const [memberProfileData, setMemberProfileData] = useState<MemberProfileData | null>(null);
  const [reportSearchTerm, setReportSearchTerm] = useState("");
  const [reportSummary, setReportSummary] = useState<SummaryStats | null>(null);
  const [chartData, setChartData] = useState<ChartDataItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [allMiqaats, setAllMiqaats] = useState<Pick<Miqaat, "id" | "name" | "startTime" | "endTime" | "reportingTime" | "mohallahIds" | "teams" | "eligibleItsIds" | "location" | "barcodeData" | "attendance" | "safarList" | "attendedUserItsIds" | "attendanceRequirements" | "sessions" | "type" | "attendanceType">[]>([]);
  const [allMohallahs, setAllMohallahs] = useState<Mohallah[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('');

  const [miqaatTypeFilter, setMiqaatTypeFilter] = useState<'local' | 'international' | 'all'>('all');


  const [isGraphDialogOpen, setIsGraphDialogOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [chartType, setChartType] = useState<ChartType>("vertical_bar");
  const [downloadOptions, setDownloadOptions] = useState({ includeTitle: true, includeLegend: true });
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkMarking, setIsBulkMarking] = useState(false);

  // Bulk absentee email variables
  const [isSendingAbsenteeEmails, setIsSendingAbsenteeEmails] = useState(false);

  const [reportSheetId, setReportSheetId] = useState("");
  const [isSyncingReport, setIsSyncingReport] = useState(false);
  const [syncReportStatus, setSyncReportStatus] = useState<string | null>(null);
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [savedSheetId, setSavedSheetId] = useState("");

  const [miqaatSearch, setMiqaatSearch] = useState("");
  const [isBulkSafarDialogOpen, setIsBulkSafarDialogOpen] = useState(false);
  const [bulkBgkInput, setBulkBgkInput] = useState("");
  const [isBulkSafarSubmitting, setIsBulkSafarSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSavedSheetId(localStorage.getItem("lastReportSheetId") || "");
    }
  }, []);

  const isAlreadySynced = useMemo(() => {
    if (!savedSheetId) return false;
    return localStorage.getItem("report_synced_" + savedSheetId) === "true";
  }, [savedSheetId]);

  const handleSendAbsenteeEmailsFromReport = async () => {
    const miqaatIds = form.getValues("miqaatIds") || [];
    const miqaatId = miqaatIds[0];
    if (!miqaatId || !selectedMiqaatForForm) {
      toast({ title: "Miqaat Required", description: "Please select a Miqaat first.", variant: "destructive" });
      return;
    }

    if (confirm(`Are you sure you want to send bulk absence emails to all eligible members who did not attend "${selectedMiqaatForForm.name}"?`)) {
      setIsSendingAbsenteeEmails(true);
      try {
        const res = await fetch("/api/miqaat/send-absentee-emails", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ miqaatId, adminMohallahId: currentUser?.mohallahId }),
        });
        const result = await res.json();
        if (res.ok) {
          toast({
            title: "Absentee Emails Sent",
            description: `Successfully sent ${result.emailsSent} emails. ${result.emailsSkipped} members skipped (no email address).`,
          });
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

  const chartRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      reportType: undefined,
      miqaatIds: [],
      day: "all",
      sessionId: "all",
      memberId: "",
      dateRange: { from: undefined, to: undefined },
      mohallahId: "all",
      team: "all",
      designation: "all",
      status: "all",
    },
  });

  useEffect(() => {
    const role = typeof window !== "undefined" ? localStorage.getItem('userRole') as UserRole : null;
    const pageRightsRaw = typeof window !== "undefined" ? localStorage.getItem('userPageRights') : '[]';
    const pageRights = pageRightsRaw ? JSON.parse(pageRightsRaw) : [];
    const navItem = findNavItem('/dashboard/reports');
    
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
  
  useEffect(() => {
    if (!isAuthorized) return;
    setIsLoadingOptions(true);
    
    const fetchData = async () => {
        try {
            const [users, miqaats, mohallahs, userDetails] = await Promise.all([
                getUsers(),
                new Promise<Miqaat[]>(resolve => getMiqaats(resolve)),
                new Promise<Mohallah[]>(resolve => getMohallahs(resolve)),
                getUserByItsOrBgkId(localStorage.getItem('userItsId')!)
            ]);
            setAllUsers(users);
            setAllMiqaats(miqaats);
            setAllMohallahs(mohallahs);
            setCurrentUser(userDetails);
            setCurrentUserName(userDetails?.name || '');
            
            if (userDetails?.role === 'admin' && userDetails.mohallahId) {
              form.setValue('mohallahId', userDetails.mohallahId);
            }

        } catch(err) {
            console.error("Failed to fetch initial data for reports page", err);
            toast({ title: "Error", description: "Could not load necessary data.", variant: "destructive" });
        } finally {
            setIsLoadingOptions(false);
        }
    };
    fetchData();
  }, [isAuthorized, toast, form]);

  const { availableMiqaats, availableMohallahs, availableTeams } = useMemo(() => {
    if (!currentUser) return { availableMiqaats: [], availableMohallahs: [], availableTeams: [] };

    let roleFilteredMiqaats = allMiqaats;
    if (miqaatTypeFilter !== 'all') {
      roleFilteredMiqaats = roleFilteredMiqaats.filter(m => m.type === miqaatTypeFilter);
    }
    
    if (currentUser.role === 'superadmin') {
      const allTeams = [...new Set(allUsers.map(u => u.team).filter(Boolean) as string[])].sort();
      return { availableMiqaats: roleFilteredMiqaats, availableMohallahs: allMohallahs, availableTeams: allTeams };
    }
    if (currentUser.role === 'admin' && currentUser.mohallahId) {
      const filteredMiqaatsForAdmin = roleFilteredMiqaats.filter(m => !m.mohallahIds?.length || m.mohallahIds.includes(currentUser.mohallahId!));
      const filteredMohallahs = allMohallahs.filter(m => m.id === currentUser.mohallahId);
      const usersInMohallah = allUsers.filter(u => u.mohallahId === currentUser.mohallahId);
      const teamsInMohallah = [...new Set(usersInMohallah.map(u => u.team).filter(Boolean) as string[])].sort();
      return { availableMiqaats: filteredMiqaatsForAdmin, availableMohallahs: filteredMohallahs, availableTeams: teamsInMohallah };
    }
    return { availableMiqaats: [], availableMohallahs: [], availableTeams: [] };
  }, [currentUser, allMiqaats, allMohallahs, allUsers, miqaatTypeFilter]);

  const searchedMiqaats = useMemo(() => {
    if (!miqaatSearch) return availableMiqaats;
    const searchLower = miqaatSearch.toLowerCase();
    return availableMiqaats.filter(m => {
      const nameMatch = m.name.toLowerCase().includes(searchLower);
      const dateMatch = format(new Date(m.startTime), "P").toLowerCase().includes(searchLower);
      return nameMatch || dateMatch;
    });
  }, [availableMiqaats, miqaatSearch]);


  const watchedReportType = form.watch("reportType");
  const watchedMiqaatIds = form.watch("miqaatIds") || [];
  const watchedDay = form.watch("day");

  const selectedMiqaatForForm = useMemo(() => {
    if (watchedMiqaatIds.length === 1) {
      return allMiqaats.find(m => m.id === watchedMiqaatIds[0]);
    }
    return undefined;
  }, [watchedMiqaatIds, allMiqaats]);

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
    setMemberProfileData(null);
    setReportSearchTerm("");
    setChartData(null);
    setReportSummary(null);
    setSelectedIds([]);
    
    if (values.reportType === "member_attendance" && values.memberId) {
        try {
            const member = allUsers.find(u => u.itsId === values.memberId || u.bgkId === values.memberId);
            if (!member) {
                toast({ title: "User Not Found", description: `User with ID ${values.memberId} not found.`, variant: "destructive" });
                setIsLoading(false);
                return;
            }

            const [attendanceHistory, duaHistory, formHistory, loginHistory] = await Promise.all([
                (async () => {
                    const eligibleMiqaats = allMiqaats.filter(miqaat => {
                        const isForEveryone = !miqaat.mohallahIds?.length && !miqaat.teams?.length && !miqaat.eligibleItsIds?.length;
                        if (isForEveryone) return true;
                        const eligibleById = !!miqaat.eligibleItsIds?.includes(member.itsId);
                        const eligibleByTeam = !!member.team && !!miqaat.teams?.includes(member.team);
                        const eligibleByMohallah = !!member.mohallahId && !!miqaat.mohallahIds?.includes(member.mohallahId);
                        return eligibleById || eligibleByTeam || eligibleByMohallah;
                    });
                    const attendedMiqaatSessionKeys = new Set<string>();
                    const records: AttendanceRecord[] = [];
                    eligibleMiqaats.forEach(miqaat => {
                        (miqaat.attendance || []).filter(a => a.userItsId === member.itsId).forEach(entry => {
                            attendedMiqaatSessionKeys.add(`${miqaat.id}-${entry.sessionId || 'main'}`);
                            records.push({ id: `${miqaat.id}-${entry.userItsId}-${entry.sessionId || 'main'}`, miqaatId: miqaat.id, miqaatName: miqaat.name, miqaatType: miqaat.type, userItsId: entry.userItsId, userName: entry.userName, markedAt: entry.markedAt, markedByName: allUsers.find(u => u.itsId === entry.markedByItsId)?.name || entry.markedByItsId, status: entry.status || 'present', uniformCompliance: entry.uniformCompliance });
                        });
                        (miqaat.safarList || []).filter(s => s.userItsId === member.itsId).forEach(entry => {
                            attendedMiqaatSessionKeys.add(`${miqaat.id}-${entry.sessionId || 'main'}`);
                            records.push({ id: `safar-${miqaat.id}-${entry.userItsId}-${entry.sessionId || 'main'}`, miqaatId: miqaat.id, miqaatName: miqaat.name, miqaatType: miqaat.type, userItsId: entry.userItsId, userName: entry.userName, markedAt: entry.markedAt, markedByName: allUsers.find(u => u.itsId === entry.markedByItsId)?.name || entry.markedByItsId, status: 'safar' });
                        });
                    });
                    eligibleMiqaats.forEach(miqaat => {
                        if (new Date() > new Date(miqaat.endTime)) {
                            const sessions = (miqaat.sessions && miqaat.sessions.length > 0) ? miqaat.sessions : [{ id: 'main', startTime: miqaat.startTime, name: 'Main Session', day: 1, endTime: miqaat.endTime }];
                            sessions.forEach(session => {
                                const sessionKey = `${miqaat.id}-${session.id}`;
                                if (!attendedMiqaatSessionKeys.has(sessionKey)) {
                                    records.push({ id: `absent-${sessionKey}-${member.itsId}`, miqaatId: miqaat.id, miqaatName: miqaat.name, miqaatType: miqaat.type, userItsId: member.itsId, userName: member.name, markedAt: session.startTime, status: 'absent' as const });
                                }
                            });
                        }
                    });
                    return records.sort((a, b) => new Date(b.markedAt).getTime() - new Date(a.markedAt).getTime());
                })(),
                getDuaAttendanceForUser(member.itsId),
                (async () => {
                     const [allForms, userResponses] = await Promise.all([ getForms(), getFormResponsesForUser(member.itsId) ]);
                     const userResponseMap = new Map(userResponses.map(res => [res.formId, res]));
                     return allForms.filter(form => {
                            const isForEveryone = !form.mohallahIds?.length && !form.teams?.length && !form.eligibleItsIds?.length;
                            if (isForEveryone) return true;
                            const eligibleById = !!form.eligibleItsIds?.includes(member.itsId);
                            const eligibleByTeam = !!member.team && !!form.teams?.includes(member.team);
                            const eligibleByMohallah = !!member.mohallahId && !!form.mohallahIds?.includes(member.mohallahId);
                            return eligibleById || eligibleByTeam || eligibleByMohallah;
                        }).map(form => ({
                            ...form,
                            submissionStatus: (userResponseMap.has(form.id) ? 'Filled' : 'Not Filled') as 'Filled' | 'Not Filled',
                            submittedAt: userResponseMap.get(form.id)?.submittedAt,
                        })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                })(),
                getLoginLogsForUser(member.itsId)
            ]);

            setMemberProfileData({
                user: member,
                attendanceHistory,
                duaHistory,
                formHistory,
                loginHistory
            });
            
            toast({ title: "Member Report Generated", description: `Profile for ${member.name} is ready.` });

        } catch (error) {
            console.error("Error generating member profile report:", error);
            toast({ title: "Report Failed", description: "Could not generate the member profile report.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
        return; 
    }


    let reportResultItems: ReportResultItem[] = [];

    try {
      const allUsersForReport = await getUsers();
      const userMap = new Map(allUsersForReport.map(u => [u.itsId, u]));
      
      if (values.reportType === "miqaat_summary" && values.miqaatIds && values.miqaatIds.length > 0) {
          let allCombinedRecords: ReportResultItem[] = [];
          let totalEligibleAll = 0;
          let presentCountAll = 0;
          let lateCountAll = 0;
          let earlyCountAll = 0;
          let safarCountAll = 0;

          for (const mId of values.miqaatIds) {
              const miqaatObj = allMiqaats.find(m => m.id === mId);
              if (!miqaatObj) continue;

              const isSpecificMemberMiqaat = miqaatObj.eligibleItsIds && miqaatObj.eligibleItsIds.length > 0;
              const attendanceRecords = miqaatObj.attendance || [];
              const safarRecords = miqaatObj.safarList || [];
              
              let eligibleUsers: User[];
              if (isSpecificMemberMiqaat) {
                  eligibleUsers = allUsersForReport.filter(user => miqaatObj.eligibleItsIds!.includes(user.itsId));
              } else if (miqaatObj.mohallahIds && miqaatObj.mohallahIds.length > 0) {
                  eligibleUsers = allUsersForReport.filter(user => user.mohallahId && miqaatObj.mohallahIds!.includes(user.mohallahId));
              } else if (miqaatObj.teams && miqaatObj.teams.length > 0) {
                  eligibleUsers = allUsersForReport.filter(user => user.team && miqaatObj.teams!.includes(user.team));
              } else {
                  eligibleUsers = allUsersForReport; // Open to all
              }

              const combinedRecords: ReportResultItem[] = eligibleUsers.map(user => {
                  const allUserEntries = attendanceRecords.filter(a => a.userItsId === user.itsId);
                  
                  if (allUserEntries.length > 0) {
                      const regularEntry = allUserEntries[0];
                      const session = miqaatObj.sessions?.find(s => s.id === regularEntry.sessionId);
                      return { id: `${miqaatObj.id}-${user.itsId}`, userName: user.name, userItsId: user.itsId, bgkId: user.bgkId, team: user.team, miqaatName: miqaatObj.name, miqaatType: miqaatObj.type, day: session?.day, sessionName: session?.name || 'Main', date: regularEntry.markedAt, status: regularEntry.status || 'present', markedByItsId: regularEntry.markedByItsId, uniformCompliance: regularEntry.uniformCompliance };
                  }

                  const safarEntry = safarRecords.find(s => s.userItsId === user.itsId);
                  if (safarEntry) {
                       const session = miqaatObj.sessions?.find(s => s.id === safarEntry.sessionId);
                      return { id: `${miqaatObj.id}-${user.itsId}`, userName: user.name, userItsId: user.itsId, bgkId: user.bgkId, team: user.team, miqaatName: miqaatObj.name, miqaatType: miqaatObj.type, day: session?.day, sessionName: session?.name || 'Main', date: safarEntry.markedAt, status: 'safar' as const, markedByItsId: safarEntry.markedByItsId };
                  }
                  return { id: `${miqaatObj.id}-${user.itsId}`, userName: user.name, userItsId: user.itsId, bgkId: user.bgkId, team: user.team, miqaatName: miqaatObj.name, miqaatType: miqaatObj.type, day: undefined, sessionName: 'N/A', date: miqaatObj.startTime, status: 'absent' as const };
              });
              
              if (!isSpecificMemberMiqaat) {
                allUsersForReport.forEach(user => {
                  if (!eligibleUsers.some(eu => eu.id === user.id) && !combinedRecords.some(cr => cr.userItsId === user.itsId)) {
                    combinedRecords.push({ id: `${miqaatObj.id}-${user.itsId}`, userName: user.name, userItsId: user.itsId, bgkId: user.bgkId, team: user.team, miqaatName: miqaatObj.name, miqaatType: miqaatObj.type, day: undefined, sessionName: 'N/A', date: miqaatObj.startTime, status: 'not-eligible' as const, });
                  }
                });
              }

              allCombinedRecords = [...allCombinedRecords, ...combinedRecords];

              totalEligibleAll += eligibleUsers.length;
              presentCountAll += combinedRecords.filter(r => r.status === 'present').length;
              lateCountAll += combinedRecords.filter(r => r.status === 'late').length;
              earlyCountAll += combinedRecords.filter(r => r.status === 'early').length;
              safarCountAll += combinedRecords.filter(r => r.status === 'safar').length;
          }

          reportResultItems = allCombinedRecords;

          const absentCountAll = totalEligibleAll - (presentCountAll + lateCountAll + earlyCountAll + safarCountAll);
          const totalAttendedAll = presentCountAll + lateCountAll + earlyCountAll;
          const attendancePercentageAll = totalEligibleAll > 0 ? (totalAttendedAll / totalEligibleAll) * 100 : 0;
          
          setReportSummary({
              totalEligible: totalEligibleAll,
              present: presentCountAll,
              late: lateCountAll,
              early: earlyCountAll,
              absent: absentCountAll,
              safar: safarCountAll,
              attendancePercentage: attendancePercentageAll,
          });

      } else if (values.reportType === "miqaat_safar_list" && values.miqaatIds && values.miqaatIds.length > 0) {
          let allSafarRecords: ReportResultItem[] = [];
          for (const mId of values.miqaatIds) {
              const miqaatObj = allMiqaats.find(m => m.id === mId);
              if (!miqaatObj) continue;
              const safarList = miqaatObj.safarList || [];
              const attendanceList = miqaatObj.attendance || [];
              const addedItsIds = new Set<string>();
              const records: ReportResultItem[] = [];

              // 1. Add from safarList (excused absence traveling)
              safarList.forEach(safarEntry => {
                if (addedItsIds.has(safarEntry.userItsId)) return;
                addedItsIds.add(safarEntry.userItsId);
                const session = miqaatObj.sessions?.find(s => s.id === safarEntry.sessionId);
                records.push({
                  id: `${miqaatObj.id}-${safarEntry.userItsId}`,
                  userName: safarEntry.userName,
                  userItsId: safarEntry.userItsId,
                  bgkId: userMap.get(safarEntry.userItsId)?.bgkId,
                  team: userMap.get(safarEntry.userItsId)?.team,
                  miqaatName: miqaatObj.name,
                  miqaatType: miqaatObj.type,
                  day: session?.day,
                  sessionName: session?.name || 'Main',
                  date: safarEntry.markedAt,
                  status: 'safar',
                  markedByItsId: safarEntry.markedByItsId,
                });
              });

              // 2. Add from attendance where Feta/Paghri or Koti is marked as 'safar' (present traveling)
              attendanceList.forEach(attEntry => {
                if (addedItsIds.has(attEntry.userItsId)) return;
                const isSafarCompliance = attEntry.uniformCompliance?.fetaPaghri === 'safar' || attEntry.uniformCompliance?.koti === 'safar';
                if (isSafarCompliance) {
                  addedItsIds.add(attEntry.userItsId);
                  const session = miqaatObj.sessions?.find(s => s.id === attEntry.sessionId);
                  records.push({
                    id: `${miqaatObj.id}-${attEntry.userItsId}`,
                    userName: attEntry.userName,
                    userItsId: attEntry.userItsId,
                    bgkId: userMap.get(attEntry.userItsId)?.bgkId,
                    team: userMap.get(attEntry.userItsId)?.team,
                    miqaatName: miqaatObj.name,
                    miqaatType: miqaatObj.type,
                    day: session?.day,
                    sessionName: session?.name || 'Main',
                    date: attEntry.markedAt,
                    status: 'safar',
                    markedByItsId: attEntry.markedByItsId,
                    uniformCompliance: attEntry.uniformCompliance,
                  });
                }
              });

              allSafarRecords = [...allSafarRecords, ...records];
          }
          reportResultItems = allSafarRecords;

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

      } else if (values.reportType === "non_attendance_miqaat" && values.miqaatIds && values.miqaatIds.length > 0) {
          let allNonAttendanceRecords: ReportResultItem[] = [];
          for (const mId of values.miqaatIds) {
              const miqaatObj = allMiqaats.find(m => m.id === mId);
              if (!miqaatObj) continue;

              const attendedItsIds = new Set([
                ...(miqaatObj.attendance || []).map(a => a.userItsId),
                ...(miqaatObj.safarList || []).map(s => s.userItsId)
              ]);
            
              const isSpecificMemberMiqaat = miqaatObj.eligibleItsIds && miqaatObj.eligibleItsIds.length > 0;
              let eligibleUsers: User[];
              if (isSpecificMemberMiqaat) {
                eligibleUsers = allUsersForReport.filter(user => miqaatObj.eligibleItsIds!.includes(user.itsId));
              } else if (miqaatObj.mohallahIds && miqaatObj.mohallahIds.length > 0) {
                eligibleUsers = allUsersForReport.filter(user => user.mohallahId && miqaatObj.mohallahIds!.includes(user.mohallahId));
              } else if (miqaatObj.teams && miqaatObj.teams.length > 0) {
                eligibleUsers = allUsersForReport.filter(user => user.team && miqaatObj.teams!.includes(user.team));
              } else {
                  eligibleUsers = allUsersForReport;
              }

              const nonAttendantUsers = eligibleUsers.filter(user => !attendedItsIds.has(user.itsId));
              const records = nonAttendantUsers.map(user => ({ id: `${miqaatObj.id}-${user.id}`, userName: user.name, userItsId: user.itsId, bgkId: user.bgkId, team: user.team, miqaatName: miqaatObj.name, miqaatType: miqaatObj.type, day: undefined, sessionName: "N/A", date: new Date(miqaatObj.startTime).toISOString(), status: "absent" as const }));
              allNonAttendanceRecords = [...allNonAttendanceRecords, ...records];
          }
          reportResultItems = allNonAttendanceRecords;
      }

      let filteredData = [...reportResultItems];
      
      if (currentUser?.role === 'admin' && currentUser.mohallahId) {
          filteredData = filteredData.filter(record => {
              const userDetails = userMap.get(record.userItsId);
              return userDetails?.mohallahId === currentUser.mohallahId;
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
    const miqaatIds = form.getValues("miqaatIds") || [];
    if (miqaatIds.length === 0) return null;
    
    const selectedMiqaats = allMiqaats.filter(m => miqaatIds.includes(m.id));
    if (selectedMiqaats.length === 0) return null;
    const firstType = selectedMiqaats[0]?.type;
    const allSameType = selectedMiqaats.every(m => m.type === firstType);
    
    return allSameType ? firstType : 'mixed';
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
    } else if (reportMiqaatType === 'mixed') {
      headers.push("Feta/Paghri", "Koti", "Uniform", "Shoes");
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
            getFormattedStatus(row.status),
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
        } else if (reportMiqaatType === 'mixed') {
          rowData.push(
            row.miqaatType === 'local' ? (row.uniformCompliance?.fetaPaghri ?? "N/A") : "N/A",
            row.miqaatType === 'local' ? (row.uniformCompliance?.koti ?? "N/A") : "N/A",
            row.miqaatType === 'international' ? (row.uniformCompliance?.uniform ?? "N/A") : "N/A",
            row.miqaatType === 'international' ? (row.uniformCompliance?.shoes ?? "N/A") : "N/A",
          );
        } else {
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

  const handleGoogleSheetsSyncReport = async (customSheetId?: string) => {
    const targetSheetId = customSheetId || reportSheetId;
    if (!filteredReportData || filteredReportData.length === 0) {
      toast({ title: "No data to sync", description: "Please generate a report first.", variant: "destructive" });
      return;
    }

    if (!targetSheetId || !targetSheetId.trim()) {
      toast({ title: "Error", description: "Please enter a valid Google Sheet ID.", variant: "destructive" });
      return;
    }

    const trimmedSheetId = targetSheetId.trim();
    localStorage.setItem("lastReportSheetId", trimmedSheetId);
    setSavedSheetId(trimmedSheetId);

    setIsSyncingReport(true);
    setSyncReportStatus("Syncing...");
    setIsSyncDialogOpen(false);

    try {
      let headers = ["User Name", "ITS ID", "BGK ID", "Team", "Miqaat", "Miqaat Type", "Session Name", "Marked Date", "Marked Time", "Status", "Marked By ITS ID"];
      
      if (reportMiqaatType === 'local') {
        headers.push("Feta/Paghri", "Koti");
      } else if (reportMiqaatType === 'international') {
        headers.push("Uniform", "Shoes");
      } else if (reportMiqaatType === 'mixed') {
        headers.push("Feta/Paghri", "Koti", "Uniform", "Shoes");
      }
      headers.push("NazrulMaqam Amount", "NazrulMaqam Currency");

      // Group rows by miqaatName
      const groups: { [key: string]: typeof filteredReportData } = {};
      filteredReportData.forEach(row => {
        const name = row.miqaatName || "Attendance Report";
        if (!groups[name]) {
          groups[name] = [];
        }
        groups[name].push(row);
      });

      const syncPromises = Object.entries(groups).map(async ([miqaatName, rows]) => {
        const dataToSync = rows.map(row => {
          const date = row.date ? new Date(row.date) : null;
          let rowData = [
            row.userName,
            row.userItsId,
            row.bgkId || 'N/A',
            row.team || 'N/A',
            row.miqaatName,
            row.miqaatType,
            row.sessionName || 'N/A',
            date ? format(date, "yyyy-MM-dd") : "N/A",
            date ? format(date, "HH:mm:ss") : "N/A",
            getFormattedStatus(row.status),
            row.markedByItsId || "N/A"
          ];

          if (reportMiqaatType === 'local') {
            rowData.push(
              row.uniformCompliance?.fetaPaghri ?? "N/A",
              row.uniformCompliance?.koti ?? "N/A"
            );
          } else if (reportMiqaatType === 'international') {
            rowData.push(
              row.uniformCompliance?.uniform ?? "N/A",
              row.uniformCompliance?.shoes ?? "N/A"
            );
          } else if (reportMiqaatType === 'mixed') {
            rowData.push(
              row.miqaatType === 'local' ? (row.uniformCompliance?.fetaPaghri ?? "N/A") : "N/A",
              row.miqaatType === 'local' ? (row.uniformCompliance?.koti ?? "N/A") : "N/A",
              row.miqaatType === 'international' ? (row.uniformCompliance?.uniform ?? "N/A") : "N/A",
              row.miqaatType === 'international' ? (row.uniformCompliance?.shoes ?? "N/A") : "N/A"
            );
          } else {
            rowData.push("N/A", "N/A");
          }
          
          rowData.push(
            row.uniformCompliance?.nazrulMaqam?.amount?.toString() ?? "N/A",
            row.uniformCompliance?.nazrulMaqam?.currency ?? "N/A"
          );

          return rowData;
        });

        // Clean sheet name to make it acceptable by Google Sheets (no :, \, /, ?, *, [, ], or limit length to 31 chars)
        const cleanSheetName = miqaatName.replace(/[:\\/?*\[\]]/g, '').slice(0, 31).trim();

        const res = await fetch("/api/google/sync-sheet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sheetId: trimmedSheetId,
            sheetName: cleanSheetName || "Report",
            headers,
            data: dataToSync,
            action: "replace"
          })
        });

        const result = await res.json();
        if (!res.ok) {
          throw new Error(result.error || `Failed to sync sheet "${cleanSheetName}".`);
        }
      });

      await Promise.all(syncPromises);

      localStorage.setItem("report_synced_" + trimmedSheetId, "true");
      setSavedSheetId(trimmedSheetId);

      toast({ title: "Sync Complete!", description: "Report data successfully synced to Google Sheet." });
      setSyncReportStatus("Synced " + format(new Date(), "p"));
    } catch (err: any) {
      toast({ title: "Sync Failed", description: err.message || "Could not sync data.", variant: "destructive" });
      setSyncReportStatus("Sync failed");
    } finally {
      setIsSyncingReport(false);
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
    const miqaatId = selectedMiqaatForForm?.id;
    if (!miqaatId || selectedIds.length === 0) {
      toast({ title: "Selection Required", description: "Please select a Miqaat and at least one member to mark.", variant: "destructive" });
      return;
    }
    
    setIsBulkMarking(true);
    try {
      const markerId = currentUser?.itsId;
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

  const handleBulkSafarBgkSubmit = async () => {
    const miqaatId = selectedMiqaatForForm?.id;
    if (!miqaatId) {
      toast({ title: "Selection Required", description: "Please select a Miqaat first.", variant: "destructive" });
      return;
    }

    const bgkIds = bulkBgkInput
      .split(/[\s,]+/)
      .map(id => id.trim())
      .filter(id => id.length > 0);

    if (bgkIds.length === 0) {
      toast({ title: "Input Required", description: "Please enter at least one BGK ID.", variant: "destructive" });
      return;
    }

    setIsBulkSafarSubmitting(true);
    try {
      const markerId = currentUser?.itsId;
      if (!markerId) {
        throw new Error("Could not identify the person marking attendance.");
      }

      // Fetch all system users to match BGK IDs to ITS IDs
      const allUsers = await getUsers();
      const bgkToUserMap = new Map(
        allUsers
          .filter(u => u.bgkId)
          .map(u => [u.bgkId!.toLowerCase().trim(), u])
      );

      const safarEntries: MiqaatSafarEntryItem[] = [];
      const notFoundBgkIds: string[] = [];

      bgkIds.forEach(bgkId => {
        const key = bgkId.toLowerCase();
        const user = bgkToUserMap.get(key);
        if (user) {
          safarEntries.push({
            userItsId: user.itsId,
            userName: user.name,
            markedAt: new Date().toISOString(),
            markedByItsId: markerId,
            status: 'safar',
          });
        } else {
          notFoundBgkIds.push(bgkId);
        }
      });

      if (safarEntries.length > 0) {
        await batchMarkSafarInMiqaat(miqaatId, safarEntries);
        
        if (notFoundBgkIds.length > 0) {
          toast({
            title: "Bulk Safar Partial Success",
            description: `Marked ${safarEntries.length} member(s) as Safar. The following ${notFoundBgkIds.length} BGK ID(s) were not found: ${notFoundBgkIds.join(", ")}`,
            variant: "default",
          });
        } else {
          toast({
            title: "Bulk Safar Success",
            description: `Successfully marked all ${safarEntries.length} member(s) as Safar.`,
          });
        }
        
        // Clear input and close dialog
        setBulkBgkInput("");
        setIsBulkSafarDialogOpen(false);
        // Refresh the current report
        await onSubmit(form.getValues());
      } else {
        toast({
          title: "Update Failed",
          description: `No matching members found for the provided BGK IDs: ${notFoundBgkIds.join(", ")}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error during bulk Safar marking by BGK ID:", error);
      toast({
        title: "Update Failed",
        description: `Could not mark members as Safar. ${error instanceof Error ? error.message : "Please try again."}`,
        variant: "destructive",
      });
    } finally {
      setIsBulkSafarSubmitting(false);
    }
  };

    const handlePrint = () => {
        const printContent = printRef.current;
        if (!printContent) {
            toast({title: "Print Error", description: "Report content not found.", variant: "destructive"});
            return;
        }
        
        const printWindow = window.open('', '_blank');
        if(printWindow) {
            const reportType = form.getValues("reportType").toUpperCase().replace(/_/g, ' ');
            const miqaatName = selectedMiqaatForForm ? ` OF ${selectedMiqaatForForm.name}` : '';
            const title = `REPORT: ${reportType}${miqaatName}`;

            printWindow.document.write('<html><head><title>Print Report</title>');
            printWindow.document.write('<style>' +
                'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; margin: 0; padding: 0; }' +
                '.container { padding: 1.5rem; }' +
                '.header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; border-bottom: 2px solid #0A314D; padding-bottom: 1rem; }' +
                '.header-text { text-align: right; }' +
                '.header h1 { font-size: 1.5rem; text-transform: uppercase; margin: 0; color: #0A314D; }' +
                '.header p { margin: 0.25rem 0; font-size: 0.8rem; color: #6c757d; }' +
                '.header img { width: 80px; height: 80px; }' +
                'table { width: 100%; border-collapse: collapse; margin-bottom: 2rem; }' +
                'thead { display: table-header-group; }' +
                'th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #dee2e6; }' +
                'th { background-color: #f8f9fa; color: #495057; font-weight: 600; }' +
                'tbody tr:nth-child(even) { background-color: #f8f9fa; }' +
                '</style>');
            printWindow.document.write('</head><body><div class="container">');
            printWindow.document.write('<div class="header">' +
                '<div><img src="/logo.png" alt="Logo"></div>' +
                '<div class="header-text">' +
                `<h1>${title}</h1>` +
                `<p>Generated by: ${currentUserName} on ${format(new Date(), 'PP p')}</p>` +
                '</div>' +
                '</div>');
            printWindow.document.write(printContent.innerHTML);
            printWindow.document.write('</div></body></html>');
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        }
    };


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
    if (chartType !== 'horizontal_bar' || !chartData) return 400;
    return Math.max(400, chartData.length * 40);
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
      <Card className="glass-surface border-white/20 shadow-md print-hide">
        <CardHeader>
          <CardTitle className="flex items-center"><BarChart className="mr-2 h-5 w-5 text-primary"/>Generate Report</CardTitle>
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
                        form.setValue('miqaatIds', []);
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
                          <SelectItem value="member_attendance">Member Report</SelectItem>
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
                              form.setValue('miqaatIds', []);
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
                      name="miqaatIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Select Miqaats</FormLabel>
                          <div className="relative mb-2">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="search"
                              placeholder="Search Miqaats by name or date..."
                              value={miqaatSearch}
                              onChange={(e) => setMiqaatSearch(e.target.value)}
                              className="pl-8 h-9"
                            />
                          </div>
                          <ScrollArea className="rounded-md border p-3 h-40 bg-background">
                            {isLoadingOptions ? (
                              <p className="text-sm text-muted-foreground">Loading Miqaats...</p>
                            ) : searchedMiqaats.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                {miqaatSearch ? "No matching Miqaats found" : "No Miqaats available"}
                              </p>
                            ) : (
                              searchedMiqaats.map((m) => (
                                <FormField
                                  key={m.id}
                                  control={form.control}
                                  name="miqaatIds"
                                  render={({ field: checkboxField }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 mb-2" key={m.id}>
                                      <FormControl>
                                        <Checkbox
                                          checked={checkboxField.value?.includes(m.id)}
                                          onCheckedChange={(checked) => {
                                            const currentVal = checkboxField.value || [];
                                            const newVal = checked
                                              ? [...currentVal, m.id]
                                              : currentVal.filter((value) => value !== m.id);
                                            checkboxField.onChange(newVal);
                                            
                                            // Reset day and session if multiple or none selected
                                            if (newVal.length !== 1) {
                                              form.setValue('day', 'all');
                                              form.setValue('sessionId', 'all');
                                            }
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="font-normal text-sm cursor-pointer select-none whitespace-normal break-words leading-snug">
                                        {m.name} ({format(new Date(m.startTime), "P")})
                                      </FormLabel>
                                    </FormItem>
                                  )}
                                />
                              ))
                            )}
                          </ScrollArea>
                          <FormDescription className="text-xs">
                            Select one or more Miqaats to run reports.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                )}


                {watchedReportType === "member_attendance" && (
                  <FormField
                    control={form.control}
                    name="memberId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ITS / BGK ID</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter ITS or BGK ID" {...field} />
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
                                <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingOptions || currentUser?.role === 'admin'}>
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
                                 {currentUser?.role === 'admin' && <FormDescription>Admins can only see reports for their own Mohallah.</FormDescription>}
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
      
      {memberProfileData && (
          <MemberProfileReport data={memberProfileData} generatorName={currentUserName}/>
      )}

      {reportData && !memberProfileData && (
          <Card className="glass-surface border-white/20 shadow-md mt-6">
            <CardHeader className="flex flex-col items-start gap-3 print-hide">
              <div className="flex-grow w-full">
                  <CardTitle>Report Results</CardTitle>
                  <Separator className="my-2" />
                  <CardDescription className="text-xs sm:text-sm line-clamp-2 sm:line-clamp-none">Displaying {filteredReportData?.length || 0} of {reportData.length} record(s){(watchedReportType === "miqaat_summary" || watchedReportType === "non_attendance_miqaat" || watchedReportType === "miqaat_safar_list") && (selectedMiqaatForForm ? ` for: ${selectedMiqaatForForm.name}` : watchedMiqaatIds.length > 0 ? ` for ${watchedMiqaatIds.length} Miqaats` : '')}{watchedReportType === "member_attendance" && form.getValues("memberId") && ` ID: ${form.getValues("memberId")}`}{form.getValues("dateRange.from") && ` from ${format(form.getValues("dateRange.from")!, "LLL dd, y")}`}{form.getValues("dateRange.to") && ` to ${format(form.getValues("dateRange.to")!, "LLL dd, y")}`}.</CardDescription>
              </div>
              <div className="flex items-center gap-1.5 w-full overflow-x-auto pb-1 flex-nowrap sm:flex-wrap sm:justify-end">
                <Button variant="outline" onClick={handlePrint} size="sm" className="shrink-0"><Printer className="h-4 w-4 md:mr-2" /><span className="hidden md:inline">Print</span></Button>
                {isNonAttendanceReport && selectedMiqaatForForm && selectedIds.length > 0 && (<Button onClick={handleBulkMarkAsSafar} disabled={isBulkMarking} size="sm" className="shrink-0">{isBulkMarking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}Mark ({selectedIds.length})</Button>)}
                {selectedMiqaatForForm && (isNonAttendanceReport || watchedReportType === 'miqaat_safar_list') && (
                  <Dialog open={isBulkSafarDialogOpen} onOpenChange={setIsBulkSafarDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="shrink-0">
                        <UserCheck className="h-4 w-4 md:mr-2" />
                        <span className="hidden md:inline">Bulk Safar</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md w-[95vw]">
                      <DialogHeader>
                        <DialogTitle>Bulk Safar Marking (BGK ID)</DialogTitle>
                        <DialogDescription>
                          Enter BGK IDs separated by commas, spaces, or newlines to mark them as Safar for <strong className="text-foreground">{selectedMiqaatForForm.name}</strong>.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="bgk-ids-textarea">BGK IDs</Label>
                          <Textarea
                            id="bgk-ids-textarea"
                            placeholder="e.g. BGK012, BGK045, BGK089"
                            value={bulkBgkInput}
                            onChange={(e) => setBulkBgkInput(e.target.value)}
                            rows={6}
                            className="font-mono text-sm"
                          />
                        </div>
                      </div>
                      <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsBulkSafarDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleBulkSafarBgkSubmit} 
                          disabled={isBulkSafarSubmitting}
                          className="bg-primary hover:bg-primary/90"
                        >
                          {isBulkSafarSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Mark as Safar
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
                {isNonAttendanceReport && selectedMiqaatForForm && (
                  <Button 
                    variant="outline" 
                    onClick={handleSendAbsenteeEmailsFromReport} 
                    disabled={isSendingAbsenteeEmails} 
                    size="sm" 
                    className="shrink-0"
                  >
                    {isSendingAbsenteeEmails ? (
                      <Loader2 className="h-4 w-4 animate-spin md:mr-2" />
                    ) : (
                      <Mail className="h-4 w-4 md:mr-2" />
                    )}
                    <span className="hidden md:inline">Email Absentees</span>
                  </Button>
                )}
                {canShowGraphButton && (
                  <Dialog open={isGraphDialogOpen} onOpenChange={setIsGraphDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="shrink-0"><BarChart className="h-4 w-4 md:mr-2" /><span className="hidden md:inline">Graph</span></Button>
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
                                        {chartType === 'vertical_bar' ? (
                                            <RechartsBarChart accessibilityLayer data={chartData}>
                                                <CartesianGrid vertical={false} />
                                                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} angle={-45} textAnchor="end" interval={0} height={120} />
                                                <YAxis />
                                                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                                                {downloadOptions.includeLegend && <ChartLegend content={<ChartLegendContent />} />}
                                                <Bar dataKey="present" fill="var(--color-present)" radius={4} stackId="a" />
                                                <Bar dataKey="late" fill="var(--color-late)" radius={4} stackId="a" />
                                            </RechartsBarChart>
                                        ) : chartType === 'horizontal_bar' ? (
                                             <RechartsBarChart accessibilityLayer data={chartData} layout="vertical">
                                                <CartesianGrid horizontal={false} />
                                                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={8} width={150} interval={0} />
                                                <XAxis type="number" />
                                                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                                                {downloadOptions.includeLegend && <ChartLegend content={<ChartLegendContent />} />}
                                                <Bar dataKey="present" fill="var(--color-present)" radius={4} stackId="a" />
                                                <Bar dataKey="late" fill="var(--color-late)" radius={4} stackId="a" />
                                            </RechartsBarChart>
                                        ) : chartType === 'pie' ? (
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
                                        ) : <div />}
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
                {isAlreadySynced ? (
                  <Button 
                    variant="outline" 
                    disabled={!filteredReportData || filteredReportData.length === 0 || isLoading || isSyncingReport} 
                    size="sm" 
                    className="w-auto bg-green-50 hover:bg-green-100 dark:bg-green-950/30 dark:hover:bg-green-900/30 border-green-200 dark:border-green-900/50 text-green-700 dark:text-green-400"
                    onClick={() => handleGoogleSheetsSyncReport(savedSheetId)}
                  >
                    {isSyncingReport ? <RefreshCw className="h-4 w-4 animate-spin md:mr-2" /> : <RefreshCw className="h-4 w-4 md:mr-2" />}
                    <span className="hidden md:inline">{isSyncingReport ? "Syncing..." : "Reload Sync"}</span>
                  </Button>
                ) : (
                  <Dialog open={isSyncDialogOpen} onOpenChange={setIsSyncDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        disabled={!filteredReportData || filteredReportData.length === 0 || isLoading || isSyncingReport} 
                        size="sm" 
                        className="w-auto bg-green-50 hover:bg-green-100 dark:bg-green-950/30 dark:hover:bg-green-900/30 border-green-200 dark:border-green-900/50 text-green-700 dark:text-green-400"
                        onClick={() => {
                          const savedId = localStorage.getItem("lastReportSheetId") || "";
                          setReportSheetId(savedId);
                          setIsSyncDialogOpen(true);
                        }}
                      >
                        {isSyncingReport ? <RefreshCw className="h-4 w-4 animate-spin md:mr-2" /> : <FileSpreadsheet className="h-4 w-4 md:mr-2" />}
                        <span className="hidden md:inline">{isSyncingReport ? "Syncing..." : "Sync to Sheet"}</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Sync Report to Google Sheet</DialogTitle>
                        <DialogDescription>
                          Pushes the generated report rows directly to a Google Sheet. Ensure your Google Sheet is set up to accept sync requests.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-2">
                        <div className="space-y-2">
                          <Label htmlFor="report-sheet-id">Google Sheet ID</Label>
                          <Input
                            id="report-sheet-id"
                            placeholder="e.g., 1x2y3z4w..."
                            value={reportSheetId}
                            onChange={(e) => setReportSheetId(e.target.value)}
                          />
                          <p className="text-[10px] text-muted-foreground leading-normal">
                            Copy this from your spreadsheet URL: https://docs.google.com/spreadsheets/d/<strong>[SHEET_ID]</strong>/edit
                          </p>
                        </div>
                      </div>
                      <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsSyncDialogOpen(false)}>Cancel</Button>
                        <Button 
                          onClick={() => handleGoogleSheetsSyncReport()} 
                          disabled={!reportSheetId || isSyncingReport}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          {isSyncingReport ? "Syncing..." : "Sync Now"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}

                {syncReportStatus && (
                  <span className="text-xs text-muted-foreground flex items-center px-1">
                    {syncReportStatus}
                  </span>
                )}

                <Button variant="outline" onClick={handleExport} disabled={!filteredReportData || filteredReportData.length === 0 || isLoading} size="sm" className="shrink-0"><Download className="h-4 w-4 md:mr-2" /><span className="hidden md:inline">Export</span></Button>
              </div>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              <div className="relative mb-4 print-hide">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by name, ITS, or BGK ID..."
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
                        <AccordionItem 
                          value={`${record.id}-${record.date || index}`} 
                          key={`${record.id}-${record.date || index}`}
                          className="border border-border/60 rounded-lg p-1 bg-card/60 backdrop-blur-sm shadow-sm mb-3"
                        >
                          <div className="flex items-center w-full">
                            {isNonAttendanceReport && (
                              <div className="pl-3 py-4 shrink-0">
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
                            <AccordionTrigger className={cn("flex-grow hover:no-underline py-2", !isNonAttendanceReport && "pl-3")}>
                              <div className="flex items-center gap-3 flex-grow text-left pr-2">
                                <span className="text-xs font-mono text-muted-foreground shrink-0">{index + 1}.</span>
                                <div className="flex-grow min-w-0 pr-1">
                                  <p className="font-bold text-card-foreground text-sm leading-tight truncate">{record.userName}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">ITS: {record.userItsId}</p>
                                </div>
                                <span className={cn("px-2 py-0.5 text-[10px] font-bold rounded-full whitespace-nowrap shrink-0",
                                  record.status === 'absent' ? 'bg-destructive/10 text-destructive' :
                                  record.status === 'safar' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400' :
                                  'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400'
                                )}>
                                  {getFormattedStatus(record.status)}
                                </span>
                              </div>
                            </AccordionTrigger>
                          </div>
                          <AccordionContent className="space-y-3 pt-2 px-3 border-t border-border/40 mt-1">
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                              <div><strong>BGK ID:</strong> <span className="text-foreground">{record.bgkId || "N/A"}</span></div>
                              <div><strong>Team:</strong> <span className="text-foreground">{record.team || "N/A"}</span></div>
                              <div className="col-span-2"><strong>Miqaat:</strong> <span className="text-foreground">{record.miqaatName}</span></div>
                              <div><strong>Type:</strong> <Badge variant={record.miqaatType === 'local' ? 'outline' : 'secondary'} className="h-4 py-0 px-1 text-[9px]">{record.miqaatType}</Badge></div>
                              <div><strong>Session:</strong> <span className="text-foreground">{record.sessionName || "N/A"}</span></div>
                              <div className="col-span-2"><strong>Date:</strong> <span className="text-foreground">{record.date ? format(new Date(record.date), "PP p") : "N/A"}</span></div>
                              {(watchedReportType === "miqaat_summary" || watchedReportType === "overall_activity" || watchedReportType === "member_attendance") &&
                                <div className="col-span-2"><strong>Marked By:</strong> <span className="text-foreground">{record.markedByItsId || "N/A"}</span></div>
                              }
                            </div>
                            {record.uniformCompliance && (
                              <div className="border-t border-border/30 pt-2.5 space-y-1.5 text-xs text-muted-foreground">
                                <span className="block font-bold text-[10px] uppercase tracking-wider text-muted-foreground/75 mb-0.5">Compliance Details</span>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                                  {(reportMiqaatType === 'local' || (reportMiqaatType === 'mixed' && record.miqaatType === 'local')) && <div><strong>Feta/Paghri:</strong> <span className="text-foreground">{record.uniformCompliance?.fetaPaghri ?? 'N/A'}</span></div>}
                                  {(reportMiqaatType === 'local' || (reportMiqaatType === 'mixed' && record.miqaatType === 'local')) && <div><strong>Koti:</strong> <span className="text-foreground">{record.uniformCompliance?.koti ?? 'N/A'}</span></div>}
                                  {(reportMiqaatType === 'international' || (reportMiqaatType === 'mixed' && record.miqaatType === 'international')) && <div><strong>Uniform:</strong> <span className="text-foreground">{record.uniformCompliance?.uniform ?? 'N/A'}</span></div>}
                                  {(reportMiqaatType === 'international' || (reportMiqaatType === 'mixed' && record.miqaatType === 'international')) && <div><strong>Shoes:</strong> <span className="text-foreground">{record.uniformCompliance?.shoes ?? 'N/A'}</span></div>}
                                  <div className="col-span-2"><strong>Nazrul Maqam:</strong> <span className="text-foreground">{record.uniformCompliance.nazrulMaqam ? `${record.uniformCompliance.nazrulMaqam.amount} ${record.uniformCompliance.nazrulMaqam.currency}` : 'N/A'}</span></div>
                                </div>
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>


                  <div ref={printRef} className="hidden md:block w-full overflow-x-auto border rounded-lg">
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
                          </> ) : reportMiqaatType === 'mixed' ? ( <>
                              <TableHead>Feta/Paghri</TableHead>
                              <TableHead>Koti</TableHead>
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
                                      record.status === 'absent' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                      record.status === 'safar' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                      record.status === 'late' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  )}>
                                     {getFormattedStatus(record.status)}
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
                              {reportMiqaatType === 'mixed' && <>
                                  <TableCell>{record.miqaatType === 'local' ? (record.uniformCompliance?.fetaPaghri ?? 'N/A') : 'N/A'}</TableCell>
                                  <TableCell>{record.miqaatType === 'local' ? (record.uniformCompliance?.koti ?? 'N/A') : 'N/A'}</TableCell>
                                  <TableCell>{record.miqaatType === 'international' ? (record.uniformCompliance?.uniform ?? 'N/A') : 'N/A'}</TableCell>
                                  <TableCell>{record.miqaatType === 'international' ? (record.uniformCompliance?.shoes ?? 'N/A') : 'N/A'}</TableCell>
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
      
      {!isLoading && reportData === null && memberProfileData === null && !isLoadingOptions && (
         <Card className="glass-surface border-white/20 shadow-md mt-6 print-hide">
            <CardContent className="py-10 flex flex-col items-center justify-center">
                <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
                <div className="text-center text-muted-foreground">
                    Please select your report criteria and click &quot;Generate Report&quot; to view data.
                </div>
            </CardContent>
         </Card>
      )}
      {(isLoadingOptions && reportData === null) && (
        <Card className="glass-surface border-white/20 shadow-md mt-6 print-hide">
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
