"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FunkyLoader } from "@/components/ui/funky-loader";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Lock, Video, BookOpen, PlusCircle, MinusCircle, Eye } from "lucide-react";
import { db } from "@/lib/firebase/firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { UserRole, UserDesignation } from "@/types";
import { useRouter } from "next/navigation";


const duaFormSchema = z.object({
  duaKamilCount: z.preprocess(
    (val) => Number(String(val)),
    z.number().min(0, "Count must be positive.").max(7, "Count cannot exceed 7.")
  ),
  kahfCount: z.preprocess(
    (val) => Number(String(val)),
    z.number().min(0, "Count must be positive.")
  ),
  feedback: z.string().optional(),
});

type DuaFormValues = z.infer<typeof duaFormSchema>;

// Helper function to get the current week's identifier (e.g., "2024-W35")
const getWeekId = (date: Date) => {
    const year = date.getFullYear();
    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
};

const CounterInput = ({ field, label, description, max }: { field: any, label: string, description: string, max?: number }) => {
    const currentValue = Number(field.value) || 0;
    return (
        <FormItem>
            <FormLabel>{label}</FormLabel>
            <div className="flex items-center gap-3">
                <Button type="button" variant="outline" size="icon" onClick={() => field.onChange(Math.max(0, currentValue - 1))}>
                    <MinusCircle className="h-4 w-4"/>
                </Button>
                <FormControl>
                    <Input {...field} type="number" className="w-20 text-center" />
                </FormControl>
                 <Button type="button" variant="outline" size="icon" onClick={() => field.onChange(max ? Math.min(max, currentValue + 1) : currentValue + 1)}>
                    <PlusCircle className="h-4 w-4"/>
                </Button>
            </div>
             <FormDescription>{description}</FormDescription>
            <FormMessage />
        </FormItem>
    )
}

const TEAM_LEAD_DESIGNATIONS: UserDesignation[] = ["Captain", "Vice Captain", "Group Leader", "Asst.Grp Leader", "Major"];

