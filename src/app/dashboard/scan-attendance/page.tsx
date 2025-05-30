
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Camera, VideoOff, ArrowLeft, SwitchCamera, ListChecks, Clock, CalendarDays, MapPin, Loader2, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { Miqaat, UserRole } from "@/types";
import { getMiqaats, markAttendanceInMiqaat } from "@/lib/firebase/miqaatService";
import type { Unsubscribe } from "firebase/firestore";

type ScanOutcomeStatus = 'success' | 'already_marked' | 'error' | 'not_found' | 'not_eligible' | null;
interface ScanOutcome {
  status: ScanOutcomeStatus;
  message?: string;
  miqaatName?: string;
}

export default function ScanAttendancePage() {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const [allMiqaats, setAllMiqaats] = useState<Pick<Miqaat, "id" | "name" | "startTime" | "endTime" | "reportingTime" | "mohallahIds" | "attendance" | "location">[]>([]);
  const [selectedMiqaatId, setSelectedMiqaatId] = useState<string | null>(null);
  const [isLoadingMiqaats, setIsLoadingMiqaats] = useState(true);
  
  const [isScanning, setIsScanning] = useState(false);
  const [scanOutcome, setScanOutcome] = useState<ScanOutcome>({ status: null });

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

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async (mode: 'user' | 'environment') => {
    stopCamera(); // Stop any existing stream before starting a new one

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({ variant: "destructive", title: "Camera Not Supported", description: "Your browser does not support camera access." });
      setHasCameraPermission(false);
      return;
    }
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode } });
      streamRef.current = newStream;
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (error) {
      console.error(`Error accessing ${mode} camera:`, error);
      setHasCameraPermission(false);
      let description = "Could not access camera. Please check permissions or ensure a camera is connected.";
      if (error instanceof Error && error.name === "NotAllowedError") description = "Camera access was denied. Please enable it in your browser settings.";
      else if (error instanceof Error && error.name === "NotFoundError") description = "The camera was not found on your device.";
      toast({ variant: "destructive", title: "Camera Access Issue", description });
    }
  }, [toast, stopCamera]);

  useEffect(() => {
    if (!scanOutcome.status || scanOutcome.status === 'error') { // Only start camera if no conclusive scan outcome or if there was an error and user might retry
      startCamera(facingMode);
    }
    return () => {
      stopCamera();
    };
  }, [facingMode, startCamera, stopCamera, scanOutcome.status]);


  useEffect(() => {
    setIsLoadingMiqaats(true);
    const unsubscribe = getMiqaats((fetchedMiqaats) => {
      setAllMiqaats(fetchedMiqaats.map(m => ({
        id: m.id, name: m.name, startTime: m.startTime, endTime: m.endTime,
        reportingTime: m.reportingTime, mohallahIds: m.mohallahIds || [],
        attendance: m.attendance || [], location: m.location
      })));
      setIsLoadingMiqaats(false);
    });
    return () => unsubscribe();
  }, []);

  const availableMiqaatsForUser = useMemo(() => {
    if (isLoadingMiqaats) return [];
    // Superadmin and general roles (non-user without mohallahId) see all
    if (currentUserRole === 'superadmin' || (currentUserRole !== 'user' && !currentUserMohallahId) ) return allMiqaats;
    if (currentUserRole === 'user' && !currentUserMohallahId) return [];

    return allMiqaats.filter(miqaat => {
      if (!miqaat.mohallahIds || miqaat.mohallahIds.length === 0) return true;
      return miqaat.mohallahIds.includes(currentUserMohallahId!);
    });
  }, [allMiqaats, currentUserMohallahId, currentUserRole, isLoadingMiqaats]);


  useEffect(() => {
    let scanTimeoutId: NodeJS.Timeout;

    if (selectedMiqaatId && currentUserItsId && currentUserName && !isScanning && !scanOutcome.status) {
      setIsScanning(true);
      setScanOutcome({ status: null }); // Clear previous outcome

      scanTimeoutId = setTimeout(async () => {
        const selectedMiqaatDetails = allMiqaats.find(m => m.id === selectedMiqaatId);

        if (!selectedMiqaatDetails) {
          setScanOutcome({ status: 'not_found', message: "Selected Miqaat details not found." });
          setIsScanning(false);
          stopCamera();
          return;
        }

        // Eligibility check (user's mohallah vs miqaat's mohallahs)
        const isEligible = 
            !selectedMiqaatDetails.mohallahIds || 
            selectedMiqaatDetails.mohallahIds.length === 0 || 
            (currentUserMohallahId && selectedMiqaatDetails.mohallahIds.includes(currentUserMohallahId));

        if (!isEligible) {
            setScanOutcome({ status: 'not_eligible', message: `You are not eligible for ${selectedMiqaatDetails.name}.`, miqaatName: selectedMiqaatDetails.name });
            setIsScanning(false);
            stopCamera();
            return;
        }


        const alreadyMarked = selectedMiqaatDetails.attendance?.some(entry => entry.userItsId === currentUserItsId);
        if (alreadyMarked) {
          setScanOutcome({ status: 'already_marked', message: `You are already marked present for ${selectedMiqaatDetails.name}.`, miqaatName: selectedMiqaatDetails.name });
          setIsScanning(false);
          stopCamera();
          return;
        }

        try {
          await markAttendanceInMiqaat(selectedMiqaatDetails.id, {
            userItsId: currentUserItsId, userName: currentUserName,
            markedAt: new Date().toISOString(), markedByItsId: currentUserItsId,
          });
          
          setAllMiqaats(prevMiqaats => prevMiqaats.map(m => 
            m.id === selectedMiqaatId 
            ? { ...m, attendance: [...(m.attendance || []), { userItsId: currentUserItsId, userName: currentUserName, markedAt: new Date().toISOString(), markedByItsId: currentUserItsId }] } 
            : m
          ));
          setScanOutcome({ status: 'success', miqaatName: selectedMiqaatDetails.name });
          stopCamera();
        } catch (error) {
          console.error("Error marking attendance:", error);
          setScanOutcome({ status: 'error', message: "Could not mark attendance. Please try again.", miqaatName: selectedMiqaatDetails.name });
          stopCamera();
        } finally {
          setIsScanning(false);
        }
      }, 2500); // Simulate scan time
    }
    return () => clearTimeout(scanTimeoutId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMiqaatId, currentUserItsId, currentUserName, allMiqaats, stopCamera]); // isScanning and scanOutcome.status removed to allow re-scan on Miqaat change

  const handleSwitchCamera = () => {
    if (scanOutcome.status === 'success' || scanOutcome.status === 'already_marked') return; // Don't switch if already successfully scanned
    setFacingMode(prevMode => (prevMode === 'user' ? 'environment' : 'user'));
  };
  
  const currentSelectedMiqaatDetails = allMiqaats.find(m => m.id === selectedMiqaatId);
  const formatDate = (dateString?: string) => dateString ? new Date(dateString).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : "N/A";

  const resetScan = () => {
    setSelectedMiqaatId(null);
    setScanOutcome({ status: null });
    setIsScanning(false);
    startCamera(facingMode); // Restart camera
  };

  const showCameraView = hasCameraPermission && !scanOutcome.status && !isScanning;
  const showScanningView = isScanning;
  const showOutcomeView = scanOutcome.status && !isScanning;


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
            Scan My Attendance
          </CardTitle>
          <Separator className="my-2" />
          <CardDescription>
            {showOutcomeView ? "Attendance Status:" : "Select a Miqaat. Scanning will begin automatically."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {(!scanOutcome.status || scanOutcome.status === 'error' || scanOutcome.status === 'not_found') && (
            <div>
              <Label htmlFor="miqaat-select-scan">Select Miqaat</Label>
              <Select
                onValueChange={(value) => {
                  setSelectedMiqaatId(value);
                  setScanOutcome({ status: null }); // Reset outcome when Miqaat changes
                  if (!hasCameraPermission) startCamera(facingMode); // Attempt to start camera if not already permitted
                }}
                value={selectedMiqaatId || undefined}
                disabled={isLoadingMiqaats || isScanning || !!scanOutcome.status && (scanOutcome.status !== 'error' && scanOutcome.status !== 'not_found') }
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
          )}

          {selectedMiqaatId && currentSelectedMiqaatDetails && (!scanOutcome.status || scanOutcome.status === 'error') && (
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

          {/* Camera View / Scanning Indicator */}
          <div className="aspect-video bg-muted rounded-md overflow-hidden flex items-center justify-center relative">
            {hasCameraPermission === null && !scanOutcome.status && <p>Requesting camera access...</p>}
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${(showCameraView || showScanningView) && hasCameraPermission ? '' : 'hidden'}`}
              autoPlay
              playsInline 
              muted 
            />
            {showScanningView && hasCameraPermission && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-2" />
                <p className="text-lg font-semibold">Scanning...</p>
                <p className="text-sm">Please hold steady.</p>
              </div>
            )}
            {hasCameraPermission === false && !scanOutcome.status && (
              <div className="text-center text-destructive p-4">
                <VideoOff size={48} className="mx-auto mb-2" />
                <p className="font-semibold">Camera Access Denied or Unavailable</p>
              </div>
            )}
          </div>

          {/* Scan Outcome View */}
          {showOutcomeView && (
            <div className="text-center py-6">
              {scanOutcome.status === 'success' && (
                <>
                  <CheckCircle2 className="mx-auto h-16 w-16 text-green-500 mb-3" />
                  <h3 className="text-xl font-semibold text-green-600">Attendance Marked!</h3>
                  <p className="text-muted-foreground">Successfully marked for {scanOutcome.miqaatName || "the Miqaat"}.</p>
                </>
              )}
              {scanOutcome.status === 'already_marked' && (
                <>
                  <AlertCircle className="mx-auto h-16 w-16 text-blue-500 mb-3" />
                  <h3 className="text-xl font-semibold text-blue-600">Already Marked</h3>
                  <p className="text-muted-foreground">{scanOutcome.message || `You are already marked for ${scanOutcome.miqaatName || "this Miqaat"}.`}</p>
                </>
              )}
              {scanOutcome.status === 'not_eligible' && (
                <>
                  <XCircle className="mx-auto h-16 w-16 text-orange-500 mb-3" />
                  <h3 className="text-xl font-semibold text-orange-600">Not Eligible</h3>
                  <p className="text-muted-foreground">{scanOutcome.message || `You are not eligible for ${scanOutcome.miqaatName || "this Miqaat"}.`}</p>
                </>
              )}
              {(scanOutcome.status === 'error' || scanOutcome.status === 'not_found') && (
                <>
                  <XCircle className="mx-auto h-16 w-16 text-red-500 mb-3" />
                  <h3 className="text-xl font-semibold text-red-600">Scan Failed</h3>
                  <p className="text-muted-foreground">{scanOutcome.message || "Could not mark attendance."}</p>
                </>
              )}
            </div>
          )}

        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:justify-between pt-6 gap-2">
          <Button onClick={handleSwitchCamera} disabled={hasCameraPermission === null || !hasCameraPermission || isScanning || (!!scanOutcome.status && scanOutcome.status !== 'error' && scanOutcome.status !== 'not_found')} variant="outline" size="sm" className="w-full sm:w-auto">
            <SwitchCamera className="mr-2 h-4 w-4" /> Switch Camera
          </Button>
          {(scanOutcome.status && scanOutcome.status !== 'error' && scanOutcome.status !== 'not_found') && (
             <Button onClick={resetScan} size="sm" className="w-full sm:w-auto">
                Scan for Another Miqaat
            </Button>
          )}
           {(scanOutcome.status === 'error' || scanOutcome.status === 'not_found') && (
             <Button onClick={resetScan} variant="outline" size="sm" className="w-full sm:w-auto">
                Try Again / Select Different Miqaat
            </Button>
          )}
        </CardFooter>
         {hasCameraPermission === false && !scanOutcome.status && (
             <Alert variant="destructive" className="m-6 mt-0">
              <AlertTitle>Camera Not Working</AlertTitle>
              <AlertDescription>
                Could not access the camera. Ensure it's connected and permissions are granted.
              </AlertDescription>
            </Alert>
          )}
        {!selectedMiqaatId && !isLoadingMiqaats && !scanOutcome.status && (
             <Alert variant="default" className="m-6 mt-0 border-primary/50">
                <AlertCircle className="h-4 w-4 text-primary" />
                <AlertTitle>Select Miqaat</AlertTitle>
                <AlertDescription>
                    Please select a Miqaat from the dropdown above to start scanning.
                </AlertDescription>
            </Alert>
        )}
      </Card>
    </div>
  );
}
