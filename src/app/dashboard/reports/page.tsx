
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Search, Download } from "lucide-react"; // Renamed to avoid conflict with Calendar component
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import type { Miqaat, User, AttendanceRecord } from "@/types";
import { cn } from "@/lib/utils";

// Mock data (replace with actual data fetching in a real app)
const mockMiqaats: Pick<Miqaat, "id" | "name">[] = [
  { id: "m1", name: "Miqaat Al-Layl" },
  { id: "m2", name: "Ashara Mubarakah - Day 1" },
  { id: "m3", name: "Eid Majlis" },
];

// Define a more specific type for attendance records in reports
interface ReportAttendanceRecord extends AttendanceRecord {
  userName: string;
  userItsId: string;
}

const mockReportData: ReportAttendanceRecord[] = [
    { id: "r_att1", miqaatId: "m1", miqaatName: "Miqaat Al-Layl", date: new Date(2024, 9, 10, 19, 30).toISOString(), status: "Present", userName: "Abbas Bhai", userItsId: "10101010" },
    { id: "r_att2", miqaatId: "m1", miqaatName: "Miqaat Al-Layl", date: new Date(2024, 9, 10, 19, 32).toISOString(), status: "Absent", userName: "Fatema Ben", userItsId: "20202020" },
    { id: "r_att3", miqaatId: "m2", miqaatName: "Ashara Mubarakah - Day 1", date: new Date(2024, 9, 15, 9, 30).toISOString(), status: "Present", userName: "Yusuf Bhai", userItsId: "30303030" },
    { id: "r_att4", miqaatId: "m2", miqaatName: "Ashara Mubarakah - Day 1", date: new Date(2024, 9, 15, 9, 35).toISOString(), status: "Late", userName: "Abbas Bhai", userItsId: "10101010" },
    { id: "r_att5", miqaatId: "m3", miqaatName: "Eid Majlis", date: new Date(2024, 10, 1, 8, 10).toISOString(), status: "Present", userName: "Fatema Ben", userItsId: "20202020" },
];


const reportSchema = z.object({
  reportType: z.enum(["miqaat_summary", "member_attendance", "overall_activity"], {
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
    if (data.reportType === "miqaat_summary" && !data.miqaatId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Miqaat selection is required for Miqaat Summary report.",
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

export default function ReportsPage() {
  const [reportData, setReportData] = useState<ReportAttendanceRecord[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      reportType: undefined,
      miqaatId: "",
      itsId: "",
      dateRange: {
        from: undefined,
        to: undefined,
      },
    },
  });

  const watchedReportType = form.watch("reportType");

  const onSubmit = async (values: ReportFormValues) => {
    setIsLoading(true);
    setReportData(null); 
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    let generatedReport: ReportAttendanceRecord[] = [];

    if (values.reportType === "miqaat_summary" && values.miqaatId) {
        generatedReport = mockReportData.filter(r => r.miqaatId === values.miqaatId);
    } else if (values.reportType === "member_attendance" && values.itsId) {
        generatedReport = mockReportData.filter(r => r.userItsId === values.itsId);
    } else if (values.reportType === "overall_activity") {
        generatedReport = mockReportData; // Start with all data
    }
    
    // Filter by date range if provided
    if (values.dateRange?.from) {
        generatedReport = generatedReport.filter(r => new Date(r.date) >= values.dateRange!.from!);
    }
    if (values.dateRange?.to) {
        generatedReport = generatedReport.filter(r => new Date(r.date) <= values.dateRange!.to!);
    }
    
    setReportData(generatedReport);
    setIsLoading(false);
    if (generatedReport.length > 0) {
        toast({ title: "Report Generated", description: "Your report is ready below." });
    } else {
        toast({ title: "No Data", description: "No data found for the selected criteria.", variant: "destructive" });
    }
  };

  const handleExport = () => {
    if (!reportData || reportData.length === 0) {
      toast({ title: "No data to export", description: "Please generate a report first.", variant: "destructive" });
      return;
    }
    toast({ title: "Exporting Report", description: "CSV export functionality is a future enhancement." });
    // Actual CSV export logic (e.g., convert reportData to CSV string and trigger download)
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Generate Attendance Report</CardTitle>
          <CardDescription>Select criteria to generate a detailed attendance report.</CardDescription>
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
                          <SelectItem value="miqaat_summary">Miqaat Summary</SelectItem>
                          <SelectItem value="member_attendance">Member Attendance</SelectItem>
                          <SelectItem value="overall_activity">Overall Activity Log</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {watchedReportType === "miqaat_summary" && (
                  <FormField
                    control={form.control}
                    name="miqaatId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Miqaat</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a Miqaat" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {mockMiqaats.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
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
                      <FormLabel>Date Range</FormLabel>
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
                        Optional: Specify a date range for the report.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" disabled={isLoading} className="min-w-[180px]">
                {isLoading ? (
                  "Generating..."
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" /> Generate Report
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {reportData && (
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
            <div>
                <CardTitle>Report Results</CardTitle>
                <CardDescription>
                    Displaying {reportData.length} record(s) 
                    {watchedReportType === "miqaat_summary" && form.getValues("miqaatId") && ` for Miqaat: ${mockMiqaats.find(m => m.id === form.getValues("miqaatId"))?.name || 'N/A'}`}
                    {watchedReportType === "member_attendance" && form.getValues("itsId") && ` for ITS ID: ${form.getValues("itsId")}`}
                    {form.getValues("dateRange.from") && ` from ${format(form.getValues("dateRange.from")!, "LLL dd, y")}`}
                    {form.getValues("dateRange.to") && ` to ${format(form.getValues("dateRange.to")!, "LLL dd, y")}`}.
                </CardDescription>
            </div>
            <Button variant="outline" onClick={handleExport} disabled={reportData.length === 0 || isLoading}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            {reportData.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member Name</TableHead>
                      <TableHead>ITS ID</TableHead>
                      {watchedReportType !== "member_attendance" && <TableHead>Miqaat</TableHead>}
                      <TableHead>Date & Time</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{record.userName}</TableCell>
                        <TableCell>{record.userItsId}</TableCell>
                        {watchedReportType !== "member_attendance" && <TableCell>{record.miqaatName}</TableCell>}
                        <TableCell>{format(new Date(record.date), "PP p")}</TableCell>
                        <TableCell className="text-right">
                          <span className={cn("px-2 py-0.5 text-xs font-semibold rounded-full",
                              record.status === 'Present' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                              record.status === 'Absent' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                              record.status === 'Late' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                              'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                            )}>
                              {record.status}
                            </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-6">No data found for the selected criteria.</p>
            )}
          </CardContent>
        </Card>
      )}

      {!isLoading && reportData === null && (
         <Card className="shadow-lg">
            <CardContent className="py-10">
                <p className="text-center text-muted-foreground">
                    Please select your report criteria and click &quot;Generate Report&quot; to view data.
                </p>
            </CardContent>
         </Card>
      )}
    </div>
  );
}

