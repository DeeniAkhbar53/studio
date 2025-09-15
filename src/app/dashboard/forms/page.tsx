
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { PlusCircle, FileText, Loader2, Users, MoreHorizontal, Edit, Trash2, Calendar, Eye, CheckCircle, XCircle, Pencil, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { UserRole, Form as FormType, User } from "@/types";
import { getForms, deleteForm, updateFormStatus } from "@/lib/firebase/formService";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getUserByItsOrBgkId } from "@/lib/firebase/userService";

export default function FormsListPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [forms, setForms] = useState<FormType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true);
            try {
                const userItsId = localStorage.getItem('userItsId');
                if (userItsId) {
                    const user = await getUserByItsOrBgkId(userItsId);
                    setCurrentUser(user);
                }
                const fetchedForms = await getForms();
                setForms(fetchedForms);
            } catch (error) {
                console.error("Failed to fetch initial data:", error);
                toast({ title: "Error", description: "Could not load forms or user data.", variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toast]);
    
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


    const canCreateForms = currentUser?.role === 'admin' || currentUser?.role === 'superadmin' || currentUser?.pageRights?.includes('/dashboard/forms');
    const canManageForms = currentUser?.role === 'admin' || currentUser?.role === 'superadmin' || currentUser?.pageRights?.includes('/dashboard/forms');
    
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
    
    const isFormExpired = (form: FormType) => {
        return form.endDate && new Date() > new Date(form.endDate);
    };

    const filteredForms = useMemo(() => {
        if (!currentUser) return [];
        return forms.filter(form => {
            const isForEveryone = !form.mohallahIds?.length && !form.teams?.length && !form.eligibleItsIds?.length;
            if (isForEveryone) return true;
            
            const eligibleById = !!form.eligibleItsIds?.includes(currentUser.itsId);
            const eligibleByTeam = !!currentUser.team && !!form.teams?.includes(currentUser.team);
            const eligibleByMohallah = !!currentUser.mohallahId && !!form.mohallahIds?.includes(currentUser.mohallahId);

            return eligibleById || eligibleByTeam || eligibleByMohallah;
        });
    }, [forms, currentUser]);


    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center">
                            <FileText className="mr-2 h-5 w-5 text-primary"/>
                            Forms & Surveys
                        </CardTitle>
                        <CardDescription className="mt-1">
                            Fill out available forms{canCreateForms && " or create new ones if you have permission."}
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
                         <div className="flex justify-center items-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="ml-2 text-muted-foreground">Loading forms...</p>
                        </div>
                    ) : filteredForms.length === 0 ? (
                        <div className="text-center py-20 space-y-2 border-2 border-dashed rounded-lg">
                            <FileText className="h-12 w-12 text-muted-foreground mx-auto"/>
                            <p className="text-lg font-medium text-muted-foreground">No Forms Available</p>
                            <p className="text-sm text-muted-foreground">
                                {canCreateForms ? "Create a new form to get started." : "No relevant forms or surveys have been published for you yet."}
                            </p>
                        </div>
                    ) : (
                       <>
                         {/* Mobile View: Accordion */}
                         <div className="md:hidden">
                            <Accordion type="single" collapsible className="w-full">
                                {filteredForms.map((form) => {
                                    const expired = isFormExpired(form);
                                    const currentStatus = expired ? 'closed' : form.status;
                                    
                                    return (
                                        <AccordionItem value={form.id} key={form.id}>
                                            <AccordionTrigger>
                                                <div className="flex-grow text-left">
                                                    <p className="font-semibold text-card-foreground">{form.title}</p>
                                                    <Badge variant={currentStatus === 'open' ? 'default' : 'destructive'} className="mt-1 text-xs">
                                                        {currentStatus === 'open' ? <CheckCircle className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                                                        {expired ? "Expired" : (currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1))}
                                                    </Badge>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="space-y-4 pt-2">
                                                <div className="px-2 space-y-3 text-sm text-muted-foreground">
                                                    <p className="line-clamp-3">{form.description}</p>
                                                    {canManageForms && (
                                                        <div className="flex items-center gap-2">
                                                            <Users className="h-4 w-4" />
                                                            <span>{form.responseCount || 0} Responses</span>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="h-4 w-4" />
                                                        <span>Created: {format(new Date(form.createdAt), "MMM d, yyyy")}</span>
                                                    </div>
                                                    {form.endDate && (
                                                        <div className={cn("flex items-center gap-2", expired ? "text-destructive" : "")}>
                                                            <Clock className="h-4 w-4" />
                                                            <span>Ends: {format(new Date(form.endDate), "MMM d, yyyy")}</span>
                                                        </div>
                                                    )}
                                                    {canManageForms && form.updatedAt && (
                                                        <div className="flex items-center gap-2">
                                                            <Pencil className="h-4 w-4" />
                                                            <span>Updated: {format(new Date(form.updatedAt), "MMM d, yyyy")} by {form.updatedBy}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <Separator/>
                                                <div className="flex flex-wrap justify-end gap-2 px-2">
                                                    {canManageForms && (
                                                        <Button variant="secondary" size="sm" onClick={() => router.push(`/dashboard/forms/${form.id}/responses`)}>
                                                            <Eye className="mr-2 h-4 w-4" /> Responses
                                                        </Button>
                                                    )}
                                                    <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/forms/${form.id}`)} disabled={currentStatus === 'closed'}>
                                                        Fill Form
                                                    </Button>
                                                    {canManageForms && (
                                                        <div className="flex items-center">
                                                            <Switch 
                                                                checked={currentStatus === 'open'}
                                                                onCheckedChange={() => handleStatusToggle(form.id, form.status)}
                                                                aria-label={`Toggle form status for ${form.title}`}
                                                                className="mr-2"
                                                                disabled={expired}
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
                                                                        {(currentUser?.role === 'admin' || currentUser?.role === 'superadmin') && (
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
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    )
                                })}
                            </Accordion>
                         </div>

                         {/* Desktop View: Table */}
                         <div className="hidden md:block border rounded-lg overflow-hidden">
                           <Table>
                               <TableHeader>
                                   <TableRow>
                                       <TableHead>Title</TableHead>
                                       <TableHead>Status</TableHead>
                                       {canManageForms && <TableHead>Responses</TableHead>}
                                       <TableHead>Dates</TableHead>
                                       <TableHead className="text-right">Actions</TableHead>
                                   </TableRow>
                               </TableHeader>
                               <TableBody>
                                   {filteredForms.map((form) => {
                                        const expired = isFormExpired(form);
                                        const currentStatus = expired ? 'closed' : form.status;

                                        return (
                                       <TableRow key={form.id} className="hover:bg-muted/50">
                                           <TableCell className="font-medium">
                                                {form.title}
                                               <p className="text-sm text-muted-foreground line-clamp-1">{form.description}</p>
                                           </TableCell>
                                           <TableCell>
                                                <Badge variant={currentStatus === 'open' ? 'default' : 'destructive'}>
                                                     {expired ? "Expired" : (currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1))}
                                                </Badge>
                                           </TableCell>
                                           {canManageForms && (
                                               <TableCell className="text-center">
                                                    {form.responseCount || 0}
                                               </TableCell>
                                           )}
                                           <TableCell>
                                               <div className="text-xs">Created: {format(new Date(form.createdAt), "MMM d, yyyy")}</div>
                                                {form.endDate && <div className={cn("text-xs", expired ? "text-destructive" : "text-muted-foreground")}>Ends: {format(new Date(form.endDate), "MMM d, yyyy")}</div>}
                                           </TableCell>
                                           <TableCell className="text-right space-x-2">
                                                {canManageForms && (
                                                    <Button variant="secondary" size="sm" onClick={() => router.push(`/dashboard/forms/${form.id}/responses`)}>
                                                       <Eye className="mr-2 h-4 w-4" /> Responses
                                                    </Button>
                                                )}
                                               <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/forms/${form.id}`)} disabled={currentStatus === 'closed'}>
                                                    Fill
                                               </Button>
                                               {canManageForms && (
                                                <div className="inline-flex items-center gap-1">
                                                    <Switch
                                                        checked={currentStatus === 'open'}
                                                        onCheckedChange={() => handleStatusToggle(form.id, form.status)}
                                                        aria-label={`Toggle form status for ${form.title}`}
                                                        disabled={expired}
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
                                                                {(currentUser?.role === 'admin' || currentUser?.role === 'superadmin') && (
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
                                   )})}
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
