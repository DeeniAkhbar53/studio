
"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Trash2, Users, FileWarning, Download, UserCheck, UserX, Star, PieChart, BarChart2, ChevronDown, RefreshCw, FileSpreadsheet, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { FormResponse, UserRole, UserDesignation, User, Form as FormType, Mohallah } from "@/types";
import { getFormResponsesRealtime, deleteFormResponse, getForm, updateForm } from "@/lib/firebase/formService";
import { getUsers, getUserByItsOrBgkId } from "@/lib/firebase/userService";
import { getMohallahs } from "@/lib/firebase/mohallahService";
import { format } from "date-fns";
import type { Unsubscribe } from "firebase/firestore";
import Papa from "papaparse";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { FunkyLoader } from "@/components/ui/funky-loader";
import {
  ChartContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ChartTooltip,
  ChartLegend,
  ChartLegendContent,
  ChartTooltipContent,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "@/components/ui/chart";
import { LineChart, Line } from "recharts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


const TEAM_LEAD_DESIGNATIONS: UserDesignation[] = ["Captain", "Vice Captain", "Group Leader", "Asst.Grp Leader", "Major", "Commander", "Assistant Commander", "Senior Assistant Commander"];
const TOP_LEVEL_LEADERS: UserDesignation[] = ["Major", "Captain", "Commander", "Senior Assistant Commander"];
const MID_LEVEL_LEADERS: UserDesignation[] = ["Vice Captain"];
const GROUP_LEVEL_LEADERS: UserDesignation[] = ["Group Leader", "Asst.Grp Leader", "Assistant Commander"];
const ALL_DESIGNATIONS: UserDesignation[] = ["Member", "J.Member", "Asst.Grp Leader", "Group Leader", "Vice Captain", "Captain", "Major", "Idara Admin", "Senior Assistant Commander", "Assistant Commander", "Commander"];


const StarRatingDisplay = ({ rating, max = 5 }: { rating: number; max?: number }) => {
    return (
        <div className="flex items-center gap-1">
            {[...Array(max)].map((_, i) => (
                <Star
                    key={i}
                    className={cn(
                        "h-4 w-4",
                        i < rating ? "text-primary fill-primary" : "text-muted-foreground/30"
                    )}
                />
            ))}
        </div>
    );
};

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
  "hsl(var(--primary) / 0.7)",
  "hsl(var(--secondary) / 0.7)",
  "hsl(var(--accent) / 0.7)",
  "hsl(var(--primary) / 0.4)",
  "hsl(var(--secondary) / 0.4)",
];

