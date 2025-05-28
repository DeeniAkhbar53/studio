
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Camera, VideoOff, ArrowLeft, SwitchCamera, ListChecks, Clock, CalendarDays, MapPin, Loader2, AlertCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { Miqaat, UserRole } from "@/types";
import { getMiqaats, markAttendanceInMiqaat } from "@/lib/firebase/miqaatService";
import type { Unsubscribe } from "firebase/firestore";

export default function ScanAttendancePage() {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const { toast } = useToast();

  const [allMiqaats, setAllMiqaats] = useState<Pick<Miqaat, "id" | "name" | "startTime" | "endTime" | "reportingTime" | "mohallahIds" | "attendance" | "location">[]>([]);
  const [selectedMiqaatId, setSelectedMiqaatId] = useState<string | null>(null);
  const [isLoadingMiqaats, setIsLoadingMiqaats] = useState(true);
  const [isProcessingScan, setIsProcessingScan] = useState(false);

  const [currentUserItsId, setCurrentUserItsId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [currentUserMohallahId, setCurrentUserMohallahId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);


  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentUserItsId(localStorage.getItem('userItsId'));
      setCurrentUserName(localStorage.getItem('userName'));
      setCurrentUserMohallahId(localStorage.getItem('userMohallahId'));
      setCurrentUserRole(localStorage.getItem('userRole') as UserRole | null);
    }
  }, []);

  useEffect(() => {
    setIsLoadingMiqaats(true);
    const unsubscribe = getMiqaats((fetchedMiqaats) => {
      setAllMiqaats(fetchedMiqaats.map(m => ({
        id: m.id,
        name: m.name,
        startTime: m.startTime,
        endTime: m.endTime,
        reportingTime: m.reportingTime,
        mohallahIds: m.mohallahIds || [],
        attendance: m.attendance || [],
        location: m.location
      })));
      setIsLoadingMiqaats(false);
    });
    return () => unsubscribe();
  }, []);

  const availableMiqaatsForUser = useMemo(() => {
    if (isLoadingMiqaats) return [];
    if (currentUserRole === 'superadmin') return allMiqaats; // Superadmin sees all
    if (!currentUserMohallahId && currentUserRole !== 'user') return allMiqaats; // Non-user roles without specific mohallah see all (e.g. general admin)
                                                                            // For 'user' role, mohallahId is critical.
    if (currentUserRole === 'user' && !currentUserMohallahId) return []; // Regular user needs a mohallah ID

    return allMiqaats.filter(miqaat => {
      if (!miqaat.mohallahIds || miqaat.mohallahIds.length === 0) {
        return true; // Available to all if no specific mohallahs are assigned
      }
      return miqaat.mohallahIds.includes(currentUserMohallahId!);
    });
  }, [allMiqaats, currentUserMohallahId, currentUserRole, isLoadingMiqaats]);


  const startCamera = useCallback(async (mode: 'user' | 'environment') => {
    if (videoRef.current && videoRef.current.srcObject) {
      const currentStream = videoRef.current.srcObject as MediaStream;
      currentStream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({
        variant: "destructive",
        title: "Camera Not Supported",
        description: "Your browser does not support camera access.",
      });
      setHasCameraPermission(false);
      return;
    }

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode } });
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (error) {
      console.error(`Error accessing ${mode} camera:`, error);
      setHasCameraPermission(false);
      // Simplified error reporting as per previous request
      let description = "Could not access camera. Please check permissions or ensure a camera is connected.";
       if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          description = `Camera access was denied. Please enable it in your browser settings.`;
        } else if (error.name === "NotFoundError") {
          description = `The camera was not found on your device.`;
        }
      }
      toast({
        variant: "destructive",
        title: "Camera Access Issue",
        description: description,
      });
    }
  }, [toast]);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [facingMode, startCamera]);

  const handleSwitchCamera = () => {
    setFacingMode(prevMode => (prevMode === 'user' ? 'environment' : 'user'));
  };

  const handleScanAndMark = async () => {
    if (!selectedMiqaatId) {
      toast({ title: "Miqaat Not Selected", description: "Please select a Miqaat before scanning.", variant: "destructive" });
      return;
    }
    if (!currentUserItsId || !currentUserName) {
      toast({ title: "User Not Identified", description: "Could not identify logged-in user. Please re-login.", variant: "destructive" });
      return;
    }

    setIsProcessingScan(true);
    const selectedMiqaatDetails = allMiqaats.find(m => m.id === selectedMiqaatId);

    if (!selectedMiqaatDetails) {
      toast({ title: "Error", description: "Selected Miqaat details not found.", variant: "destructive" });
      setIsProcessingScan(false);
      return;
    }

    const alreadyMarked = selectedMiqaatDetails.attendance?.some(entry => entry.userItsId === currentUserItsId);
    if (alreadyMarked) {
      toast({
        title: "Already Marked",
        description: `You (${currentUserName}) are already marked present for ${selectedMiqaatDetails.name}.`,
        variant: "default",
      });
      setIsProcessingScan(false);
      return;
    }

    try {
      await markAttendanceInMiqaat(selectedMiqaatDetails.id, {
        userItsId: currentUserItsId,
        userName: currentUserName,
        markedAt: new Date().toISOString(),
        markedByItsId: currentUserItsId, // User marks themselves
      });
      
      // Optimistically update local state
      setAllMiqaats(prevMiqaats => prevMiqaats.map(m => 
        m.id === selectedMiqaatId 
        ? { ...m, attendance: [...(m.attendance || []), { userItsId: currentUserItsId, userName: currentUserName, markedAt: new Date().toISOString(), markedByItsId: currentUserItsId }] } 
        : m
      ));

      toast({
        title: "Attendance Marked Successfully!",
        description: `You have been marked present for ${selectedMiqaatDetails.name}.`,
      });
    } catch (error) {
      console.error("Error marking attendance:", error);
      toast({ title: "Error", description: "Could not mark attendance. Please try again.", variant: "destructive" });
    } finally {
      setIsProcessingScan(false);
    }
  };
  
  const currentSelectedMiqaatDetails = allMiqaats.find(m => m.id === selectedMiqaatId);
  const formatDate = (dateString?: string) => dateString ? new Date(dateString).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : "N/A";


  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => router.push("/dashboard")} className="mb-4" size="sm">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </Button>

      <Card className="w-full max-w-2xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <ListChecks className="mr-3 h-6 w-6 text-primary" />
            Scan & Mark My Attendance
          </CardTitle>
          <Separator className="my-2" />
          <CardDescription>
            Select a Miqaat, then point the barcode towards your camera to mark your attendance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="miqaat-select-scan">Select Miqaat</Label>
            <Select
              onValueChange={setSelectedMiqaatId}
              value={selectedMiqaatId || undefined}
              disabled={isLoadingMiqaats || isProcessingScan}
            >
              <SelectTrigger id="miqaat-select-scan" className="mt-1">
                <SelectValue placeholder={isLoadingMiqaats ? "Loading Miqaats..." : "Choose a Miqaat"} />
              </SelectTrigger>
              <SelectContent>
                {isLoadingMiqaats && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                {!isLoadingMiqaats && availableMiqaatsForUser.length === 0 && <SelectItem value="no-miqaats" disabled>No Miqaats available for you</SelectItem>}
                {availableMiqaatsForUser.map(miqaat => (
                  <SelectItem key={miqaat.id} value={miqaat.id}>
                    {miqaat.name} ({new Date(miqaat.startTime).toLocaleDateString()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {currentSelectedMiqaatDetails && (
            <Card className="bg-muted/30 p-4">
              <CardHeader className="p-0 pb-2">
                <CardTitle className="text-lg">{currentSelectedMiqaatDetails.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-0 text-sm space-y-1 text-muted-foreground">
                <div className="flex items-center"><CalendarDays className="mr-2 h-4 w-4 text-primary" /> Start: {formatDate(currentSelectedMiqaatDetails.startTime)}</div>
                {currentSelectedMiqaatDetails.reportingTime && <div className="flex items-center"><Clock className="mr-2 h-4 w-4 text-primary" /> Reporting: {formatDate(currentSelectedMiqaatDetails.reportingTime)}</div>}
                {currentSelectedMiqaatDetails.location && <div className="flex items-center"><MapPin className="mr-2 h-4 w-4 text-primary" /> Venue: {currentSelectedMiqaatDetails.location}</div>}
              </CardContent>
            </Card>
          )}

          <div className="aspect-video bg-muted rounded-md overflow-hidden flex items-center justify-center relative">
            {hasCameraPermission === null && <p>Requesting camera access...</p>}
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${hasCameraPermission ? '' : 'hidden'}`}
              autoPlay
              playsInline 
              muted 
            />
            {hasCameraPermission === false && (
              <div className="text-center text-destructive p-4">
                <VideoOff size={48} className="mx-auto mb-2" />
                <p className="font-semibold">Camera Access Denied or Unavailable</p>
                <p className="text-sm">Please check permissions or ensure a camera is connected.</p>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:justify-between pt-6 gap-2">
          <Button onClick={handleSwitchCamera} disabled={hasCameraPermission === null || !hasCameraPermission} variant="outline" size="sm" className="w-full sm:w-auto">
            <SwitchCamera className="mr-2 h-4 w-4" /> Switch Camera
          </Button>
          <Button 
            onClick={handleScanAndMark} 
            className="w-full sm:w-auto" 
            disabled={!hasCameraPermission || !selectedMiqaatId || isProcessingScan || isLoadingMiqaats} 
            size="sm"
          >
            {isProcessingScan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ListChecks className="mr-2 h-4 w-4" />}
            {isProcessingScan ? "Processing..." : "Scan & Mark Attendance"}
          </Button>
        </CardFooter>
         {hasCameraPermission === false && (
             <Alert variant="destructive" className="m-6 mt-0">
              <AlertTitle>Camera Not Working</AlertTitle>
              <AlertDescription>
                Could not access the camera. Please ensure it&apos;s connected and permissions are granted in your browser settings.
              </AlertDescription>
            </Alert>
          )}
        {!selectedMiqaatId && !isLoadingMiqaats && (
             <Alert variant="default" className="m-6 mt-0 border-primary/50">
                <AlertCircle className="h-4 w-4 text-primary" />
                <AlertTitle>Select Miqaat</AlertTitle>
                <AlertDescription>
                    Please select a Miqaat from the dropdown above to enable scanning.
                </AlertDescription>
            </Alert>
        )}
      </Card>
    </div>
  );
}

    