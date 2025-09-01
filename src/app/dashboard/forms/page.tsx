
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PlusCircle, FileText, Loader2, Users, MoreHorizontal, Edit, Trash2, Calendar, User as UserIcon, Eye, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { UserRole, Form as FormType } from "@/types";
import { getForms, deleteForm, updateFormStatus } from "@/lib/firebase/formService";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";

export default function FormsListPage() {
    const router = useRouter();
    const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
    const [forms, setForms] = useState<FormType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const fetchForms = async () => {
        setIsLoading(true);
        try {
            const fetchedForms = await getForms();
            setForms(fetchedForms);
        } catch (error) {
            console.error("Failed to fetch forms:", error);
            toast({ title: "Error", description: "Could not load forms.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const role = typeof window !== "undefined" ? localStorage.getItem('userRole') as UserRole : null;
        setCurrentUserRole(role);
        fetchForms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toast]);

    const canCreateForms = currentUserRole === 'admin' || currentUserRole === 'superadmin' || currentUserRole === 'attendance-marker';
    const canManageForms = currentUserRole === 'admin' || currentUserRole === 'superadmin' || currentUserRole === 'attendance-marker';
    
    const handleDeleteForm = async (formId: string, formTitle: string) => {
        try {
            await deleteForm(formId);
            toast({
                title: "Form Deleted",
                description: `The form "${formTitle}" has been successfully deleted.`,
                variant: "destructive"
            });
            await fetchForms(); // Refetch forms
        } catch (error) {
            console.error("Failed to delete form:", error);
            toast({ title: "Error", description: `Could not delete form "${formTitle}".`, variant: "destructive" });
        }
    };
    
    const handleStatusToggle = async (formId: string, currentStatus: 'open' | 'closed') => {
        const newStatus = currentStatus === 'open' ? 'closed' : 'open';
        try {
            await updateFormStatus(formId, newStatus);
            setForms(forms.map(f => f.id === formId ? { ...f, status: newStatus } : f));
            toast({
                title: "Status Updated",
                description: `Form is now ${newStatus}.`,
            });
        } catch (error) {
            console.error("Failed to update form status:", error);
            toast({ title: "Error", description: `Could not update the form's status.`, variant: "destructive" });
        }
    };


    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center">
                            <FileText className="mr-2 h-5 w-5 text-primary"/>
                            Forms & Surveys
                        </CardTitle>
                        <CardDescription className="mt-1">
                            Fill out available forms or create new ones if you have permission.
                        </CardDescription>
                    </div>
                    {canCreateForms && (
                        <Button size="sm" onClick={() => router.push('/dashboard/forms/new')} className="w-full md:w-auto mt-2 md:mt-0">
                            <PlusCircle className="mr-2 h-4 w-4" /> Create New Form
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                         <div className="flex justify-center items-center py-10">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="ml-2 text-muted-foreground">Loading forms...</p>
                        </div>
                    ) : forms.length === 0 ? (
                        <div className="text-center py-10 space-y-2">
                            <FileText className="h-12 w-12 text-muted-foreground mx-auto"/>
                            <p className="text-lg font-medium text-muted-foreground">No Forms Available</p>
                            <p className="text-sm text-muted-foreground">
                                {canCreateForms ? "Create a new form to get started." : "No forms or surveys have been published yet."}
                            </p>
                        </div>
                    ) : (
                       <>
                         {/* Mobile View: Cards */}
                         <div className="md:hidden space-y-4">
                            {forms.map((form) => (
                                <Card key={form.id} className="w-full shadow-md">
                                    <CardHeader>
                                        <div className="flex justify-between items-start">
                                            <CardTitle className="text-lg pr-4">
                                                {form.title}
                                            </CardTitle>
                                             <Badge variant={form.status === 'open' ? 'default' : 'destructive'} className="shrink-0">
                                                 {form.status === 'open' ? <CheckCircle className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                                                {form.status.charAt(0).toUpperCase() + form.status.slice(1)}
                                            </Badge>
                                        </div>
                                        <CardDescription className="line-clamp-2 pt-1">{form.description}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-3 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                            <Users className="h-4 w-4" />
                                            <span>{form.responseCount || 0} Responses</span>
                                        </div>
                                         <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4" />
                                            <span>Created: {format(new Date(form.createdAt), "MMM d, yyyy")}</span>
                                        </div>
                                         <div className="flex items-center gap-2">
                                            <UserIcon className="h-4 w-4" />
                                            <span>By: {form.createdBy}</span>
                                        </div>
                                    </CardContent>
                                    <Separator />
                                    <CardFooter className="flex flex-wrap justify-end gap-2 p-2">
                                         {canManageForms && (
                                            <Button variant="secondary" size="sm" onClick={() => router.push(`/dashboard/forms/${form.id}/responses`)}>
                                                <Eye className="mr-2 h-4 w-4" /> Responses
                                            </Button>
                                         )}
                                         <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/forms/${form.id}`)} disabled={form.status === 'closed'}>
                                            Fill Out
                                        </Button>
                                        {canManageForms && (
                                            <div className="flex items-center">
                                                <Switch 
                                                    checked={form.status === 'open'}
                                                    onCheckedChange={() => handleStatusToggle(form.id, form.status)}
                                                    aria-label={`Toggle form status for ${form.title}`}
                                                    className="mr-2"
                                                />
                                                 <AlertDialog>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                             <DropdownMenuItem onClick={() => router.push(`/dashboard/forms/edit/${form.id}`)}>
                                                                <Edit className="mr-2 h-4 w-4" /> Edit
                                                            </DropdownMenuItem>
                                                             {(currentUserRole === 'admin' || currentUserRole === 'superadmin') && (
                                                                <AlertDialogTrigger asChild>
                                                                    <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                                    </DropdownMenuItem>
                                                                </AlertDialogTrigger>
                                                             )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete "{form.title}" and all its responses.</AlertDialogDescription></AlertDialogHeader>
                                                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDeleteForm(form.id, form.title)}>Delete</AlertDialogAction></AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        )}
                                    </CardFooter>
                                </Card>
                            ))}
                         </div>
                         {/* Desktop View: Table */}
                         <div className="hidden md:block border rounded-md">
                           <Table>
                               <TableHeader>
                                   <TableRow>
                                       <TableHead>Title</TableHead>
                                       <TableHead>Status</TableHead>
                                       <TableHead>Responses</TableHead>
                                       <TableHead>Created</TableHead>
                                       <TableHead className="text-right">Actions</TableHead>
                                   </TableRow>
                               </TableHeader>
                               <TableBody>
                                   {forms.map((form) => (
                                       <TableRow key={form.id} className="hover:bg-muted/50">
                                           <TableCell className="font-medium">
                                                {form.title}
                                               <p className="text-sm text-muted-foreground line-clamp-1">{form.description}</p>
                                           </TableCell>
                                           <TableCell>
                                                <Badge variant={form.status === 'open' ? 'default' : 'destructive'}>
                                                    {form.status.charAt(0).toUpperCase() + form.status.slice(1)}
                                                </Badge>
                                           </TableCell>
                                           <TableCell>
                                                {canManageForms ? (
                                                    <Button variant="link" className="p-0 h-auto" onClick={() => router.push(`/dashboard/forms/${form.id}/responses`)}>
                                                        <div className="flex items-center gap-2">
                                                            <Users className="h-4 w-4 text-muted-foreground" />
                                                            {form.responseCount || 0}
                                                        </div>
                                                    </Button>
                                                ) : (
                                                     <div className="flex items-center gap-2">
                                                        <Users className="h-4 w-4 text-muted-foreground" />
                                                        {form.responseCount || 0}
                                                    </div>
                                                )}
                                           </TableCell>
                                           <TableCell>
                                               {format(new Date(form.createdAt), "MMM d, yyyy")}
                                               <p className="text-xs text-muted-foreground">by {form.createdBy}</p>
                                           </TableCell>
                                           <TableCell className="text-right space-x-2">
                                                {canManageForms && (
                                                    <Button variant="secondary" size="sm" onClick={() => router.push(`/dashboard/forms/${form.id}/responses`)}>
                                                       <Eye className="mr-2 h-4 w-4" /> Responses
                                                    </Button>
                                                )}
                                               <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/forms/${form.id}`)} disabled={form.status === 'closed'}>
                                                    Fill Out
                                               </Button>
                                               {canManageForms && (
                                                <div className="inline-flex items-center gap-1">
                                                    <Switch
                                                        checked={form.status === 'open'}
                                                        onCheckedChange={() => handleStatusToggle(form.id, form.status)}
                                                        aria-label={`Toggle form status for ${form.title}`}
                                                    />
                                                    <AlertDialog>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                    <span className="sr-only">More actions</span>
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={() => router.push(`/dashboard/forms/edit/${form.id}`)}>
                                                                    <Edit className="mr-2 h-4 w-4" /> Edit
                                                                </DropdownMenuItem>
                                                                {(currentUserRole === 'admin' || currentUserRole === 'superadmin') && (
                                                                    <AlertDialogTrigger asChild>
                                                                        <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                                        </DropdownMenuItem>
                                                                    </AlertDialogTrigger>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    This action cannot be undone. This will permanently delete the form
                                                                    <span className="font-semibold"> "{form.title}" </span> 
                                                                    and all of its responses.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction 
                                                                    className="bg-destructive hover:bg-destructive/90"
                                                                    onClick={() => handleDeleteForm(form.id, form.title)}
                                                                >
                                                                    Continue
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                               )}
                                           </TableCell>
                                       </TableRow>
                                   ))}
                               </TableBody>
                           </Table>
                       </div>
                       </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
