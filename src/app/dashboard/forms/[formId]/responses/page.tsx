
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, ArrowLeft, Trash2, Users, FileWarning, Calendar, User as UserIcon } from "lucide-react";
import type { FormResponse, UserRole, Form as FormType } from "@/types";
import { getFormResponsesRealtime, deleteFormResponse, getForm } from "@/lib/firebase/formService";
import { format } from "date-fns";
import { Unsubscribe } from "firebase/firestore";
import { Separator } from "@/components/ui/separator";

export default function ViewResponsesPage() {
    const router = useRouter();
    const params = useParams();
    const formId = params.formId as string;
    const { toast } = useToast();

    const [form, setForm] = useState<FormType | null>(null);
    const [responses, setResponses] = useState<FormResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
    const [isLoadingForm, setIsLoadingForm] = useState(true);
    
    useEffect(() => {
        const role = typeof window !== "undefined" ? localStorage.getItem('userRole') as UserRole : null;
        setCurrentUserRole(role);
    }, []);

    useEffect(() => {
        if (!formId) return;

        const fetchInitialForm = async () => {
            setIsLoadingForm(true);
            try {
                const fetchedForm = await getForm(formId);
                if (fetchedForm) {
                    setForm(fetchedForm);
                } else {
                    setError("Form not found.");
                }
            } catch (err) {
                console.error("Error fetching form details:", err);
                setError("Could not load form details.");
            } finally {
                setIsLoadingForm(false);
            }
        };

        fetchInitialForm();

        setIsLoading(true);
        const unsubscribe = getFormResponsesRealtime(formId, (newResponses) => {
            setResponses(newResponses);
            setIsLoading(false);
        });

        // Cleanup subscription on component unmount
        return () => unsubscribe();

    }, [formId]);

    const canDeleteResponses = currentUserRole === 'admin' || currentUserRole === 'superadmin';

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
    
    const renderResponseValue = (questionId: string, value: string | string[]) => {
        const question = form?.questions.find(q => q.id === questionId);
        if (question?.type === 'checkbox' && Array.isArray(value)) {
            return value.join(', ');
        }
        return value as string;
    };

    if (isLoading || isLoadingForm) {
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
             <Button variant="outline" onClick={() => router.push('/dashboard/forms')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Forms
            </Button>
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="text-2xl md:text-3xl font-bold">{form?.title || "Form Responses"}</CardTitle>
                    <CardDescription>{form?.description || "Viewing all submitted responses."}</CardDescription>
                </CardHeader>
                <CardContent>
                    {responses.length === 0 ? (
                        <div className="text-center py-10 space-y-2">
                             <Users className="h-12 w-12 text-muted-foreground mx-auto"/>
                            <p className="text-lg font-medium text-muted-foreground">No Responses Yet</p>
                            <p className="text-sm text-muted-foreground">
                                This form has not received any submissions.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Submitter</TableHead>
                                        <TableHead>Submitted At</TableHead>
                                        {form?.questions.map(q => (
                                            <TableHead key={q.id}>{q.label}</TableHead>
                                        ))}
                                        {canDeleteResponses && <TableHead className="text-right">Actions</TableHead>}
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
                                                    {renderResponseValue(q.id, response.responses[q.id]) || <span className="text-muted-foreground/60">N/A</span>}
                                                </TableCell>
                                            ))}
                                            {canDeleteResponses && (
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
                <CardFooter>
                    <p className="text-sm text-muted-foreground">
                        Total Responses: {responses.length}
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}
