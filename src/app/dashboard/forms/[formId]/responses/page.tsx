
"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, Trash2, Users, FileWarning, Download, UserCheck, UserX } from "lucide-react";
import type { FormResponse, UserRole, UserDesignation, User, Form as FormType } from "@/types";
import { getFormResponsesRealtime, deleteFormResponse, getForm } from "@/lib/firebase/formService";
import { getUsers } from "@/lib/firebase/userService";
import { format } from "date-fns";
import { Unsubscribe } from "firebase/firestore";
import Papa from "papaparse";

const TEAM_LEAD_DESIGNATIONS: UserDesignation[] = ["Captain", "Vice Captain", "Group Leader", "Asst.Grp Leader"];

export default function ViewResponsesPage() {
    const router = useRouter();
    const params = useParams();
    const formId = params.formId as string;
    const { toast } = useToast();

    const [form, setForm] = useState<FormType | null>(null);
    const [responses, setResponses] = useState<FormResponse[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
    const [currentUserDesignation, setCurrentUserDesignation] = useState<UserDesignation | null>(null);
    
    useEffect(() => {
        const role = typeof window !== "undefined" ? localStorage.getItem('userRole') as UserRole : null;
        const designation = typeof window !== "undefined" ? localStorage.getItem('userDesignation') as UserDesignation : null;
        setCurrentUserRole(role);
        setCurrentUserDesignation(designation);
    }, []);

    useEffect(() => {
        if (!formId) return;

        const fetchInitialData = async () => {
            setIsLoading(true);
            try {
                const [fetchedForm, fetchedUsers] = await Promise.all([
                    getForm(formId),
                    getUsers(),
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
            setResponses(newResponses);
            setIsLoading(false);
        });

        return () => unsubscribeResponses();

    }, [formId]);

    const canManageResponses = useMemo(() => {
        if (!currentUserRole || !currentUserDesignation) return false;
        if (currentUserRole === 'superadmin') return true;
        return TEAM_LEAD_DESIGNATIONS.includes(currentUserDesignation);
    }, [currentUserRole, currentUserDesignation]);


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
    
    const { eligibleUsers, nonRespondents } = useMemo(() => {
        if (!form || allUsers.length === 0) {
            return { eligibleUsers: [], nonRespondents: [] };
        }

        const isForEveryone = !form.mohallahIds?.length && !form.teams?.length && !form.eligibleItsIds?.length;

        let eligible: User[];

        if (form.eligibleItsIds && form.eligibleItsIds.length > 0) {
            const eligibleIdSet = new Set(form.eligibleItsIds);
            eligible = allUsers.filter(user => eligibleIdSet.has(user.itsId));
        } else {
            eligible = allUsers.filter(user => {
                if (isForEveryone) return true;
                
                let matchesAllCriteria = true;
                
                if (form.mohallahIds && form.mohallahIds.length > 0) {
                    matchesAllCriteria = matchesAllCriteria && !!user.mohallahId && form.mohallahIds.includes(user.mohallahId);
                }
                
                if (form.teams && form.teams.length > 0) {
                    matchesAllCriteria = matchesAllCriteria && !!user.team && form.teams.includes(user.team);
                }
                
                return matchesAllCriteria && !isForEveryone;
            });
        }

        const respondentIds = new Set(responses.map(r => r.submittedBy));
        const nonResponding = eligible.filter(user => !respondentIds.has(user.itsId));

        return { eligibleUsers: eligible, nonRespondents: nonResponding };

    }, [form, allUsers, responses]);
    

    const renderResponseValue = (questionId: string, value: any) => {
        const question = form?.questions.find(q => q.id === questionId);
        if (question?.type === 'checkbox' && Array.isArray(value)) {
            return value.join(', ');
        }
        if (typeof value === 'string') {
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
            if (responses.length === 0) {
                toast({ title: "No data to export", description: "No responses have been submitted yet.", variant: "default" });
                return;
            }
            headers = ["Submitted At", "ITS ID", "Name", "BGK ID", ...form.questions.map(q => q.label)];
            dataToExport = responses.map(response => {
                const row: { [key: string]: any } = {
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
            headers = ["Name", "ITS ID", "BGK ID", "Team", "Mohallah ID"];
            dataToExport = nonRespondents.map(user => ({
                "Name": user.name,
                "ITS ID": user.itsId,
                "BGK ID": user.bgkId || 'N/A',
                "Team": user.team || 'N/A',
                "Mohallah ID": user.mohallahId || 'N/A',
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

    if (isLoading) {
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
                        <p className="text-3xl font-bold">{responses.length}</p>
                    </Card>
                    <Card className="p-4 bg-muted/50">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Eligible Members</CardTitle>
                        <p className="text-3xl font-bold">{eligibleUsers.length}</p>
                    </Card>
                    <Card className="p-4 bg-muted/50">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Response Rate</CardTitle>
                        <p className="text-3xl font-bold">
                            {eligibleUsers.length > 0 ? ((responses.length / eligibleUsers.length) * 100).toFixed(1) : 0}%
                        </p>
                    </Card>
                </CardContent>
            </Card>
            
            <Tabs defaultValue="respondents">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="respondents">
                        <UserCheck className="mr-2 h-4 w-4"/>Respondents ({responses.length})
                    </TabsTrigger>
                    <TabsTrigger value="non-respondents" disabled={!canManageResponses}>
                        <UserX className="mr-2 h-4 w-4"/>Non-Respondents ({nonRespondents.length})
                    </TabsTrigger>
                </TabsList>
                
                <TabsContent value="respondents">
                    <Card>
                        <CardHeader>
                            <CardTitle>Submitted Responses</CardTitle>
                            <div className="flex justify-end">
                                <Button onClick={() => handleExport('respondents')} disabled={responses.length === 0} size="sm">
                                    <Download className="mr-2 h-4 w-4" /> Export Respondents
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                             {responses.length === 0 ? (
                                <div className="text-center py-20 space-y-2 border-2 border-dashed rounded-lg">
                                     <Users className="h-12 w-12 text-muted-foreground mx-auto"/>
                                    <p className="text-lg font-medium text-muted-foreground">No Responses Yet</p>
                                    <p className="text-sm text-muted-foreground">
                                        This form has not received any submissions.
                                    </p>
                                </div>
                            ) : (
                                <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Submitter</TableHead>
                                            <TableHead>Submitted At</TableHead>
                                            {form?.questions.map(q => (
                                                <TableHead key={q.id}>{q.label}</TableHead>
                                            ))}
                                            {canManageResponses && <TableHead className="text-right">Actions</TableHead>}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {responses.map(response => (
                                            <TableRow key={response.id}>
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
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
                
                <TabsContent value="non-respondents">
                    <Card>
                        <CardHeader>
                            <CardTitle>Non-Respondents</CardTitle>
                             <div className="flex justify-end">
                                <Button onClick={() => handleExport('non-respondents')} disabled={nonRespondents.length === 0} size="sm">
                                    <Download className="mr-2 h-4 w-4" /> Export Non-Respondents
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                             {nonRespondents.length === 0 ? (
                                <div className="text-center py-20 space-y-2 border-2 border-dashed rounded-lg">
                                     <Users className="h-12 w-12 text-muted-foreground mx-auto"/>
                                    <p className="text-lg font-medium text-muted-foreground">All members have responded!</p>
                                </div>
                            ) : (
                                <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>ITS ID</TableHead>
                                            <TableHead>BGK ID</TableHead>
                                            <TableHead>Team</TableHead>
                                            <TableHead>Mohallah</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {nonRespondents.map(user => (
                                            <TableRow key={user.id}>
                                                <TableCell className="font-medium">{user.name}</TableCell>
                                                <TableCell>{user.itsId}</TableCell>
                                                <TableCell>{user.bgkId || 'N/A'}</TableCell>
                                                <TableCell>{user.team || 'N/A'}</TableCell>
                                                <TableCell>{allUsers.find(u => u.id === user.id)?.mohallahId || 'N/A'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
