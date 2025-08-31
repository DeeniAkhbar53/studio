
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Search, Download, Loader2, AlertTriangle, BarChartHorizontal, BarChart, PieChart as PieChartIcon, CheckSquare } from "lucide-react";
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
import type { Miqaat, User, ReportResultItem, AttendanceRecord } from "@/types"; 
import { getMiqaats } from "@/lib/firebase/miqaatService";
import { getUsers } from "@/lib/firebase/userService";
import { getAttendanceRecordsByMiqaat, getAttendanceRecordsByUser } from "@/lib/firebase/attendanceService"; 
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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


const reportSchema = z.object({
  reportType: z.enum(["miqaat_summary", "member_attendance", "overall_activity", "non_attendance_miqaat"], {
    required_error: "You need to select a report type.",
  }),
  miqaatId: z.string().optional(),
  itsId: z.string().optional().refine(val => !val || /^\d{8}$/.test(val), {
    message: "ITS ID must be 8 digits if provided.",
  }),
  dateRange: z.object({
    from: z.date().optional(),
    to: z.date().optional(),
  }).optional(),
}).superRefine((data, ctx) => {
    if ((data.reportType === "miqaat_summary" || data.reportType === "non_attendance_miqaat") && !data.miqaatId) {
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

export default function ReportsPage() {
  const [reportData, setReportData] = useState<ReportResultItem[] | null>(null);
  const [chartData, setChartData] = useState<ChartDataItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [availableMiqaats, setAvailableMiqaats] = useState<Pick<Miqaat, "id" | "name" | "startTime" | "endTime" | "reportingTime" | "mohallahIds" | "teams" | "location" | "barcodeData" | "attendance">[]>([]);
  const [isLoadingMiqaats, setIsLoadingMiqaats] = useState(true);
  const [isGraphDialogOpen, setIsGraphDialogOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [chartType, setChartType] = useState<ChartType>("vertical_bar");
  const [downloadOptions, setDownloadOptions] = useState({ includeTitle: true, includeLegend: true });

  const chartRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      reportType: undefined,
      miqaatId: "",
      itsId: "",
      dateRange: { from: undefined, to: undefined },
    },
  });
  
  useEffect(() => {
    setIsLoadingMiqaats(true);
    const unsubscribe = getMiqaats((fetchedMiqaats) => {
      setAvailableMiqaats(fetchedMiqaats);
      setIsLoadingMiqaats(false);
    });
    return () => unsubscribe();
  }, []);


  const watchedReportType = form.watch("reportType");

  const onSubmit = async (values: ReportFormValues) => {
    setIsLoading(true);
    setReportData(null); 
    setChartData(null);
    
    let fetchedAttendanceRecords: AttendanceRecord[] = []; 
    let reportResultItems: ReportResultItem[] = [];


    try {
      if (values.reportType === "miqaat_summary" && values.miqaatId) {
        fetchedAttendanceRecords = await getAttendanceRecordsByMiqaat(values.miqaatId);
        reportResultItems = fetchedAttendanceRecords.map(att => ({
          id: att.id,
          userName: att.userName,
          userItsId: att.userItsId,
          miqaatName: att.miqaatName,
          date: att.markedAt,
          status: att.status === 'late' ? 'Late' : 'Present',
          markedByItsId: att.markedByItsId,
        }));
      } else if (values.reportType === "member_attendance" && values.itsId) {
        fetchedAttendanceRecords = await getAttendanceRecordsByUser(values.itsId);
         reportResultItems = fetchedAttendanceRecords.map(att => ({
            id: att.id,
            userName: att.userName,
            userItsId: att.userItsId,
            miqaatName: att.miqaatName,
            date: att.markedAt,
            status: att.status === 'late' ? 'Late' : 'Present',
            markedByItsId: att.markedByItsId,
          }));
      } else if (values.reportType === "overall_activity") {
        const allMiqaatDocs = await new Promise<Pick<Miqaat, "id" | "name" | "startTime" | "endTime" | "reportingTime" | "mohallahIds" | "teams" | "location" | "barcodeData" | "attendance">[]>((resolve) => {
            const unsubscribe = getMiqaats((data) => {
                resolve(data);
                unsubscribe(); 
            });
        });
        const allAttendancePromises = allMiqaatDocs.map(m => getAttendanceRecordsByMiqaat(m.id));
        const allAttendanceArrays = await Promise.all(allAttendancePromises);
        fetchedAttendanceRecords = allAttendanceArrays.flat();
        reportResultItems = fetchedAttendanceRecords.map(att => ({
            id: att.id,
            userName: att.userName,
            userItsId: att.userItsId,
            miqaatName: att.miqaatName,
            date: att.markedAt,
            status: att.status === 'late' ? 'Late' : 'Present',
            markedByItsId: att.markedByItsId,
        }));
      } else if (values.reportType === "non_attendance_miqaat" && values.miqaatId) {
        const selectedMiqaat = availableMiqaats.find(m => m.id === values.miqaatId);
        if (!selectedMiqaat) {
          toast({ title: "Error", description: "Selected Miqaat not found.", variant: "destructive" });
          setIsLoading(false);
          return;
        }
        const allUsers = await getUsers(); 
        const attendanceForMiqaat = await getAttendanceRecordsByMiqaat(values.miqaatId); 
        const attendedItsIds = new Set(attendanceForMiqaat.map(att => att.userItsId));
        let eligibleUsers = allUsers;
        if (selectedMiqaat.mohallahIds && selectedMiqaat.mohallahIds.length > 0) {
          eligibleUsers = allUsers.filter(user => user.mohallahId && selectedMiqaat.mohallahIds!.includes(user.mohallahId));
        } else if (selectedMiqaat.teams && selectedMiqaat.teams.length > 0) {
          eligibleUsers = allUsers.filter(user => user.team && selectedMiqaat.teams!.includes(user.team));
        }
        const nonAttendantUsers = eligibleUsers.filter(user => !attendedItsIds.has(user.itsId));
        reportResultItems = nonAttendantUsers.map(user => ({
          id: user.id, 
          userName: user.name,
          userItsId: user.itsId,
          miqaatName: selectedMiqaat.name,
          date: new Date(selectedMiqaat.startTime).toISOString(), 
          status: "Absent",
        }));
      }

      if (values.dateRange?.from) {
        reportResultItems = reportResultItems.filter(r => r.date && new Date(r.date) >= values.dateRange!.from!);
      }
      if (values.dateRange?.to) {
        reportResultItems = reportResultItems.filter(r => r.date && new Date(r.date) <= values.dateRange!.to!);
      }
      
      setReportData(reportResultItems);

      if (values.reportType === "miqaat_summary" || values.reportType === "overall_activity") {
        const attendanceByMiqaat: { [key: string]: { present: number; late: number; totalAttendance: number } } = {};
        reportResultItems.forEach(record => {
          if (!attendanceByMiqaat[record.miqaatName]) {
            attendanceByMiqaat[record.miqaatName] = { present: 0, late: 0, totalAttendance: 0 };
          }
          if (record.status === "Present") {
            attendanceByMiqaat[record.miqaatName].present++;
            attendanceByMiqaat[record.miqaatName].totalAttendance++;
          } else if (record.status === "Late") {
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

      if (reportResultItems.length > 0) {
          toast({ title: "Report Generated", description: `Your report is ready below. Found ${reportResultItems.length} record(s).` });
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

  const handleExport = () => {
    if (!reportData || reportData.length === 0) {
      toast({ title: "No data to export", description: "Please generate a report first.", variant: "destructive" });
      return;
    }
    const headers = ["User Name", "ITS ID", "Miqaat", "Date", "Status", "Marked By ITS ID"];
    const csvRows = [
      headers.join(','),
      ...reportData.map(row => [
        `"${row.userName.replace(/"/g, '""')}"`,
        row.userItsId,
        `"${row.miqaatName.replace(/"/g, '""')}"`,
        row.date ? format(new Date(row.date), "yyyy-MM-dd HH:mm:ss") : "N/A",
        row.status,
        row.markedByItsId || "N/A"
      ].join(','))
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
  
  const selectedMiqaatDetails = availableMiqaats.find(m => m.id === form.getValues("miqaatId"));

  const chartConfig = {
      present: { label: "Present", color: "hsl(var(--chart-2))" },
      late: { label: "Late", color: "hsl(var(--chart-3))" },
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a report type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="miqaat_summary">Miqaat Summary (Attendance)</SelectItem>
                          <SelectItem value="non_attendance_miqaat">Miqaat Non-Attendance</SelectItem>
                          <SelectItem value="member_attendance">Member Full History</SelectItem>
                          <SelectItem value="overall_activity">Overall Activity Log</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {(watchedReportType === "miqaat_summary" || watchedReportType === "non_attendance_miqaat") && (
                  <FormField
                    control={form.control}
                    name="miqaatId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Miqaat</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingMiqaats}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={isLoadingMiqaats ? "Loading Miqaats..." : "Select a Miqaat"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {isLoadingMiqaats && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                            {!isLoadingMiqaats && availableMiqaats.length === 0 && <SelectItem value="no-miqaats" disabled>No Miqaats available</SelectItem>}
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
              <Button type="submit" disabled={isLoading || isLoadingMiqaats} className="min-w-[180px]" size="sm">
                {isLoading || isLoadingMiqaats ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                {isLoading ? "Generating..." : (isLoadingMiqaats ? "Loading Options..." : "Generate Report") }
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
                    Displaying {reportData.length} record(s) 
                    {(watchedReportType === "miqaat_summary" || watchedReportType === "non_attendance_miqaat") && selectedMiqaatDetails && ` for Miqaat: ${selectedMiqaatDetails.name}`}
                    {watchedReportType === "member_attendance" && form.getValues("itsId") && ` for ITS ID: ${form.getValues("itsId")}`}
                    {form.getValues("dateRange.from") && ` from ${format(form.getValues("dateRange.from")!, "LLL dd, y")}`}
                    {form.getValues("dateRange.to") && ` to ${format(form.getValues("dateRange.to")!, "LLL dd, y")}`}.
                </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto shrink-0">
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
                                                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} angle={-45} textAnchor="end" interval={0} height={100} />
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
                                                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={8} width={120} interval={0} />
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
                                                 <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" hideLabel />} />
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
                <Button variant="outline" onClick={handleExport} disabled={!reportData || reportData.length === 0 || isLoading} size="sm" className="w-full sm:w-auto">
                  <Download className="mr-2 h-4 w-4" /> Export CSV
                </Button>
            </div>
          </CardHeader>
          <CardContent>
            {reportData.length > 0 ? (
             <>
                {/* Mobile View: Cards */}
                <div className="md:hidden space-y-4">
                  {reportData.map((record) => (
                    <Card key={record.id + (record.date || '')} className="w-full">
                        <CardContent className="p-4 flex flex-col gap-2">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-semibold text-card-foreground">{record.userName}</p>
                                    <p className="text-sm text-muted-foreground">ITS: {record.userItsId}</p>
                                </div>
                                <span className={cn("px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap",
                                  record.status === 'Present' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                  record.status === 'Absent' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                  record.status === 'Late' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                )}>
                                  {record.status}
                                </span>
                            </div>
                            <Separator className="my-2" />
                            <div className="text-sm text-muted-foreground space-y-1">
                                <p><strong>Miqaat:</strong> {record.miqaatName}</p>
                                <p><strong>Date:</strong> {record.date ? format(new Date(record.date), "PP p") : "N/A"}</p>
                                { (watchedReportType === "miqaat_summary" || watchedReportType === "overall_activity" || watchedReportType === "member_attendance") &&
                                    <p><strong>Marked By:</strong> {record.markedByItsId || "N/A"}</p>
                                }
                            </div>
                        </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Desktop View: Table */}
                <div className="hidden md:block overflow-x-auto">
                    <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>Member Name</TableHead>
                        <TableHead>ITS ID</TableHead>
                        <TableHead>Miqaat</TableHead>
                        <TableHead>Date / Time</TableHead>
                        <TableHead>Status</TableHead>
                        { (watchedReportType === "miqaat_summary" || watchedReportType === "overall_activity" || watchedReportType === "member_attendance") &&
                            <TableHead className="text-right">Marked By</TableHead>
                        }
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {reportData.map((record) => (
                        <TableRow key={record.id + (record.date || '')}>
                            <TableCell className="font-medium">{record.userName}</TableCell>
                            <TableCell>{record.userItsId}</TableCell>
                            <TableCell>{record.miqaatName}</TableCell>
                            <TableCell>{record.date ? format(new Date(record.date), "PP p") : "N/A"}</TableCell>
                            <TableCell>
                            <span className={cn("px-2 py-0.5 text-xs font-semibold rounded-full",
                                record.status === 'Present' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                record.status === 'Absent' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                record.status === 'Late' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                )}>
                                {record.status}
                                </span>
                            </TableCell>
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
              <p className="text-center text-muted-foreground py-6">No data found for the selected criteria.</p>
            )}
          </CardContent>
        </Card>
      )}

      {!isLoading && reportData === null && !isLoadingMiqaats && (
         <Card className="shadow-lg mt-6">
            <CardContent className="py-10 flex flex-col items-center justify-center">
                <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-center text-muted-foreground">
                    Please select your report criteria and click &quot;Generate Report&quot; to view data.
                </p>
            </CardContent>
         </Card>
      )}
      {(isLoadingMiqaats && reportData === null) && (
        <Card className="shadow-lg mt-6">
            <CardContent className="py-10 flex justify-center items-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                <p className="text-center text-muted-foreground">
                    Loading Miqaat options...
                </p>
            </CardContent>
         </Card>
      )}
    </div>
  );
}

    