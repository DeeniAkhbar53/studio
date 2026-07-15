
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PlusCircle, FileText, Users, MoreHorizontal, Edit, Trash2, Calendar, Eye, CheckCircle2, XCircle, Clock, ChevronLeft, ChevronRight, TrendingUp, BarChart2, Layers, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UserRole, Form as FormType, User } from "@/types";
import { getForms, deleteForm, updateFormStatus } from "@/lib/firebase/formService";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { getUserByItsOrBgkId } from "@/lib/firebase/userService";
import { FunkyLoader } from "@/components/ui/funky-loader";
import { findNavItem } from "@/components/dashboard/sidebar-nav";
import { Progress } from "@/components/ui/progress";

const ITEMS_PER_PAGE = 12;

export default function FormsListPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [forms, setForms] = useState<FormType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const [currentPage, setCurrentPage] = useState(1);
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

    const handleCopyLink = (formId: string) => {
        const url = `${window.location.origin}/dashboard/forms/${formId}`;
        navigator.clipboard.writeText(url);
        toast({
            title: "Link Copied!",
            description: "Form URL has been copied to your clipboard.",
        });
    };

    useEffect(() => {
        const navItem = findNavItem('/dashboard/forms');
        if (navItem) {
            setIsAuthorized(true);
        } else {
            setIsAuthorized(false);
            setTimeout(() => router.replace('/dashboard'), 2000);
        }
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
            toast({ title: "Error", description: "Could not load forms.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const canCreateForms = useMemo(() => {
        if (!currentUser) return false;
        const hasRoleAccess = currentUser.role === 'admin' || currentUser.role === 'superadmin';
        const hasPageRight = currentUser.pageRights?.includes('/dashboard/forms');
        return hasRoleAccess || hasPageRight;
    }, [currentUser]);

    const canManageForms = canCreateForms;

    const shouldShowResponseCount = useMemo(() => {
        if (!currentUser) return true;
        const isStandardMember = currentUser.role === 'user' && 
            (currentUser.designation === 'Member' || currentUser.designation === 'J.Member');
        return !isStandardMember;
    }, [currentUser]);

    const handleDeleteForm = async (formId: string, formTitle: string) => {
        try {
            await deleteForm(formId);
            toast({ title: "Form Deleted", description: `"${formTitle}" has been deleted.`, variant: "destructive" });
            await fetchForms();
        } catch (error) {
            toast({ title: "Error", description: `Could not delete "${formTitle}".`, variant: "destructive" });
        }
    };

    const handleStatusToggle = async (formId: string, currentStatus: 'open' | 'closed') => {
        const newStatus = currentStatus === 'open' ? 'closed' : 'open';
        try {
            await updateFormStatus(formId, newStatus);
            setForms(forms.map(f => f.id === formId ? { ...f, status: newStatus } : f));
            toast({ title: "Status Updated", description: `Form is now ${newStatus}.` });
        } catch (error) {
            toast({ title: "Error", description: `Could not update form status.`, variant: "destructive" });
        }
    };

    const isFormExpired = (form: FormType) => !!(form.endDate && new Date() > new Date(form.endDate));

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

    const totalPages = Math.ceil(filteredForms.length / ITEMS_PER_PAGE);
    const currentFormsToDisplay = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredForms.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredForms, currentPage]);

    const handlePreviousPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
    const handleNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));

    // Stats
    const totalForms = filteredForms.length;
    const activeForms = filteredForms.filter(f => !isFormExpired(f) && f.status === 'open').length;
    const closedForms = filteredForms.filter(f => isFormExpired(f) || f.status === 'closed').length;
    const totalResponses = filteredForms.reduce((acc, f) => acc + (f.responseCount || 0), 0);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-[60vh]">
                <FunkyLoader>Loading forms...</FunkyLoader>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-up">
            {/* ── Page Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                            <FileText className="h-5 w-5 text-primary" />
                        </div>
                        Forms & Surveys
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {canCreateForms ? "Create, manage, and analyze your forms and surveys." : "Fill out available forms and surveys."}
                    </p>
                </div>
                {canCreateForms && (
                    <Button
                        onClick={() => router.push('/dashboard/forms/new')}
                        className="shrink-0 gap-2 shadow-sm shadow-primary/20"
                    >
                        <PlusCircle className="h-4 w-4" />
                        Create New Form
                    </Button>
                )}
            </div>

            {/* ── Stats Bar ── */}
            <div className={cn("grid grid-cols-2 gap-3", shouldShowResponseCount ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
                {[
                    { label: "Total Forms", value: totalForms, icon: Layers, color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20" },
                    { label: "Active", value: activeForms, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" },
                    { label: "Closed", value: closedForms, icon: XCircle, color: "text-rose-500", bg: "bg-rose-500/10 border-rose-500/20" },
                    { label: "Total Responses", value: totalResponses, icon: TrendingUp, color: "text-violet-500", bg: "bg-violet-500/10 border-violet-500/20" },
                ].filter(stat => shouldShowResponseCount || stat.label !== "Total Responses").map((stat) => (
                    <div key={stat.label} className="stat-card p-4 rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center border", stat.bg)}>
                                <stat.icon className={cn("h-4 w-4", stat.color)} />
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-foreground tabular-nums">{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* ── Content ── */}
            {filteredForms.length === 0 ? (
                <div className="glass-surface rounded-2xl border-dashed py-24 flex flex-col items-center justify-center gap-4 text-center">
                    <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <FileText className="h-8 w-8 text-primary/60" />
                    </div>
                    <div>
                        <p className="text-lg font-semibold text-foreground">No Forms Available</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            {canCreateForms ? "Create a new form to get started." : "No relevant forms have been published for you yet."}
                        </p>
                    </div>
                    {canCreateForms && (
                        <Button onClick={() => router.push('/dashboard/forms/new')} className="mt-2 gap-2">
                            <PlusCircle className="h-4 w-4" /> Create First Form
                        </Button>
                    )}
                </div>
            ) : (
                <>
                    {/* ── Form Card Grid ── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {currentFormsToDisplay.map((form, idx) => {
                            const expired = isFormExpired(form);
                            const currentStatus = expired ? 'closed' : form.status;
                            const isLive = currentStatus === 'open';
                            const responseRate = form.responseCount && form.responseCount > 0
                                ? Math.min(100, Math.round((form.responseCount / Math.max(form.responseCount, 1)) * 100))
                                : 0;

                            return (
                                <div
                                    key={form.id}
                                    className="form-card p-5 flex flex-col gap-4"
                                    style={{ animationDelay: `${idx * 50}ms` }}
                                >
                                    {/* Card Header */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                {/* Status indicator dot */}
                                                <span className={cn(
                                                    "premium-badge",
                                                    isLive ? "premium-badge-live" : expired ? "premium-badge-expired" : "premium-badge-closed"
                                                )}>
                                                    <span className={cn(
                                                        "h-1.5 w-1.5 rounded-full",
                                                        isLive ? "bg-emerald-500 animate-pulse" : expired ? "bg-rose-500" : "bg-muted-foreground"
                                                    )} />
                                                    {expired ? "Expired" : isLive ? "Live" : "Closed"}
                                                </span>
                                            </div>
                                            <h3 className="font-semibold text-foreground text-sm leading-snug line-clamp-2">
                                                {form.title}
                                            </h3>
                                            {form.description && (
                                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                    {form.description}
                                                </p>
                                            )}
                                        </div>

                                        {/* Three-dot menu */}
                                        {canManageForms && (
                                            <AlertDialog>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => handleCopyLink(form.id)}>
                                                            <Copy className="mr-2 h-4 w-4" /> Copy Link
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => router.push(`/dashboard/forms/edit/${form.id}`)}>
                                                            <Edit className="mr-2 h-4 w-4" /> Edit Form
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => router.push(`/dashboard/forms/${form.id}/responses`)}>
                                                            <BarChart2 className="mr-2 h-4 w-4" /> View Analytics
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
                                                        <AlertDialogTitle>Delete Form?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This will permanently delete <strong>&ldquo;{form.title}&rdquo;</strong> and all its responses. This action cannot be undone.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDeleteForm(form.id, form.title)}>
                                                            Delete
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        )}
                                    </div>

                                    {/* Response Rate */}
                                    {canManageForms && shouldShowResponseCount && (
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-muted-foreground flex items-center gap-1.5">
                                                    <Users className="h-3.5 w-3.5" />
                                                    {form.responseCount || 0} Responses
                                                </span>
                                            </div>
                                            <Progress value={responseRate} className="h-1.5" />
                                        </div>
                                    )}

                                    {/* Dates */}
                                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {format(new Date(form.createdAt), "MMM d, yyyy")}
                                        </div>
                                        {form.endDate && (
                                            <div className={cn("flex items-center gap-1", expired ? "text-rose-500" : "")}>
                                                <Clock className="h-3 w-3" />
                                                Ends {format(new Date(form.endDate), "MMM d, yyyy")}
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center justify-between pt-1 border-t border-border/40">
                                        <div className="flex items-center gap-2">
                                            {canManageForms && (
                                                <>
                                                    <Switch
                                                        checked={isLive}
                                                        onCheckedChange={() => handleStatusToggle(form.id, form.status)}
                                                        aria-label={`Toggle status for ${form.title}`}
                                                        disabled={expired}
                                                        className="scale-90"
                                                    />
                                                    <span className="text-[11px] text-muted-foreground">{isLive ? "Open" : "Closed"}</span>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {canManageForms && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => router.push(`/dashboard/forms/${form.id}/responses`)}
                                                    className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-primary"
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                    Analytics
                                                </Button>
                                            )}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleCopyLink(form.id)}
                                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                                title="Copy Form URL"
                                            >
                                                <Copy className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant={isLive ? "default" : "outline"}
                                                onClick={() => router.push(`/dashboard/forms/${form.id}`)}
                                                disabled={!isLive}
                                                className="h-8 text-xs font-semibold"
                                            >
                                                Fill Form
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* ── Pagination ── */}
                    {totalPages > 1 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                            <p className="text-xs text-muted-foreground">
                                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredForms.length)} of {filteredForms.length} forms
                            </p>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={currentPage === 1} className="gap-1.5">
                                    <ChevronLeft className="h-4 w-4" /> Previous
                                </Button>
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                        <button
                                            key={page}
                                            onClick={() => setCurrentPage(page)}
                                            className={cn(
                                                "h-8 w-8 rounded-md text-sm font-medium transition-all",
                                                page === currentPage
                                                    ? "bg-primary text-primary-foreground shadow-sm"
                                                    : "text-muted-foreground hover:bg-muted"
                                            )}
                                        >
                                            {page}
                                        </button>
                                    ))}
                                </div>
                                <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages} className="gap-1.5">
                                    Next <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
