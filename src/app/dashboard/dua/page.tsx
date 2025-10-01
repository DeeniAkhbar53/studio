"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FunkyLoader } from "@/components/ui/funky-loader";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Lock, Video } from "lucide-react";
import { db } from "@/lib/firebase/firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { format } from "date-fns";

// Helper function to get the current week's identifier (e.g., "2024-W35")
const getWeekId = (date: Date) => {
    const year = date.getFullYear();
    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
};

export default function DuaPage() {
    const [isAccessible, setIsAccessible] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [attendanceMarked, setAttendanceMarked] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    
    useEffect(() => {
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
            }
        };

        checkExistingAttendance();
    }, [isAccessible]);

    const handleMarkAttendance = async () => {
        setIsSubmitting(true);
        const userItsId = localStorage.getItem('userItsId');
        const userName = localStorage.getItem('userName') || 'Unknown';

        if (!userItsId) {
            toast({
                title: "Error",
                description: "Could not identify user. Please log in again.",
                variant: "destructive",
            });
            setIsSubmitting(false);
            return;
        }

        const weekId = getWeekId(new Date());
        const attendanceDocRef = doc(db, 'users', userItsId, 'duaAttendance', weekId);

        try {
            await setDoc(attendanceDocRef, {
                itsId: userItsId,
                name: userName,
                weekId: weekId,
                markedAt: serverTimestamp(),
            });
            setAttendanceMarked(true);
            toast({
                title: "Attendance Marked",
                description: "Your attendance for this week's Dua has been recorded.",
                className: 'border-green-500 bg-green-50 dark:bg-green-900/30',
            });
        } catch (error) {
            console.error("Error marking Dua attendance: ", error);
            toast({
                title: "Submission Error",
                description: "Could not mark your attendance. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <FunkyLoader size="lg">Checking access time...</FunkyLoader>
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
                    <CardTitle className="flex items-center text-3xl">
                        <Video className="mr-3 h-8 w-8 text-primary" />
                        Dua Recitation
                    </CardTitle>
                    <CardDescription className="pt-1">
                        Please watch the video and mark your attendance below.
                    </CardDescription>
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

                    <div className="text-center pt-4">
                        {attendanceMarked ? (
                            <div className="flex flex-col items-center gap-3 text-green-600">
                                <CheckCircle className="h-12 w-12" />
                                <p className="font-semibold text-lg">Your attendance for this week has been recorded.</p>
                            </div>
                        ) : (
                            <Button
                                size="lg"
                                onClick={handleMarkAttendance}
                                disabled={isSubmitting}
                                className="min-w-[250px]"
                            >
                                {isSubmitting ? (
                                    <FunkyLoader size="sm">Submitting...</FunkyLoader>
                                ) : (
                                    "Mark My Attendance"
                                )}
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}