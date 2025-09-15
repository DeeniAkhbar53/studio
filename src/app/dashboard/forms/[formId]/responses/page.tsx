
"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, Trash2, Users, FileWarning, Download, UserCheck, UserX, Star } from "lucide-react";
import type { FormResponse, UserRole, UserDesignation, User, Form as FormType, Mohallah } from "@/types";
import { getFormResponsesRealtime, deleteFormResponse, getForm } from "@/lib/firebase/formService";
import { getUsers, getUserByItsOrBgkId } from "@/lib/firebase/userService";
import { getMohallahs } from "@/lib/firebase/mohallahService";
import { format } from "date-fns";
import { Unsubscribe } from "firebase/firestore";
import Papa from "papaparse";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";

const TEAM_LEAD_DESIGNATIONS: UserDesignation[] = ["Captain", "Vice Captain", "Group Leader", "Asst.Grp Leader", "Major"];
const TOP_LEVEL_LEADERS: UserDesignation[] = ["Major", "Captain"];
const MID_LEVEL_LEADERS: UserDesignation[] = ["Vice Captain"];
const GROUP_LEVEL_LEADERS: UserDesignation[] = ["Group Leader", "Asst.Grp Leader"];

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

export default function ViewResponsesPage() {
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

    useEffect(() => {
        const fetchCurrentUser = async () => {
            if (typeof window !== "undefined") {
                const userItsId = localStorage.getItem('userItsId');
                if (userItsId) {
                    try {
                        const user = await getUserByItsOrBgkId(userItsId);
                        setCurrentUser(user);
                    } catch (e) {
                         console.error("Could not fetch current user details", e);
                    }
                }
            }
        };
        fetchCurrentUser();
    }, []);

    useEffect(() => {
        if (!formId) return;

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

            } catch (err) {
                console.error("Error fetching initial details:", err);
                setError("Could not load form or user details.");
            }
        };

        fetchInitialData();

        const unsubscribeResponses = getFormResponsesRealtime(formId, (newResponses) => {
            setAllResponses(newResponses);
            setIsLoading(false);
        });

        return () => unsubscribeResponses();

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
        } catch (err) {
            console.error("Failed to delete response:", err);
            toast({ title: "Error", description: "Could not delete the response.", variant: "destructive" });
        }
    };
    
    const { eligibleUsers, nonRespondents, filteredResponses } = useMemo(() => {
        if (!form || allUsers.length === 0 || !currentUser) {
            return { eligibleUsers: [], nonRespondents: [], filteredResponses: [] };
        }

        let baseEligibleUsers: User[];
        const userMap = new Map(allUsers.map(user => [user.itsId, user]));

        // Determine the pool of users eligible for the form itself
        if (form.eligibleItsIds && form.eligibleItsIds.length > 0) {
            const eligibleIdSet = new Set(form.eligibleItsIds);
            baseEligibleUsers = allUsers.filter(user => eligibleIdSet.has(user.itsId));
        } else {
            const isForEveryone = !form.mohallahIds?.length && !form.teams?.length;
            baseEligibleUsers = allUsers.filter(user => {
                if (isForEveryone) return true;
                const inMohallah = form.mohallahIds?.includes(user.mohallahId || '');
                const inTeam = form.teams?.includes(user.team || '');
                return !!inMohallah || !!inTeam;
            });
        }

        let visibleEligibleUsers = baseEligibleUsers;
        let finalFilteredResponses = allResponses;

        // Now, filter what the *current user* is allowed to see from that eligible pool
        if (currentUser.role === 'admin' && currentUser.mohallahId) {
            // Admin sees only their Mohallah's data, this is the highest priority filter
            visibleEligibleUsers = baseEligibleUsers.filter(user => user.mohallahId === currentUser.mohallahId);
            finalFilteredResponses = allResponses.filter(res => {
                const submitter = userMap.get(res.submittedBy);
                return submitter?.mohallahId === currentUser.mohallahId;
            });
        } else if (currentUser.role !== 'superadmin' && currentUser.designation && TEAM_LEAD_DESIGNATIONS.includes(currentUser.designation)) {
             // For team leads who are not admins/superadmins
            if (TOP_LEVEL_LEADERS.includes(currentUser.designation)) {
                // Majors and Captains see everyone in the eligible list (no change)
            } else if (MID_LEVEL_LEADERS.includes(currentUser.designation) && currentUser.managedTeams) {
                // Vice Captains see their managed teams
                const managedTeamsSet = new Set(currentUser.managedTeams);
                visibleEligibleUsers = baseEligibleUsers.filter(user => user.team && managedTeamsSet.has(user.team));
                 finalFilteredResponses = allResponses.filter(res => {
                    const submitter = userMap.get(res.submittedBy);
                    return submitter?.team && managedTeamsSet.has(submitter.team);
                 });
            } else if (GROUP_LEVEL_LEADERS.includes(currentUser.designation) && currentUser.team) {
                // Group Leaders see their specific team
                visibleEligibleUsers = baseEligibleUsers.filter(user => user.team === currentUser.team);
                finalFilteredResponses = allResponses.filter(res => {
                    const submitter = userMap.get(res.submittedBy);
                    return submitter?.team === currentUser.team;
                 });
            }
        }
        // Superadmin sees everything, so no filter is applied to baseEligibleUsers or allResponses.

        const respondentIds = new Set(finalFilteredResponses.map(r => r.submittedBy));
        const nonResponding = visibleEligibleUsers.filter(user => !respondentIds.has(user.itsId));

        return { eligibleUsers: visibleEligibleUsers, nonRespondents: nonResponding, filteredResponses: finalFilteredResponses };

    }, [form, allUsers, allResponses, currentUser]);
    
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
             if (nonRespondents.length === 0) {
                toast({ title: "No data to export", description: "All eligible members have responded.", variant: "default" });
                return;
            }
            headers = ["Sr.No.", "Name", "ITS ID", "BGK ID", "Team", "Mohallah"];
            dataToExport = nonRespondents.map((user, index) => ({
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
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
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

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
            <Card>
                 <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex-1">
                        <CardTitle className="text-2xl md:text-3xl font-bold">{form?.title || "Form Responses"}</CardTitle>
                        <CardDescription>{form?.description || "Viewing all submitted responses."}</CardDescription>
                    </div>
                     <Button variant="outline" onClick={() => router.push('/dashboard/forms')} className="w-full sm:w-auto">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Forms
                    </Button>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-4 bg-muted/50">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Responses</CardTitle>
                        <p className="text-3xl font-bold">{filteredResponses.length}</p>
                    </Card>
                    <Card className="p-4 bg-muted/50">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Eligible Members</CardTitle>
                        <p className="text-3xl font-bold">{eligibleUsers.length}</p>
                    </Card>
                    <Card className="p-4 bg-muted/50">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Response Rate</CardTitle>
                        <p className="text-3xl font-bold">
                            {eligibleUsers.length > 0 ? ((filteredResponses.length / eligibleUsers.length) * 100).toFixed(1) : 0}%
                        </p>
                    </Card>
                </CardContent>
            </Card>
            
            <Tabs defaultValue="respondents">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="respondents">
                        <UserCheck className="mr-2 h-4 w-4"/>Respondents ({filteredResponses.length})
                    </TabsTrigger>
                    <TabsTrigger value="non-respondents" disabled={!canManageResponses}>
                        <UserX className="mr-2 h-4 w-4"/>Non-Respondents ({nonRespondents.length})
                    </TabsTrigger>
                </TabsList>
                
                <TabsContent value="respondents">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <h3 className="text-lg font-semibold">Submitted Responses</h3>
                            <Button onClick={() => handleExport('respondents')} disabled={filteredResponses.length === 0} size="sm" variant="outline">
                                <Download className="mr-2 h-4 w-4" /> Export Respondents
                            </Button>
                        </CardHeader>
                        <CardContent>
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
                                            <TableHead className="whitespace-nowrap">Submitter</TableHead>
                                            <TableHead className="whitespace-nowrap">Submitted At</TableHead>
                                            {form?.questions.map(q => (
                                                <TableHead key={q.id} className="whitespace-nowrap">{q.label}</TableHead>
                                            ))}
                                            {canManageResponses && <TableHead className="text-right whitespace-nowrap">Actions</TableHead>}
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
                        <CardHeader className="flex flex-row items-center justify-between">
                            <h3 className="text-lg font-semibold">Non-Respondents</h3>
                            <Button onClick={() => handleExport('non-respondents')} disabled={nonRespondents.length === 0} size="sm" variant="outline">
                                <Download className="mr-2 h-4 w-4" /> Export Non-Respondents
                            </Button>
                        </CardHeader>
                        <CardContent>
                             {nonRespondents.length === 0 ? (
                                <div className="text-center py-20 space-y-2 border-2 border-dashed rounded-lg">
                                     <Users className="h-12 w-12 text-muted-foreground mx-auto"/>
                                    <p className="text-lg font-medium text-muted-foreground">All relevant members have responded!</p>
                                </div>
                            ) : (
                                <>
                                 {/* Mobile View: Simple List */}
                                <div className="md:hidden space-y-2">
                                  {nonRespondents.map((user, index) => (
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
                                            <TableHead className="whitespace-nowrap">Name</TableHead>
                                            <TableHead className="whitespace-nowrap">ITS ID</TableHead>
                                            <TableHead className="whitespace-nowrap">BGK ID</TableHead>
                                            <TableHead className="whitespace-nowrap">Team</TableHead>
                                            <TableHead className="whitespace-nowrap">Mohallah</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {nonRespondents.map((user, index) => (
                                            <TableRow key={user.id}>
                                                <TableCell>{index + 1}</TableCell>
                                                <TableCell className="font-medium">{user.name}</TableCell>
                                                <TableCell>{user.itsId}</TableCell>
                                                <TableCell>{user.bgkId || 'N/A'}</TableCell>
                                                <TableCell>{user.team || 'N/A'}</TableCell>
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
            </Tabs>
        </div>
    );
}
