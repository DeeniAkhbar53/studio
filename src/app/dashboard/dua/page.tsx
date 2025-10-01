
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FunkyLoader } from "@/components/ui/funky-loader";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Lock, Video, BookOpen, PlusCircle, MinusCircle, Eye, Edit, ShieldAlert } from "lucide-react";
import { db } from "@/lib/firebase/firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { UserRole, UserDesignation } from "@/types";
import { useRouter } from "next/navigation";
import Plyr from "plyr-react";
import "plyr-react/plyr.css";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { getDuaVideoUrl, updateDuaVideoUrl } from "@/lib/firebase/settingsService";


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
const TARGET_MOHALLAH_ID = "Taheri Mohallah (Khaitan)"; // The ID of the allowed Mohallah

export default function DuaPage() {
    const router = useRouter();
    const [isAccessible, setIsAccessible] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [attendanceMarked, setAttendanceMarked] = useState(false);
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);
    const { toast } = useToast();
    const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
    const [currentUserDesignation, setCurrentUserDesignation] = useState<UserDesignation | null>(null);
    const [currentUserMohallah, setCurrentUserMohallah] = useState<string | null>(null);

    const [videoUrl, setVideoUrl] = useState<string>("");
    const [isEditLinkOpen, setIsEditLinkOpen] = useState(false);
    const [newVideoUrl, setNewVideoUrl] = useState("");


     const form = useForm<DuaFormValues>({
        resolver: zodResolver(duaFormSchema),
        defaultValues: {
            duaKamilCount: 1,
            kahfCount: 1,
            feedback: "",
        },
    });

    useEffect(() => {
        if (typeof window !== "undefined") {
            const role = localStorage.getItem('userRole') as UserRole;
            const designation = localStorage.getItem('userDesignation') as UserDesignation;
            const mohallah = localStorage.getItem('userMohallahId');
            
            setCurrentUserRole(role);
            setCurrentUserDesignation(designation);
            setCurrentUserMohallah(mohallah);
            
            if (mohallah === TARGET_MOHALLAH_ID || role === 'superadmin') {
                setIsAccessible(true);
            } else {
                setIsAccessible(false);
            }
        }
    }, []);

    
    useEffect(() => {
       if (isAccessible === null) return; // Wait for accessibility check

       if (isAccessible) {
            getDuaVideoUrl().then(url => {
                setVideoUrl(url || 'LXb3EKWsInQ'); // Default video if not set
                setNewVideoUrl(url || 'LXb3EKWsInQ');
            }).catch(() => {
                setVideoUrl('LXb3EKWsInQ');
            });
       }
       setIsLoading(false); 
    }, [isAccessible]);

    useEffect(() => {
        if (!isAccessible) return;

        const checkExistingAttendance = async () => {
            const userItsId = localStorage.getItem('userItsId');
            if (!userItsId) return;

            const weekId = getWeekId(new Date());
            const attendanceDocRef = doc(db, 'users', userItsId, 'duaAttendance', weekId);
            
            setIsLoading(true);
            const docSnap = await getDoc(attendanceDocRef);

            if (docSnap.exists()) {
                setAttendanceMarked(true);
                 setShowSuccessMessage(true);
                const data = docSnap.data();
                form.reset({
                    duaKamilCount: data.duaKamilCount,
                    kahfCount: data.kahfCount,
                    feedback: data.feedback,
                });
            }
             setIsLoading(false);
        };

        checkExistingAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAccessible]);

    useEffect(() => {
        if (showSuccessMessage) {
            const timer = setTimeout(() => {
                setShowSuccessMessage(false);
            }, 5000); 
            return () => clearTimeout(timer);
        }
    }, [showSuccessMessage]);
    
    const handleUpdateVideoUrl = async () => {
        try {
            await updateDuaVideoUrl(newVideoUrl);
            setVideoUrl(newVideoUrl);
            setIsEditLinkOpen(false);
            toast({
                title: "Video Link Updated",
                description: "The Dua video link has been successfully changed.",
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "Could not update the video link.",
                variant: "destructive"
            });
        }
    };


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
            }, { merge: true }); 
            setAttendanceMarked(true);
            setShowSuccessMessage(true);
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


    if (isLoading || isAccessible === null) {
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
                    <ShieldAlert className="h-16 w-16 text-destructive mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
                    <p className="text-muted-foreground mt-2">
                        This page is only available for members of {TARGET_MOHALLAH_ID}.
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
                             <CardTitle className="flex items-center text-2xl md:text-3xl">
                                <Video className="mr-3 h-8 w-8 text-primary" />
                                Dua Recitation
                            </CardTitle>
                            <CardDescription className="pt-1">
                                Please watch the video and log your recitation counts below.
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                         {currentUserRole === 'superadmin' && (
                             <Button variant="secondary" size="sm" onClick={() => setIsEditLinkOpen(true)}>
                                <Edit className="md:mr-2 h-4 w-4" />
                                <span className="hidden md:inline">Edit Link</span>
                            </Button>
                         )}
                         {canViewResponses && (
                             <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/dua/responses')}>
                                <Eye className="md:mr-2 h-4 w-4" />
                                <span className="hidden md:inline">View Submissions</span>
                            </Button>
                         )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                     <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
                        {videoUrl ? (
                            <Plyr
                                key={videoUrl}
                                source={{
                                    type: 'video',
                                    sources: [ { src: videoUrl, provider: 'youtube' } ],
                                }}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                <FunkyLoader>Loading Video...</FunkyLoader>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-lg">
                 <CardHeader>
                    <CardTitle className="flex items-center text-xl md:text-2xl">
                        <BookOpen className="mr-3 h-7 w-7 text-primary" />
                        Recitation Log
                    </CardTitle>
                    <CardDescription className="pt-1">
                        Enter your counts for the week. You can update this form anytime during the week.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {showSuccessMessage && (
                        <div className="flex flex-col items-center gap-3 text-green-600 border p-6 rounded-lg bg-green-50 dark:bg-green-950 transition-opacity duration-300">
                            <CheckCircle className="h-12 w-12" />
                            <p className="font-semibold text-lg">Your submission for this week has been recorded.</p>
                            <p className="text-sm">You can still update the counts below if needed.</p>
                        </div>
                    )}

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
            
            <Dialog open={isEditLinkOpen} onOpenChange={setIsEditLinkOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Update Dua Video Link</DialogTitle>
                        <DialogDescription>
                            Paste the new YouTube video ID or full URL below.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input 
                            value={newVideoUrl}
                            onChange={(e) => setNewVideoUrl(e.target.value)}
                            placeholder="e.g., LXb3EKWsInQ or full YouTube URL"
                        />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button onClick={handleUpdateVideoUrl}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
    