const QuestionAnalyticsCard = ({ 
  questionId, 
  result, 
  chartConfig 
}: { 
  questionId: string; 
  result: { type: string; label: string; data: { name: string; value: number; fill: string }[] }; 
  chartConfig: any;
}) => {
  const [chartType, setChartType] = useState<'pie' | 'bar' | 'line'>(
    result.type === 'radio' || result.type === 'select' ? 'pie' : 'bar'
  );

  return (
    <Card key={questionId} className="shadow-sm flex flex-col h-[400px]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base font-semibold truncate max-w-[70%]">{result.label}</CardTitle>
        <Select value={chartType} onValueChange={(v) => setChartType(v as any)}>
          <SelectTrigger className="h-8 w-28 text-xs shrink-0">
            <SelectValue placeholder="Chart Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pie" className="text-xs">Pie Chart</SelectItem>
            <SelectItem value="bar" className="text-xs">Bar Chart</SelectItem>
            <SelectItem value="line" className="text-xs">Line Chart</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="flex-grow min-h-0 pb-6">
        <ChartContainer config={chartConfig} className="h-full w-full">
          {chartType === 'pie' ? (
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <ChartTooltip cursor={false} content={<ChartTooltipContent nameKey="name" indicator="dot" />} />
                <Pie 
                  data={result.data} 
                  dataKey="value" 
                  nameKey="name" 
                  cx="50%" 
                  cy="50%" 
                  outerRadius={70} 
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {result.data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent />} />
              </RechartsPieChart>
            </ResponsiveContainer>
          ) : chartType === 'bar' ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={result.data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis allowDecimals={false} />
                <ChartTooltip cursor={{ fill: 'hsl(var(--muted)/0.2)' }} content={<ChartTooltipContent />} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                  {result.data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result.data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

const FormAnalytics = ({ form, responses }: { form: FormType; responses: FormResponse[] }) => {
    const chartConfig = useMemo(() => {
        const config: any = {};
        form.questions.forEach(q => {
            if (q.type === 'radio' || q.type === 'select' || q.type === 'checkbox') {
                q.options?.forEach((opt, index) => {
                    config[opt] = {
                        label: opt,
                        color: CHART_COLORS[index % CHART_COLORS.length],
                    };
                });
            } else if (q.type === 'rating') {
                 [1,2,3,4,5].forEach((val, index) => {
                    const label = `${val} Star`;
                    config[label] = {
                        label: label,
                        color: CHART_COLORS[index % CHART_COLORS.length],
                    }
                 });
            }
        });
        return config;
    }, [form]);
    
    const analyticsData = useMemo(() => {
        if (!form || responses.length === 0) return null;

        const results: { [questionId: string]: { type: FormType['questions'][0]['type'], label: string, data: { name: string, value: number, fill: string }[] } } = {};

        form.questions.forEach(question => {
            const counts: { [option: string]: number } = {};
            
            switch (question.type) {
                case 'radio':
                case 'select':
                    question.options?.forEach(opt => counts[opt] = 0);
                    responses.forEach(res => {
                        const answer = res.responses[question.id] as string;
                        if (answer && question.options?.includes(answer)) {
                            counts[answer]++;
                        }
                    });
                    results[question.id] = { type: question.type, label: question.label, data: Object.entries(counts).map(([name, value], index) => ({ name, value, fill: CHART_COLORS[index % CHART_COLORS.length] })) };
                    break;
                
                case 'checkbox':
                    question.options?.forEach(opt => counts[opt] = 0);
                    responses.forEach(res => {
                        const answers = res.responses[question.id] as string[];
                        if (Array.isArray(answers)) {
                            answers.forEach(answer => {
                                if (question.options?.includes(answer)) {
                                    counts[answer]++;
                                }
                            });
                        }
                    });
                    results[question.id] = { type: question.type, label: question.label, data: Object.entries(counts).map(([name, value], index) => ({ name, value, fill: CHART_COLORS[index % CHART_COLORS.length] })) };
                    break;

                case 'rating':
                     [1,2,3,4,5].forEach(val => counts[String(val)] = 0);
                     responses.forEach(res => {
                        const rating = res.responses[question.id] as number;
                        if (rating >= 1 && rating <= 5) {
                            counts[String(rating)]++;
                        }
                     });
                     results[question.id] = { type: question.type, label: question.label, data: Object.entries(counts).map(([name, value], index) => ({ name: `${name} Star`, value, fill: CHART_COLORS[index % CHART_COLORS.length] })) };
                     break;

                default:
                    break; // Skip non-visualizable question types
            }
        });

        return results;

    }, [form, responses]);

    if (responses.length === 0) {
        return <div className="text-center py-20 text-muted-foreground">No responses yet to generate analytics.</div>;
    }

    if (!analyticsData || Object.keys(analyticsData).length === 0) {
        return <div className="text-center py-20 text-muted-foreground">No questions in this form can be visualized.</div>;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(analyticsData).map(([questionId, result]) => (
                <QuestionAnalyticsCard 
                    key={questionId} 
                    questionId={questionId} 
                    result={result} 
                    chartConfig={chartConfig} 
                />
            ))}
        </div>
    );
};

export default function ViewResponsesClientPage() {
    const router = useRouter();
    const params = useParams();
    const formId = params.formId as string;
    const { toast } = useToast();

    const [form, setForm] = useState<FormType | null>(null);
    const [allResponses, setAllResponses] = useState<FormResponse[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [allMohallahs, setAllMohallahs] = useState<Mohallah[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [activeTab, setActiveTab] = useState("respondents");
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState<string | null>(null);

    // Filter state for respondents and charts
    const [respondentFilters, setRespondentFilters] = useState({
        search: "",
        mohallahId: "all",
        team: "all"
    });

    const [sheetIdInput, setSheetIdInput] = useState("");

    // New filters for non-respondents tab
    const [nonRespondentFilters, setNonRespondentFilters] = useState({
        team: "all",
        designation: "all",
        mohallahId: "all"
    });
    const [availableTeams, setAvailableTeams] = useState<string[]>([]);

    useEffect(() => {
        if (form) {
            setSheetIdInput(form.googleSheetId || "");
        }
    }, [form]);

    const tabOptions = [
        { value: "respondents", label: "Respondents", icon: UserCheck },
        { value: "non-respondents", label: "Non-Respondents", icon: UserX },
        { value: "analytics", label: "Analytics", icon: PieChart },
    ];


    useEffect(() => {
        const fetchCurrentUser = async () => {
            if (typeof window !== "undefined") {
                const userItsId = localStorage.getItem('userItsId');
                if (userItsId) {
                    try {
                        const user = await getUserByItsOrBgkId(userItsId);
                        setCurrentUser(user);
                    } catch (e) {
                         
                    }
                }
            }
        };
        fetchCurrentUser();
    }, []);

    useEffect(() => {
        if (!formId) return;
        let unsubscribe: Unsubscribe | undefined;

        const fetchInitialData = async () => {
            setIsLoading(true);
            try {
                 const mohallahsPromise = new Promise<void>((resolve) => {
                    getMohallahs((fetchedMohallahs) => {
                        setAllMohallahs(fetchedMohallahs);
                        resolve();
                    });
                });

                const [fetchedForm, fetchedUsers] = await Promise.all([
                    getForm(formId),
                    getUsers(),
                    mohallahsPromise
                ]);
                
                if (fetchedForm) setForm(fetchedForm);
                else setError("Form not found.");

                setAllUsers(fetchedUsers);
                 const teams = [...new Set(fetchedUsers.map(u => u.team).filter(Boolean) as string[])].sort();
                setAvailableTeams(teams);

            } catch (err) {
                
                setError("Could not load form or user details.");
            } finally {
                 // The realtime listener will set loading to false
            }
        };

        const setupRealtimeListener = async () => {
            unsubscribe = await getFormResponsesRealtime(formId, (newResponses) => {
                setAllResponses(newResponses);
                setIsLoading(false);
            });
        };
        
        fetchInitialData();
        setupRealtimeListener();

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [formId]);

    const canManageResponses = useMemo(() => {
        if (!currentUser?.role) return false;
        if (currentUser.role === 'superadmin' || currentUser.role === 'admin') return true;
        if (currentUser.designation && TEAM_LEAD_DESIGNATIONS.includes(currentUser.designation)) return true;
        return false;
    }, [currentUser]);

    const handleDeleteResponse = async (responseId: string) => {
        if (!formId) return;
        try {
            await deleteFormResponse(formId, responseId);
            toast({
                title: "Response Deleted",
                description: "The submission has been successfully deleted.",
                variant: "destructive",
            });
            if (form?.googleSheetId) {
                const updatedList = filteredResponses.filter(r => r.id !== responseId);
                await handleGoogleSheetsSync(form.googleSheetId, updatedList);
            }
        } catch (err) {
            toast({ title: "Error", description: "Could not delete the response.", variant: "destructive" });
        }
    };

    const handleGoogleSheetsSync = async (customSheetId?: string, responsesList?: FormResponse[]) => {
        const targetSheetId = customSheetId || form?.googleSheetId;
        if (!form || !targetSheetId) {
            toast({ title: "Sync Failed", description: "No Google Sheet ID configured for this form.", variant: "destructive" });
            return;
        }

        setIsSyncing(true);
        setSyncStatus("Preparing data...");

        try {
            const listToSync = responsesList || filteredResponses;
            const headers = ["Sr.No.", "Submitted At", "ITS ID", "Name", "BGK ID", ...form.questions.map(q => q.label)];
            const dataToSync = listToSync.map((response, index) => {
                const row = [
                    index + 1,
                    format(new Date(response.submittedAt), "yyyy-MM-dd HH:mm:ss"),
                    response.submittedBy,
                    response.submitterName,
                    response.submitterBgkId || 'N/A'
                ];
                form.questions.forEach(q => {
                    const answer = response.responses[q.id];
                    row.push(Array.isArray(answer) ? answer.join('; ') : (answer !== null && answer !== undefined ? String(answer) : ''));
                });
                return row;
            });

            setSyncStatus("Syncing rows...");
            const res = await fetch("/api/google/sync-sheet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sheetId: targetSheetId,
                    sheetName: form.title.substring(0, 30),
                    headers,
                    data: dataToSync,
                    action: "replace"
                })
            });

            const result = await res.json();
            if (!res.ok) {
                throw new Error(result.error || "Failed to sync.");
            }

            toast({ title: "Sync Complete!", description: "Responses successfully pushed to your Google Sheet." });
            setSyncStatus("Synced " + format(new Date(), "p"));
        } catch (err: any) {
            toast({ title: "Sync Failed", description: err.message || "Could not sync data.", variant: "destructive" });
            setSyncStatus("Sync failed");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSaveSheetId = async () => {
        if (!form || !currentUser) return;
        try {
            const sheetId = sheetIdInput.trim();
            await updateForm(form.id, { googleSheetId: sheetId || null as any, updatedBy: currentUser.itsId });
            setForm(prev => prev ? { ...prev, googleSheetId: sheetId || undefined } : null);
            toast({ title: "Sheet Linked", description: "Google Sheet ID has been successfully updated for this form." });
            
            if (sheetId) {
                await handleGoogleSheetsSync(sheetId, filteredResponses);
            }
        } catch (err: any) {
            toast({ title: "Failed to link sheet", description: err.message || "An error occurred.", variant: "destructive" });
        }
    };
    
    const { eligibleUsers, filteredNonRespondents, filteredResponses } = useMemo(() => {
        if (!form || allUsers.length === 0 || !currentUser) {
            return { eligibleUsers: [], filteredNonRespondents: [], filteredResponses: [] };
        }

        let baseEligibleUsers: User[];
        const userMap = new Map(allUsers.map(user => [user.itsId, user]));

        // Determine the pool of users eligible for the form itself
        const isForEveryone = !form.mohallahIds?.length && !form.teams?.length && !form.eligibleItsIds?.length;
        
        baseEligibleUsers = allUsers.filter(user => {
            if (form.eligibleItsIds?.length) {
                return form.eligibleItsIds.includes(user.itsId);
            }
            if (isForEveryone) return true;
            const inMohallah = form.mohallahIds?.includes(user.mohallahId || '');
            const inTeam = form.teams?.includes(user.team || '');
            return !!(inMohallah || inTeam);
        });

        let visibleEligibleUsers = baseEligibleUsers;
        let finalFilteredResponses = allResponses;

        // Now, filter what the *current user* is allowed to see from that eligible pool
        if (currentUser.role === 'admin' && currentUser.mohallahId) {
            visibleEligibleUsers = baseEligibleUsers.filter(user => user.mohallahId === currentUser.mohallahId);
            finalFilteredResponses = allResponses.filter(res => {
                const submitter = userMap.get(res.submittedBy);
                return submitter?.mohallahId === currentUser.mohallahId;
            });
        } else if (currentUser.role !== 'superadmin' && currentUser.designation && TEAM_LEAD_DESIGNATIONS.includes(currentUser.designation)) {
             if (TOP_LEVEL_LEADERS.includes(currentUser.designation)) {
                visibleEligibleUsers = baseEligibleUsers.filter(user => user.mohallahId === currentUser.mohallahId);
                 finalFilteredResponses = allResponses.filter(res => {
                    const submitter = userMap.get(res.submittedBy);
                    return submitter?.mohallahId === currentUser.mohallahId;
                 });
            } else if (MID_LEVEL_LEADERS.includes(currentUser.designation) && currentUser.managedTeams) {
                const managedTeamsSet = new Set(currentUser.managedTeams);
                visibleEligibleUsers = baseEligibleUsers.filter(user => user.team && managedTeamsSet.has(user.team));
                 finalFilteredResponses = allResponses.filter(res => {
                    const submitter = userMap.get(res.submittedBy);
                    return submitter?.team && managedTeamsSet.has(submitter.team);
                 });
            } else if (GROUP_LEVEL_LEADERS.includes(currentUser.designation) && currentUser.team) {
                visibleEligibleUsers = baseEligibleUsers.filter(user => user.team === currentUser.team);
                finalFilteredResponses = allResponses.filter(res => {
                    const submitter = userMap.get(res.submittedBy);
                    return submitter?.team === currentUser.team;
                 });
            }
        }
        // Superadmin sees everything, so no filter is applied to baseEligibleUsers or allResponses.

        // Filter responses dynamically by respondent search & select filters
        const filteredResponsesByInputs = finalFilteredResponses.filter(res => {
            const submitter = userMap.get(res.submittedBy);
            
            const searchLower = respondentFilters.search.toLowerCase().trim();
            const searchMatch = !searchLower ||
                (res.submitterName || "").toLowerCase().includes(searchLower) ||
                (res.submittedBy || "").toLowerCase().includes(searchLower) ||
                (res.submitterBgkId || "").toLowerCase().includes(searchLower);

            const mohallahMatch = respondentFilters.mohallahId === "all" ||
                (submitter?.mohallahId === respondentFilters.mohallahId);

            const teamMatch = respondentFilters.team === "all" ||
                (submitter?.team === respondentFilters.team);

            return searchMatch && mohallahMatch && teamMatch;
        });

        const respondentIds = new Set(finalFilteredResponses.map(r => r.submittedBy));
        const nonResponding = visibleEligibleUsers.filter(user => !respondentIds.has(user.itsId));

        // Apply advanced filters for non-respondents tab
        const finalFilteredNonRespondents = nonResponding.filter(user => {
            const teamMatch = nonRespondentFilters.team === 'all' || user.team === nonRespondentFilters.team;
            const designationMatch = nonRespondentFilters.designation === 'all' || user.designation === nonRespondentFilters.designation;
            const mohallahMatch = nonRespondentFilters.mohallahId === 'all' || user.mohallahId === nonRespondentFilters.mohallahId;
            return teamMatch && designationMatch && mohallahMatch;
        });

        return { 
            eligibleUsers: visibleEligibleUsers, 
            filteredNonRespondents: finalFilteredNonRespondents, 
            filteredResponses: filteredResponsesByInputs 
        };

    }, [form, allUsers, allResponses, currentUser, nonRespondentFilters, respondentFilters]);
    
    const getMohallahNameById = (id?: string) => {
        if (!id) return 'N/A';
        const mohallah = allMohallahs.find(m => m.id === id);
        return mohallah ? mohallah.name : 'Unknown';
    };


    const renderResponseValue = (questionId: string, value: any) => {
        const question = form?.questions.find(q => q.id === questionId);
        if (question?.type === 'checkbox' && Array.isArray(value)) {
            return value.join(', ');
        }
        if (question?.type === 'rating' && typeof value === 'number') {
            return <StarRatingDisplay rating={value} />;
        }
        if (question?.type === 'date' && typeof value === 'string' && value) {
            try {
                return format(new Date(value), "PPP");
            } catch (e) {
                return value; // fallback for invalid date
            }
        }
        if (typeof value === 'string' || typeof value === 'number') {
            return value;
        }
        if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value);
        }
        return value || "N/A";
    };

    const handleExport = (exportType: 'respondents' | 'non-respondents') => {
        if (!form) return;

        let dataToExport: any[];
        let headers: string[];
        let filename: string;
        
        const safeTitle = form.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();

        if (exportType === 'respondents') {
            if (filteredResponses.length === 0) {
                toast({ title: "No data to export", description: "No responses have been submitted yet.", variant: "default" });
                return;
            }
            headers = ["Sr.No.", "Submitted At", "ITS ID", "Name", "BGK ID", ...form.questions.map(q => q.label)];
            dataToExport = filteredResponses.map((response, index) => {
                const row: { [key: string]: any } = {
                    "Sr.No.": index + 1,
                    "Submitted At": format(new Date(response.submittedAt), "yyyy-MM-dd HH:mm:ss"),
                    "ITS ID": response.submittedBy,
                    "Name": response.submitterName,
                    "BGK ID": response.submitterBgkId || 'N/A',
                };
                form.questions.forEach(q => {
                    const answer = response.responses[q.id];
                    row[q.label] = Array.isArray(answer) ? answer.join('; ') : answer;
                });
                return row;
            });
            filename = `respondents_${safeTitle}.csv`;

        } else { // Non-respondents
             if (filteredNonRespondents.length === 0) {
                toast({ title: "No data to export", description: "All eligible members have responded.", variant: "default" });
                return;
            }
            headers = ["Sr.No.", "Name", "ITS ID", "BGK ID", "Team", "Mohallah"];
            dataToExport = filteredNonRespondents.map((user, index) => ({
                "Sr.No.": index + 1,
                "Name": user.name,
                "ITS ID": user.itsId,
                "BGK ID": user.bgkId || 'N/A',
                "Team": user.team || 'N/A',
                "Mohallah": getMohallahNameById(user.mohallahId) || 'N/A',
            }));
            filename = `non_respondents_${safeTitle}.csv`;
        }

        const csv = Papa.unparse({ fields: headers, data: dataToExport });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: "Export Complete", description: `The ${exportType} data has been downloaded.` });
    };

    if (isLoading || !currentUser || allMohallahs.length === 0) {
        return (
            <div className="flex h-screen items-center justify-center">
                <FunkyLoader size="lg">Loading Responses...</FunkyLoader>
            </div>
        );
    }
    
    if (error) {
        return (
           <div className="flex flex-col items-center justify-center h-screen p-4 text-center">
               <FileWarning className="h-16 w-16 text-destructive mb-4" />
               <h1 className="text-2xl font-bold text-destructive">Error Loading Responses</h1>
               <p className="text-muted-foreground mt-2">{error}</p>
                <Button variant="outline" onClick={() => router.back()} className="mt-6">
                   <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
               </Button>
           </div>
       );
   }

    const currentTabLabel = tabOptions.find(t => t.value === activeTab)?.label || "Menu";
    const canManageNonRespondents = currentUser.role === 'admin' || currentUser.role === 'superadmin';

    return (
        <div className="p-4 md:p-6 space-y-6">
            <Card className="glass-surface border-white/10 dark:border-white/5 shadow-xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-primary/5 via-card/20 to-accent/5 border-b border-white/10 dark:border-white/5 py-6">
                    <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 space-y-1">
                            <CardTitle className="text-2xl md:text-3xl font-bold text-foreground">{form?.title || "Form Responses"}</CardTitle>
                            <CardDescription className="text-sm text-muted-foreground">{form?.description || "Viewing all submitted responses."}</CardDescription>
                        </div>
                        <Button variant="outline" onClick={() => router.push('/dashboard/forms')} className="shrink-0 bg-background/50 backdrop-blur-sm hover:bg-background/80">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">Back to Forms</span>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="pt-6 pb-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        {/* Stat Card 1: Total Responses */}
                        <div className="relative group overflow-hidden rounded-xl border border-white/10 dark:border-white/5 bg-gradient-to-br from-card to-muted/20 p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:scale-[1.01]">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Responses</p>
                                    <p className="text-3xl font-extrabold text-foreground">{filteredResponses.length}</p>
                                </div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-inner">
                                    <UserCheck className="h-6 w-6" />
                                </div>
                            </div>
                            <div className="mt-4 flex items-center text-xs text-muted-foreground">
                                <span className="font-medium text-foreground mr-1.5">{filteredResponses.length}</span> submissions recorded
                            </div>
                        </div>

                        {/* Stat Card 2: Eligible Members */}
                        <div className="relative group overflow-hidden rounded-xl border border-white/10 dark:border-white/5 bg-gradient-to-br from-card to-muted/20 p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:scale-[1.01]">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Eligible Members</p>
                                    <p className="text-3xl font-extrabold text-foreground">{eligibleUsers.length}</p>
                                </div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/25 text-accent-foreground shadow-inner">
                                    <Users className="h-6 w-6" />
                                </div>
                            </div>
                            <div className="mt-4 flex items-center text-xs text-muted-foreground">
                                <span className="font-medium text-foreground mr-1.5">{eligibleUsers.length}</span> members in scope
                            </div>
                        </div>

                        {/* Stat Card 3: Response Rate */}
                        <div className="relative group overflow-hidden rounded-xl border border-white/10 dark:border-white/5 bg-gradient-to-br from-card to-muted/20 p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:scale-[1.01]">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Response Rate</p>
                                    <p className="text-3xl font-extrabold text-foreground">
                                        {eligibleUsers.length > 0 ? ((filteredResponses.length / eligibleUsers.length) * 100).toFixed(1) : 0}%
                                    </p>
                                </div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 shadow-inner">
                                    <BarChart2 className="h-6 w-6" />
                                </div>
                            </div>
                            <div className="mt-4 space-y-1">
                                <div className="w-full bg-muted rounded-full h-1.5">
                                    <div 
                                        className="bg-green-500 h-1.5 rounded-full transition-all duration-500" 
                                        style={{ width: `${eligibleUsers.length > 0 ? Math.min(100, (filteredResponses.length / eligibleUsers.length) * 100) : 0}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                {/* Desktop Tabs */}
                <div className="hidden md:block">
                    <TabsList>
                        <TabsTrigger value="respondents">
                            <UserCheck className="mr-2 h-4 w-4"/>Respondents ({filteredResponses.length})
                        </TabsTrigger>
                        <TabsTrigger value="non-respondents" disabled={!canManageNonRespondents}>
                            <UserX className="mr-2 h-4 w-4"/>Non-Respondents ({filteredNonRespondents.length})
                        </TabsTrigger>
                        <TabsTrigger value="analytics">
                            <PieChart className="mr-2 h-4 w-4" />Analytics
                        </TabsTrigger>
                        <TabsTrigger value="sheet" disabled={!form?.googleSheetId}>
                            <FileSpreadsheet className="mr-2 h-4 w-4" />Google Sheet
                        </TabsTrigger>
                    </TabsList>
                </div>
                 {/* Mobile Dropdown */}
                <div className="md:hidden">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-full justify-between">
                                Viewing: {currentTabLabel}
                                <ChevronDown className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                             <DropdownMenuItem onSelect={() => setActiveTab('respondents')}>
                                <UserCheck className="mr-2 h-4 w-4"/>
                                Respondents ({filteredResponses.length})
                             </DropdownMenuItem>
                             <DropdownMenuItem onSelect={() => setActiveTab('non-respondents')} disabled={!canManageNonRespondents}>
                                <UserX className="mr-2 h-4 w-4"/>
                                Non-Respondents ({filteredNonRespondents.length})
                            </DropdownMenuItem>
                             <DropdownMenuItem onSelect={() => setActiveTab('analytics')}>
                                <PieChart className="mr-2 h-4 w-4" />
                                Analytics
                            </DropdownMenuItem>
                             <DropdownMenuItem onSelect={() => setActiveTab('sheet')} disabled={!form?.googleSheetId}>
                                <FileSpreadsheet className="mr-2 h-4 w-4" />
                                Google Sheet
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="mt-4">
                    <TabsContent value="respondents">
                        <Card>
                            <CardHeader className="flex flex-col gap-4 border-b">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                    <div>
                                        <h3 className="text-lg font-semibold">Submitted Responses</h3>
                                        {form?.googleSheetId ? (
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                Linked Sheet ID: <span className="font-mono text-foreground bg-muted px-1.5 py-0.5 rounded">{form.googleSheetId}</span>
                                                {syncStatus && <span className="ml-2 text-primary font-medium">• {syncStatus}</span>}
                                            </p>
                                        ) : (
                                            <p className="text-xs text-amber-600 mt-0.5">Google Sheets sync is not configured for this form.</p>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {form?.googleSheetId && (
                                            <>
                                                <Button 
                                                    onClick={() => window.open(`https://docs.google.com/spreadsheets/d/${form.googleSheetId}/edit`, '_blank')} 
                                                    size="sm" 
                                                    variant="outline"
                                                    className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-400"
                                                >
                                                    <ExternalLink className="mr-2 h-4 w-4" /> Open Sheet
                                                </Button>
                                                <Button 
                                                    onClick={() => handleGoogleSheetsSync()} 
                                                    disabled={isSyncing || filteredResponses.length === 0} 
                                                    size="sm" 
                                                    variant="outline"
                                                    className="bg-green-50 hover:bg-green-100 dark:bg-green-950/30 dark:hover:bg-green-900/30 border-green-200 dark:border-green-900/50 text-green-700 dark:text-green-400"
                                                >
                                                    {isSyncing ? (
                                                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                                                    )}
                                                    {isSyncing ? "Syncing..." : "Sync to Google Sheet"}
                                                </Button>
                                            </>
                                        )}
                                        <Button onClick={() => handleExport('respondents')} disabled={filteredResponses.length === 0} size="sm" variant="outline">
                                            <Download className="mr-2 h-4 w-4" /> Export CSV
                                        </Button>
                                    </div>
                                </div>

                                {canManageResponses && (
                                    <div className="flex flex-col sm:flex-row items-end gap-2 border-t pt-4">
                                        <div className="w-full sm:flex-1 space-y-1">
                                            <label className="text-xs font-semibold text-muted-foreground">Link Google Sheet ID</label>
                                            <Input
                                                placeholder="Enter Google Spreadsheet ID (e.g. 1aBcDeFgHiJkLmNoPqRsTuVwXyZ)"
                                                value={sheetIdInput}
                                                onChange={(e) => setSheetIdInput(e.target.value)}
                                                className="h-9"
                                            />
                                        </div>
                                        <Button onClick={handleSaveSheetId} size="sm" className="h-9 w-full sm:w-auto shrink-0">
                                            Save Sheet ID
                                        </Button>
                                    </div>
                                )}
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                                    <Input
                                        placeholder="Search by name, ITS, or BGK..."
                                        value={respondentFilters.search}
                                        onChange={(e) => setRespondentFilters(prev => ({ ...prev, search: e.target.value }))}
                                        className="h-9"
                                    />
                                    {currentUser.role === 'superadmin' && (
                                        <Select value={respondentFilters.mohallahId} onValueChange={(value) => setRespondentFilters(prev => ({ ...prev, mohallahId: value }))}>
                                            <SelectTrigger className="h-9"><SelectValue placeholder="All Mohallahs" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Mohallahs</SelectItem>
                                                {allMohallahs.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    )}
                                    <Select value={respondentFilters.team} onValueChange={(value) => setRespondentFilters(prev => ({ ...prev, team: value }))}>
                                        <SelectTrigger className="h-9"><SelectValue placeholder="All Teams" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Teams</SelectItem>
                                            {availableTeams.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {filteredResponses.length === 0 ? (
                                    <div className="text-center py-20 space-y-2 border-2 border-dashed rounded-lg">
                                        <Users className="h-12 w-12 text-muted-foreground mx-auto"/>
                                        <p className="text-lg font-medium text-muted-foreground">No Responses Yet</p>
                                        <p className="text-sm text-muted-foreground">
                                            No relevant submissions found for your scope.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                    {/* Mobile View: Accordion */}
                                    <div className="md:hidden">
                                    <Accordion type="single" collapsible className="w-full">
                                        {filteredResponses.map((response, index) => (
                                            <AccordionItem value={response.id} key={response.id}>
                                                <AccordionTrigger>
                                                        <div className="flex items-center gap-4 flex-grow text-left">
                                                            <span className="text-sm font-mono text-muted-foreground">{index + 1}.</span>
                                                            <div className="flex-grow">
                                                                <p className="font-semibold text-card-foreground">{response.submitterName}</p>
                                                                <p className="text-xs text-muted-foreground">ITS: {response.submittedBy} &middot; Submitted: {format(new Date(response.submittedAt), "MMM d, yyyy")}</p>
                                                            </div>
                                                        </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="space-y-4 pt-2">
                                                    <div className="px-2 space-y-3">
                                                    {form?.questions.map(q => (
                                                        <div key={q.id}>
                                                            <p className="font-medium text-sm text-muted-foreground">{q.label}</p>
                                                            <div className="text-base pl-2">{renderResponseValue(q.id, response.responses[q.id])}</div>
                                                        </div>
                                                    ))}
                                                    </div>
                                                    {canManageResponses && (
                                                    <>
                                                        <Separator/>
                                                        <div className="flex justify-end px-2">
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="destructive" size="sm">
                                                                        <Trash2 className="mr-2 h-4 w-4"/> Delete
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                                        <AlertDialogDescription>This will permanently delete the response from {response.submitterName}.</AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                        <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDeleteResponse(response.id)}>Delete</AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </div>
                                                    </>
                                                    )}
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                    </div>

                                    {/* Desktop View: Table */}
                                    <div className="hidden md:block border rounded-lg max-w-full overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[50px]">Sr.No.</TableHead>
                                                <TableHead>Submitter</TableHead>
                                                <TableHead>Submitted At</TableHead>
                                                {form?.questions.map(q => (
                                                    <TableHead key={q.id}>{q.label}</TableHead>
                                                ))}
                                                {canManageResponses && <TableHead className="text-right">Actions</TableHead>}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredResponses.map((response, index) => (
                                                <TableRow key={response.id}>
                                                    <TableCell>{index + 1}</TableCell>
                                                    <TableCell>
                                                        <div className="font-medium">{response.submitterName}</div>
                                                        <div className="text-xs text-muted-foreground">ITS: {response.submittedBy}</div>
                                                        <div className="text-xs text-muted-foreground">BGK: {response.submitterBgkId || 'N/A'}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {format(new Date(response.submittedAt), "MMM d, yyyy p")}
                                                    </TableCell>
                                                    {form?.questions.map(q => (
                                                        <TableCell key={q.id}>
                                                            {renderResponseValue(q.id, response.responses[q.id])}
                                                        </TableCell>
                                                    ))}
                                                    {canManageResponses && (
                                                        <TableCell className="text-right">
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            This will permanently delete the response from {response.submitterName}. This action cannot be undone.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                        <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDeleteResponse(response.id)}>
                                                                            Delete
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                    
                    <TabsContent value="non-respondents">
                        <Card>
                            <CardHeader>
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                  <div>
                                    <h3 className="text-lg font-semibold">Non-Respondents</h3>
                                    <p className="text-sm text-muted-foreground">List of eligible members who have not submitted a response.</p>
                                  </div>
                                  <Button onClick={() => handleExport('non-respondents')} disabled={filteredNonRespondents.length === 0} size="sm" variant="outline">
                                    <Download className="mr-2 h-4 w-4" /> Export
                                  </Button>
                                </div>
                                {canManageNonRespondents && (
                                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t">
                                     {currentUser.role === 'superadmin' && (
                                        <Select value={nonRespondentFilters.mohallahId} onValueChange={(value) => setNonRespondentFilters(prev => ({...prev, mohallahId: value}))}>
                                          <SelectTrigger><SelectValue placeholder="Filter by Mohallah" /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="all">All Mohallahs</SelectItem>
                                            {allMohallahs.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                                          </SelectContent>
                                        </Select>
                                      )}
                                      <Select value={nonRespondentFilters.team} onValueChange={(value) => setNonRespondentFilters(prev => ({...prev, team: value}))}>
                                          <SelectTrigger><SelectValue placeholder="Filter by Team" /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="all">All Teams</SelectItem>
                                            {availableTeams.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                          </SelectContent>
                                      </Select>
                                       <Select value={nonRespondentFilters.designation} onValueChange={(value) => setNonRespondentFilters(prev => ({...prev, designation: value}))}>
                                          <SelectTrigger><SelectValue placeholder="Filter by Designation" /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="all">All Designations</SelectItem>
                                            {ALL_DESIGNATIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                          </SelectContent>
                                      </Select>
                                  </div>
                                )}
                            </CardHeader>
                            <CardContent>
                                {filteredNonRespondents.length === 0 ? (
                                    <div className="text-center py-20 space-y-2 border-2 border-dashed rounded-lg">
                                        <Users className="h-12 w-12 text-muted-foreground mx-auto"/>
                                        <p className="text-lg font-medium text-muted-foreground">All relevant members have responded!</p>
                                    </div>
                                ) : (
                                    <>
                                    {/* Mobile View: Simple List */}
                                    <div className="md:hidden space-y-2">
                                    {filteredNonRespondents.map((user, index) => (
                                        <div key={user.id} className="p-3 border rounded-lg flex justify-between items-center">
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm font-mono text-muted-foreground">{index + 1}.</span>
                                            <div>
                                                <p className="font-medium">{user.name}</p>
                                                <p className="text-xs text-muted-foreground">ITS: {user.itsId} &middot; Team: {user.team || 'N/A'}</p>
                                            </div>
                                        </div>
                                        </div>
                                    ))}
                                    </div>
                                    {/* Desktop View: Table */}
                                    <div className="hidden md:block border rounded-lg max-w-full overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[50px]">Sr.No.</TableHead>
                                                <TableHead>Name</TableHead>
                                                <TableHead>ITS ID</TableHead>
                                                <TableHead>BGK ID</TableHead>
                                                <TableHead>Team</TableHead>
                                                <TableHead>Designation</TableHead>
                                                <TableHead>Mohallah</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredNonRespondents.map((user, index) => (
                                                <TableRow key={user.id}>
                                                    <TableCell>{index + 1}</TableCell>
                                                    <TableCell className="font-medium">{user.name}</TableCell>
                                                    <TableCell>{user.itsId}</TableCell>
                                                    <TableCell>{user.bgkId || 'N/A'}</TableCell>
                                                    <TableCell>{user.team || 'N/A'}</TableCell>
                                                     <TableCell>{user.designation || 'N/A'}</TableCell>
                                                    <TableCell>{getMohallahNameById(user.mohallahId)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="analytics">
                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Filter Analytics Data</CardTitle>
                                    <CardDescription>Filter response data dynamically across charts.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <Input
                                            placeholder="Search by name, ITS, or BGK..."
                                            value={respondentFilters.search}
                                            onChange={(e) => setRespondentFilters(prev => ({ ...prev, search: e.target.value }))}
                                            className="h-9"
                                        />
                                        {currentUser.role === 'superadmin' && (
                                            <Select value={respondentFilters.mohallahId} onValueChange={(value) => setRespondentFilters(prev => ({ ...prev, mohallahId: value }))}>
                                                <SelectTrigger className="h-9"><SelectValue placeholder="All Mohallahs" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Mohallahs</SelectItem>
                                                    {allMohallahs.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        )}
                                        <Select value={respondentFilters.team} onValueChange={(value) => setRespondentFilters(prev => ({ ...prev, team: value }))}>
                                            <SelectTrigger className="h-9"><SelectValue placeholder="All Teams" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Teams</SelectItem>
                                                {availableTeams.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </CardContent>
                            </Card>
                            {form ? (
                                <FormAnalytics form={form} responses={filteredResponses} />
                            ) : (
                                <div className="text-center py-20 text-muted-foreground">Loading form data for analytics...</div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="sheet">
                        {form?.googleSheetId ? (
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle>Google Sheet Live View</CardTitle>
                                        <CardDescription>View and edit the synchronized Google Sheet directly.</CardDescription>
                                    </div>
                                    <Button 
                                        onClick={() => window.open(`https://docs.google.com/spreadsheets/d/${form.googleSheetId}/edit`, '_blank')} 
                                        size="sm"
                                        variant="outline"
                                    >
                                        Open in New Tab <ExternalLink className="ml-2 h-4 w-4" />
                                    </Button>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="w-full h-[600px] border-t rounded-b-lg overflow-hidden bg-white">
                                        <iframe 
                                            src={`https://docs.google.com/spreadsheets/d/${form.googleSheetId}/edit?rm=minimal`}
                                            className="w-full h-full border-0"
                                            allowFullScreen
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="text-center py-20 text-muted-foreground">Google Sheet is not configured.</div>
                        )}
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}

    
