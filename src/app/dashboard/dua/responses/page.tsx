
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, Eye, FileWarning, Users, UserX, PieChart, ChevronDown, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { User, UserRole, UserDesignation, Mohallah } from "@/types";
import { db } from "@/lib/firebase/firebase";
import { collection, doc, getDoc, getDocs, query, where, Timestamp, deleteDoc } from "firebase/firestore";
import { getUserByItsOrBgkId, getUsers } from "@/lib/firebase/userService";
import { getMohallahs } from "@/lib/firebase/mohallahService";
import { format, addWeeks, subWeeks, startOfWeek, endOfWeek } from "date-fns";
import Papa from "papaparse";
import { FunkyLoader } from "@/components/ui/funky-loader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";


interface DuaSubmission {
    id: string;
    itsId: string;
    name: string;
    bgkId?: string;
    weekId: string;
    duaKamilCount: number;
    kahfCount: number;
    feedback?: string;
    markedAt: string; // ISO String
}

const TEAM_LEAD_DESIGNATIONS: UserDesignation[] = ["Captain", "Vice Captain", "Group Leader", "Asst.Grp Leader", "Major", "Commander", "Assistant Commander", "Senior Assistant Commander"];
const TOP_LEVEL_LEADERS: UserDesignation[] = ["Major", "Captain", "Commander", "Senior Assistant Commander"];
const MID_LEVEL_LEADERS: UserDesignation[] = ["Vice Captain"];
const GROUP_LEVEL_LEADERS: UserDesignation[] = ["Group Leader", "Asst.Grp Leader", "Assistant Commander"];

const getWeekId = (date: Date) => {
    const year = date.getFullYear();
    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
};

// Helper to get the start and end dates of a week from a weekId
const getWeekDateRange = (weekId: string) => {
    const [year, weekNumber] = weekId.split('-W').map(Number);
    const firstDayOfYear = new Date(year, 0, 1);
    const firstDayOfWeek = startOfWeek(addWeeks(firstDayOfYear, weekNumber - 1), { weekStartsOn: 0 }); // Assuming week starts on Sunday
    const lastDayOfWeek = endOfWeek(firstDayOfWeek, { weekStartsOn: 0 });
    return {
        start: firstDayOfWeek,
        end: lastDayOfWeek
    };
};