export default function DuaPage() {
    const router = useRouter();
    const [isAccessible, setIsAccessible] = useState(true); // Changed for testing
    const [isLoading, setIsLoading] = useState(true);
    const [attendanceMarked, setAttendanceMarked] = useState(false);
    const { toast } = useToast();
    const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
    const [currentUserDesignation, setCurrentUserDesignation] = useState<UserDesignation | null>(null);


     const form = useForm<DuaFormValues>({
        resolver: zodResolver(duaFormSchema),
        defaultValues: {
            duaKamilCount: 1,
            kahfCount: 1,
            feedback: "",
        },
    });

    useEffect(() => {
        if(typeof window !== "undefined") {
            setCurrentUserRole(localStorage.getItem('userRole') as UserRole);
            setCurrentUserDesignation(localStorage.getItem('userDesignation') as UserDesignation);
        }
    }, []);
    
    useEffect(() => {
        // FOR TESTING: Page is always accessible.
        // To re-enable time lock, uncomment the following block and set isAccessible initial state to false.
        /*
        const checkAccessTime = () => {
            const now = new Date();
            const day = now.getDay(); // Sunday = 0, Thursday = 4, Friday = 5
            const hour = now.getHours();

            // Thursday 5 PM (17:00) to Friday 10 PM (22:00)
            const isThursdayWindow = (day === 4 && hour >= 17);
            const isFridayWindow = (day === 5 && hour < 22);

            if (isThursdayWindow || isFridayWindow) {
                setIsAccessible(true);
            } else {
                setIsAccessible(false);
            }
            setIsLoading(false);
        };

        checkAccessTime();
        // Check every minute
        const interval = setInterval(checkAccessTime, 60000);

        return () => clearInterval(interval);
        */
       setIsLoading(false); // Since we removed the check, just stop loading.
    }, []);

    useEffect(() => {
        if (!isAccessible) return;

        const checkExistingAttendance = async () => {
            const userItsId = localStorage.getItem('userItsId');
            if (!userItsId) return;

            const weekId = getWeekId(new Date());
            const attendanceDocRef = doc(db, 'users', userItsId, 'duaAttendance', weekId);
            const docSnap = await getDoc(attendanceDocRef);

            if (docSnap.exists()) {
                setAttendanceMarked(true);
                const data = docSnap.data();
                form.reset({
                    duaKamilCount: data.duaKamilCount,
                    kahfCount: data.kahfCount,
                    feedback: data.feedback,
                });
            }
        };

        checkExistingAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAccessible]);

    const handleMarkAttendance = async (values: DuaFormValues) => {
        const userItsId = localStorage.getItem('userItsId');
        const userName = localStorage.getItem('userName') || 'Unknown';
        const userBgkId = localStorage.getItem('userBgkId') || 'N/A';

        if (!userItsId) {
            toast({
                title: "Error",
                description: "Could not identify user. Please log in again.",
                variant: "destructive",
            });
            return;
        }

        const weekId = getWeekId(new Date());
        const attendanceDocRef = doc(db, 'users', userItsId, 'duaAttendance', weekId);

        try {
            await setDoc(attendanceDocRef, {
                itsId: userItsId,
                name: userName,
                bgkId: userBgkId,
                weekId: weekId,
                ...values,
                markedAt: serverTimestamp(),
            }, { merge: true }); // Merge to update existing record
            setAttendanceMarked(true);
            toast({
                title: "Submission Recorded",
                description: "Your recitation counts for this week have been saved.",
                className: 'border-green-500 bg-green-50 dark:bg-green-900/30',
            });
        } catch (error) {
            toast({
                title: "Submission Error",
                description: "Could not save your submission. Please try again.",
                variant: "destructive",
            });
        }
    };
    
    const canViewResponses = useMemo(() => {
        if (!currentUserRole) return false;
        if (currentUserRole === 'superadmin' || currentUserRole === 'admin') return true;
        if (currentUserDesignation && TEAM_LEAD_DESIGNATIONS.includes(currentUserDesignation)) return true;
        return false;
    }, [currentUserRole, currentUserDesignation]);


    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <FunkyLoader size="lg">Loading page...</FunkyLoader>
            </div>
        );
    }

    if (!isAccessible) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
                <Card className="w-full max-w-lg p-8 shadow-lg">
                    <Lock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-foreground">Dua Page is Closed</h1>
                    <p className="text-muted-foreground mt-2">
                        This page is only available from Thursday 5:00 PM to Friday 10:00 PM every week.
                    </p>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                             <CardTitle className="flex items-center text-3xl">
                                <Video className="mr-3 h-8 w-8 text-primary" />
                                Dua Recitation
                            </CardTitle>
                            <CardDescription className="pt-1">
                                Please watch the video and log your recitation counts below.
                            </CardDescription>
                        </div>
                        {canViewResponses && (
                             <Button variant="outline" onClick={() => router.push('/dashboard/dua/responses')}>
                                <Eye className="mr-2 h-4 w-4" /> View Submissions
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
                        <video
                            controls
                            src="https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4" // Placeholder video
                            className="w-full h-full"
                        >
                            Your browser does not support the video tag.
                        </video>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-lg">
                 <CardHeader>
                    <CardTitle className="flex items-center text-2xl">
                        <BookOpen className="mr-3 h-7 w-7 text-primary" />
                        Recitation Log
                    </CardTitle>
                    <CardDescription className="pt-1">
                        Enter your counts for the week. You can update this form anytime during the week.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {attendanceMarked ? (
                        <div className="flex flex-col items-center gap-3 text-green-600 border p-6 rounded-lg bg-green-50 dark:bg-green-950">
                            <CheckCircle className="h-12 w-12" />
                            <p className="font-semibold text-lg">Your submission for this week has been recorded.</p>
                            <p className="text-sm">You can still update the counts below if needed.</p>
                        </div>
                    ) : null}

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleMarkAttendance)} className="space-y-8 mt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <FormField
                                    control={form.control}
                                    name="duaKamilCount"
                                    render={({ field }) => (
                                        <CounterInput
                                            field={field}
                                            label="Dua e Kamil"
                                            description="Enter Tilawat Count (daily 1 for 7 days)"
                                            max={7}
                                        />
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="kahfCount"
                                    render={({ field }) => (
                                       <CounterInput
                                            field={field}
                                            label="Surat al Kahf"
                                            description="Enter Tilawat Count (minimum 1 - every friday)"
                                        />
                                    )}
                                />
                            </div>

                             <FormField
                                control={form.control}
                                name="feedback"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Query / Feedback</FormLabel>
                                    <FormControl>
                                    <Textarea
                                        placeholder="If you have any questions or feedback, please enter it here."
                                        className="resize-y"
                                        {...field}
                                    />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />

                             <div className="flex justify-end pt-4">
                                <Button
                                    type="submit"
                                    size="lg"
                                    disabled={form.formState.isSubmitting}
                                    className="min-w-[200px]"
                                >
                                    {form.formState.isSubmitting ? (
                                        <FunkyLoader size="sm">Submitting...</FunkyLoader>
                                    ) : (
                                        attendanceMarked ? "Update Submission" : "Submit"
                                    )}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
    