
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, FileText, Loader2, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { UserRole, Form as FormType } from "@/types";
import { allNavItems } from "@/components/dashboard/sidebar-nav";

// Placeholder data - in the future this would come from Firestore
const MOCK_FORMS: FormType[] = [
    { id: "1", title: "Annual Event Feedback", description: "Share your feedback on this year's annual event.", createdBy: "10101010", createdAt: new Date().toISOString(), questions: [] },
    { id: "2", title: "Volunteer Signup 2024", description: "Sign up to volunteer for upcoming community services.", createdBy: "10101010", createdAt: new Date().toISOString(), questions: [] },
];

export default function FormsPage() {
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
    const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
    const [forms, setForms] = useState<FormType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const role = typeof window !== "undefined" ? localStorage.getItem('userRole') as UserRole : null;
        setCurrentUserRole(role);
        // This page is accessible to all, so no complex authorization check needed for viewing
        setIsAuthorized(true);
    }, []);

    useEffect(() => {
        // Simulate fetching forms from a database
        setIsLoading(true);
        setTimeout(() => {
            setForms(MOCK_FORMS);
            setIsLoading(false);
        }, 1000);
    }, []);

    const canCreateForms = currentUserRole === 'admin' || currentUserRole === 'superadmin';

    if (isAuthorized === null) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    // Although we set it to true, this is good practice in case logic changes
    if (isAuthorized === false) {
        return (
           <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
            <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
            <p className="text-muted-foreground mt-2">
              You do not have the required permissions to view this page.
            </p>
            <p className="text-sm text-muted-foreground mt-1">Redirecting to dashboard...</p>
          </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between">
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
                        <Button onClick={() => toast({ title: "Coming Soon!", description: "The form builder will be implemented in a future update." })} size="sm">
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
                        <p className="text-center text-muted-foreground py-10">No forms or surveys are available at this time.</p>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {forms.map((form) => (
                                <Card key={form.id} className="hover:shadow-md transition-shadow">
                                    <CardHeader>
                                        <CardTitle className="text-lg">{form.title}</CardTitle>
                                        <CardDescription>{form.description}</CardDescription>
                                    </CardHeader>
                                    <CardFooter>
                                        <Button className="w-full" onClick={() => toast({ title: "Coming Soon!", description: "The ability to fill out forms will be added next."})}>
                                            Fill Out Form
                                        </Button>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