export default function DuaResponsesPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [allSubmissions, setAllSubmissions] = useState<DuaSubmission[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [allMohallahs, setAllMohallahs] = useState<Mohallah[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [currentWeek, setCurrentWeek] = useState(new Date());

    const [filters, setFilters] = useState({
        mohallahId: 'all',
        team: 'all',
        designation: 'all',
    });
    
    const [availableTeams, setAvailableTeams] = useState<string[]>([]);

    const weekId = getWeekId(currentWeek);
    const weekDateRange = getWeekDateRange(weekId);

    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true);
            try {
                const itsId = localStorage.getItem('userItsId');
                if (itsId) {
                    const user = await getUserByItsOrBgkId(itsId);
                    setCurrentUser(user);
                }
                
                const users = await getUsers();
                setAllUsers(users);

                const teams = [...new Set(users.map(u => u.team).filter(Boolean) as string[])].sort();
                setAvailableTeams(teams);

                getMohallahs(setAllMohallahs);
                
            } catch (err: any) {
                if (err.message.includes("index")) {
                    setError("A database index is required to view this data. Please contact support.");
                } else {
                    setError("Could not load initial user and mohallah data.");
                }
                 setIsLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (!weekId) return;

        const fetchSubmissionsForWeek = async () => {
            setIsLoading(true);
            setError(null);
            try {
                 const submissionPromises = allUsers.map(user => {
                    const docRef = doc(db, 'users', user.itsId, 'duaAttendance', weekId);
                    return getDoc(docRef);
                });

                const submissionSnapshots = await Promise.all(submissionPromises);
                
                const subs: DuaSubmission[] = [];
                submissionSnapshots.forEach(docSnap => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        const markedAt = data.markedAt instanceof Timestamp 
                            ? data.markedAt.toDate().toISOString() 
                            : new Date().toISOString();
                        
                        subs.push({ ...data, id: docSnap.id, itsId: docSnap.ref.parent.parent!.id, markedAt } as DuaSubmission);
                    }
                });
                
                setAllSubmissions(subs);

            } catch (err) {
                 setError("Could not load submission data for the selected week.");
            } finally {
                setIsLoading(false);
            }
        };

        if (allUsers.length > 0) {
            fetchSubmissionsForWeek();
        }

    }, [weekId, allUsers]);

    const filteredSubmissions = useMemo(() => {
        if (!currentUser) return [];

        let visibleUsers: User[];
         if (currentUser.role === 'superadmin') {
            visibleUsers = allUsers;
        } else if (currentUser.role === 'admin' || TOP_LEVEL_LEADERS.includes(currentUser.designation || 'Member')) {
            visibleUsers = allUsers.filter(u => u.mohallahId === currentUser.mohallahId);
        } else if (MID_LEVEL_LEADERS.includes(currentUser.designation || 'Member')) {
            const managedTeamsSet = new Set(currentUser.managedTeams || []);
            visibleUsers = allUsers.filter(u => u.team && managedTeamsSet.has(u.team));
        } else if (GROUP_LEVEL_LEADERS.includes(currentUser.designation || 'Member')) {
             visibleUsers = allUsers.filter(u => u.team === currentUser.team);
        } else {
            return []; // Not authorized to see any submissions
        }

        const visibleUserItsIds = new Set(visibleUsers.map(u => u.itsId));

        let data = allSubmissions.filter(sub => visibleUserItsIds.has(sub.itsId));

        if (filters.mohallahId !== 'all') {
            const userItsInMohallah = new Set(allUsers.filter(u => u.mohallahId === filters.mohallahId).map(u => u.itsId));
            data = data.filter(sub => userItsInMohallah.has(sub.itsId));
        }
        if (filters.team !== 'all') {
            const userItsInTeam = new Set(allUsers.filter(u => u.team === filters.team).map(u => u.itsId));
            data = data.filter(sub => userItsInTeam.has(sub.itsId));
        }
        if (filters.designation !== 'all') {
             const userItsWithDesignation = new Set(allUsers.filter(u => u.designation === filters.designation).map(u => u.itsId));
             data = data.filter(sub => userItsWithDesignation.has(sub.itsId));
        }

        return data;
    }, [currentUser, allUsers, allSubmissions, filters]);

    const handleExport = () => {
        if(filteredSubmissions.length === 0) {
            toast({ title: "No Data", description: "No data to export."});
            return;
        }
        const dataToExport = filteredSubmissions.map(sub => ({
            "Name": sub.name,
            "ITS ID": sub.itsId,
            "BGK ID": sub.bgkId || 'N/A',
            "Dua e Kamil": sub.duaKamilCount,
            "Surat al Kahf": sub.kahfCount,
            "Feedback": sub.feedback || 'N/A',
            "Submitted At": format(new Date(sub.markedAt), "PPpp")
        }));
        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `dua_submissions_${weekId}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
        toast({title: "Exported", description: "Submission data has been downloaded."});
    };
    
    const handleDeleteSubmission = async (submission: DuaSubmission) => {
        try {
            const docRef = doc(db, 'users', submission.itsId, 'duaAttendance', submission.weekId);
            await deleteDoc(docRef);
            setAllSubmissions(prev => prev.filter(s => s.id !== submission.id));
            toast({
                title: "Submission Deleted",
                description: `Submission for ${submission.name} for week ${submission.weekId} has been removed.`,
                variant: "destructive"
            });
        } catch (error) {
            toast({
                title: "Deletion Error",
                description: "Could not delete the submission. Please try again.",
                variant: "destructive",
            });
        }
    };
    

    if (isLoading && allUsers.length === 0) { // Only show initial big loader
        return <div className="flex h-full items-center justify-center"><FunkyLoader size="lg">Loading Submissions...</FunkyLoader></div>;
    }
    
    if (error) {
         return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] p-4 text-center">
               <FileWarning className="h-16 w-16 text-destructive mb-4" />
               <h1 className="text-2xl font-bold text-destructive">Error Loading Data</h1>
               <p className="text-muted-foreground mt-2">{error}</p>
                <Button variant="outline" onClick={() => router.back()} className="mt-6">
                   <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
               </Button>
           </div>
       );
    }
    
    return (
        <Card className="shadow-lg">
            <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                 <div>
                    <CardTitle className="text-2xl md:text-3xl">Weekly Dua</CardTitle>
                    <CardDescription>
                         Responses for Week: {weekId} ({format(weekDateRange.start, 'MMM d')} - {format(weekDateRange.end, 'MMM d, yyyy')})
                    </CardDescription>
                </div>
                 <div className="flex items-center gap-2">
                     <Button variant="outline" size="sm" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))} disabled={isLoading}>
                        <ChevronLeft className="h-4 w-4" />
                     </Button>
                     <Button variant="outline" size="sm" onClick={() => setCurrentWeek(new Date())} disabled={isLoading || getWeekId(currentWeek) === getWeekId(new Date())}>
                        This Week
                     </Button>
                     <Button variant="outline" size="sm" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))} disabled={isLoading || getWeekId(currentWeek) === getWeekId(new Date())}>
                        <ChevronRight className="h-4 w-4" />
                     </Button>
                     <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/dua')}>
                        <ArrowLeft className="h-4 w-4 md:mr-2"/>
                        <span className="hidden md:inline">Back</span>
                    </Button>
                    <Button onClick={handleExport} disabled={filteredSubmissions.length === 0} size="sm">
                        <Download className="h-4 w-4 md:mr-2" />
                        <span className="hidden md:inline">Export</span>
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    {currentUser?.role === 'superadmin' && (
                        <Select value={filters.mohallahId} onValueChange={(value) => setFilters(prev => ({ ...prev, mohallahId: value }))}>
                            <SelectTrigger><SelectValue placeholder="Filter by Mohallah" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Mohallahs</SelectItem>
                                {allMohallahs.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )}
                    <Select value={filters.team} onValueChange={(value) => setFilters(prev => ({ ...prev, team: value }))}>
                        <SelectTrigger><SelectValue placeholder="Filter by Team" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Teams</SelectItem>
                            {availableTeams.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={filters.designation} onValueChange={(value) => setFilters(prev => ({ ...prev, designation: value }))}>
                        <SelectTrigger><SelectValue placeholder="Filter by Designation" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Designations</SelectItem>
                            {TEAM_LEAD_DESIGNATIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                 {isLoading ? (
                     <div className="flex h-60 items-center justify-center"><FunkyLoader size="lg">Loading Week Data...</FunkyLoader></div>
                 ) : filteredSubmissions.length === 0 ? (
                    <div className="text-center py-20 space-y-2 border-2 border-dashed rounded-lg">
                        <Users className="h-12 w-12 text-muted-foreground mx-auto"/>
                        <p className="text-lg font-medium text-muted-foreground">No Submissions Found</p>
                        <p className="text-sm text-muted-foreground">
                            No submissions were recorded for this week.
                        </p>
                    </div>
                ) : (
                    <>
                         <div className="md:hidden">
                            <Accordion type="single" collapsible className="w-full">
                            {filteredSubmissions.map((sub, index) => (
                                <AccordionItem value={sub.id} key={sub.id}>
                                    <AccordionTrigger>
                                        <div className="flex items-center gap-4 flex-grow text-left">
                                            <span className="text-sm font-mono text-muted-foreground">{index + 1}.</span>
                                            <div className="flex-grow">
                                                <p className="font-semibold text-card-foreground">{sub.name}</p>
                                                <p className="text-xs text-muted-foreground">ITS: {sub.itsId}</p>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                     <AccordionContent className="space-y-3 pt-2">
                                        <div className="px-2 space-y-2 text-sm">
                                            <p><strong>Dua e Kamil:</strong> {sub.duaKamilCount}</p>
                                            <p><strong>Surat al Kahf:</strong> {sub.kahfCount}</p>
                                            <p><strong>Feedback:</strong> {sub.feedback || 'N/A'}</p>
                                            <p className="text-xs text-muted-foreground">Submitted at {format(new Date(sub.markedAt), 'p')}</p>
                                        </div>
                                         {(currentUser?.role === 'admin' || currentUser?.role === 'superadmin') && (
                                            <div className="flex justify-end px-2 pt-2 border-t">
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="destructive" size="sm"><Trash2 className="mr-2 h-4 w-4"/> Delete</Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the submission for {sub.name}.</AlertDialogDescription></AlertDialogHeader>
                                                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDeleteSubmission(sub)}>Delete</AlertDialogAction></AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                         )}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                            </Accordion>
                         </div>
                         <div className="hidden md:block border rounded-lg max-w-full overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Sr. No</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>ITS ID</TableHead>
                                        <TableHead>Dua e Kamil</TableHead>
                                        <TableHead>Surat al Kahf</TableHead>
                                        <TableHead>Feedback</TableHead>
                                        {(currentUser?.role === 'admin' || currentUser?.role === 'superadmin') && <TableHead className="text-right">Actions</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredSubmissions.map((sub, index) => (
                                        <TableRow key={sub.id}>
                                            <TableCell>{index + 1}</TableCell>
                                            <TableCell>{sub.name}</TableCell>
                                            <TableCell>{sub.itsId}</TableCell>
                                            <TableCell>{sub.duaKamilCount}</TableCell>
                                            <TableCell>{sub.kahfCount}</TableCell>
                                            <TableCell className="max-w-xs truncate">{sub.feedback || 'N/A'}</TableCell>
                                             {(currentUser?.role === 'admin' || currentUser?.role === 'superadmin') && (
                                                <TableCell className="text-right">
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                             <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the submission for {sub.name}.</AlertDialogDescription></AlertDialogHeader>
                                                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDeleteSubmission(sub)}>Delete</AlertDialogAction></AlertDialogFooter>
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
    );
}
