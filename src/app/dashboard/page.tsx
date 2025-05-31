
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Activity, Users, CalendarCheck, ScanLine, Loader2, Settings, HelpCircle, ListChecks, BarChart3, Home as HomeIcon, Building, Camera, VideoOff, CheckCircle2, XCircle, AlertCircleIcon } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { UserRole, Miqaat, MiqaatAttendanceEntryItem } from "@/types";
import { getMiqaats, markAttendanceInMiqaat } from "@/lib/firebase/miqaatService";
import { getUsersCount } from "@/lib/firebase/userService";
import { getMohallahsCount } from "@/lib/firebase/mohallahService";
import { Separator } from "@/components/ui/separator";
import type { Unsubscribe } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface AdminStat {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  isLoading?: boolean;
}

interface ScanDisplayMessage {
  text: string;
  type: 'success' | 'error' | 'info';
  miqaatName?: string;
  time?: string;
}

export default function DashboardOverviewPage() {
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>("Valued Member");
  const [currentUserItsId, setCurrentUserItsId] = useState<string | null>(null);
  const [currentUserMohallahId, setCurrentUserMohallahId] = useState<string | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  const [activeMiqaatsCount, setActiveMiqaatsCount] = useState<number>(0);
  const [allMiqaatsList, setAllMiqaatsList] = useState<Pick<Miqaat, "id" | "name" | "startTime" | "endTime" | "reportingTime" | "mohallahIds" | "teams" | "location" | "barcodeData" | "attendance">[]>([]);
  const [totalMembersCount, setTotalMembersCount] = useState<number>(0);
  const [totalMohallahsCount, setTotalMohallahsCount] = useState<number>(0);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Scanner states
  const [isScannerDialogOpen, setIsScannerDialogOpen] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isScanningActive, setIsScanningActive] = useState(false); // Indicates if the simulated scan is in progress
  const [isProcessingScan, setIsProcessingScan] = useState(false); // For loader after scan, before db operation
  const [scanDisplayMessage, setScanDisplayMessage] = useState<ScanDisplayMessage | null>(null);


  // Load user data and stats
  useEffect(() => {
    let unsubscribeMiqaats: Unsubscribe | null = null;
    const storedRole = localStorage.getItem('userRole') as UserRole | null;
    const storedName = localStorage.getItem('userName');
    const storedItsId = localStorage.getItem('userItsId');
    const storedMohallahId = localStorage.getItem('userMohallahId');

    if (storedItsId && storedRole) {
      setCurrentUserRole(storedRole);
      setCurrentUserItsId(storedItsId);
      setCurrentUserMohallahId(storedMohallahId);
      if (storedName) {
        setCurrentUserName(storedName);
      }

      setIsLoadingStats(true);
      unsubscribeMiqaats = getMiqaats((fetchedMiqaats) => {
        setActiveMiqaatsCount(fetchedMiqaats.filter(m => new Date(m.endTime) > new Date()).length);
        setAllMiqaatsList(fetchedMiqaats); // Store all miqaats for lookups
        if (currentUserRole !== 'user') setIsLoadingStats(false); // Stats loaded for admin/superadmin
      });

      if (storedRole === 'admin' || storedRole === 'superadmin') {
        const fetchCounts = async () => {
          try {
            const membersCount = await getUsersCount(storedRole === 'admin' ? storedMohallahId || undefined : undefined);
            setTotalMembersCount(membersCount);
            
            if (storedRole === 'superadmin') {
              const mohallahsCount = await getMohallahsCount();
              setTotalMohallahsCount(mohallahsCount);
            }
          } catch (err) {
            console.error("Failed to fetch dashboard counts", err);
          } finally {
            // setIsLoadingStats(false) is handled by getMiqaats for admin/superadmin
          }
        };
        fetchCounts();
      } else {
        setIsLoadingStats(false); // No extra stats for 'user' role beyond miqaats
      }

    } else {
      router.push('/');
    }
    setIsLoadingUser(false);
    
    return () => {
      if (unsubscribeMiqaats) {
        unsubscribeMiqaats();
      }
      stopCamera(); // Clean up camera on unmount
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]); // currentUserRole removed to avoid re-triggering initial miqaat load excessively

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({ variant: "destructive", title: "Camera Not Supported", description: "Your browser does not support camera access." });
      setHasCameraPermission(false);
      return;
    }
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = newStream;
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      setHasCameraPermission(false);
      toast({ variant: "destructive", title: "Camera Access Issue", description: "Could not access camera. Please check permissions." });
    }
  }, [toast, stopCamera]);

  useEffect(() => {
    if (isScannerDialogOpen && !streamRef.current) {
      startCamera();
    } else if (!isScannerDialogOpen) {
      stopCamera();
      setHasCameraPermission(null); // Reset permission status when dialog closes
    }
  }, [isScannerDialogOpen, startCamera, stopCamera]);

  // Simulate scan and process
  const handleSimulatedScan = async () => {
    if (!currentUserItsId || !currentUserName) {
        toast({ title: "User Error", description: "User details not found. Please log in again.", variant: "destructive"});
        return;
    }
    
    // For simulation, we'll try to use the barcodeData of the first available Miqaat.
    // In a real scenario, this would come from a QR scanner library.
    const firstMiqaatWithBarcode = allMiqaatsList.find(m => m.barcodeData || m.id);
    if (!firstMiqaatWithBarcode) {
        toast({ title: "No Miqaat Available", description: "No Miqaats found to simulate scan against.", variant: "default" });
        setScanDisplayMessage({type: 'info', text: "No Miqaats available for scanning."});
        setIsScannerDialogOpen(false);
        return;
    }
    const scannedData = firstMiqaatWithBarcode.barcodeData || firstMiqaatWithBarcode.id;

    setIsScanningActive(false); // Turn off "scanning..." text
    setIsProcessingScan(true);  // Show processing loader

    const targetMiqaat = allMiqaatsList.find(m => m.id === scannedData || m.barcodeData === scannedData);

    if (!targetMiqaat) {
      setScanDisplayMessage({ type: 'error', text: "Miqaat not found for scanned data." });
      setIsProcessingScan(false);
      setIsScannerDialogOpen(false);
      return;
    }

    // Eligibility Check (Simplified: user role or specific mohallah)
    let isEligible = false;
    if (currentUserRole === 'superadmin' || currentUserRole === 'admin' || currentUserRole === 'attendance-marker') {
        isEligible = true; // Admin/Superadmin/Marker can mark for any miqaat they see
    } else if (currentUserRole === 'user') {
        isEligible = !targetMiqaat.mohallahIds || targetMiqaat.mohallahIds.length === 0 || (currentUserMohallahId && targetMiqaat.mohallahIds.includes(currentUserMohallahId));
    }


    if (!isEligible) {
      setScanDisplayMessage({ type: 'error', text: `Not eligible for Miqaat: ${targetMiqaat.name}.` });
      setIsProcessingScan(false);
      setIsScannerDialogOpen(false);
      return;
    }

    const alreadyMarked = targetMiqaat.attendance?.some(entry => entry.userItsId === currentUserItsId);
    if (alreadyMarked) {
      setScanDisplayMessage({ type: 'info', text: `Already marked for ${targetMiqaat.name}.`, miqaatName: targetMiqaat.name, time: format(new Date(), "PPp") });
      setIsProcessingScan(false);
      setIsScannerDialogOpen(false);
      return;
    }

    try {
      const attendanceEntry: MiqaatAttendanceEntryItem = {
        userItsId: currentUserItsId,
        userName: currentUserName,
        markedAt: new Date().toISOString(),
        markedByItsId: currentUserItsId, // Self-scan
      };
      await markAttendanceInMiqaat(targetMiqaat.id, attendanceEntry);
      
      // Optimistically update local miqaat list for immediate feedback if stats rely on it
      setAllMiqaatsList(prev => prev.map(m => m.id === targetMiqaat.id ? {...m, attendance: [...(m.attendance || []), attendanceEntry]} : m));

      setScanDisplayMessage({ 
        type: 'success', 
        text: `Attendance marked successfully for ${targetMiqaat.name} at ${format(new Date(), "p")}.`,
        miqaatName: targetMiqaat.name,
        time: format(new Date(), "PPp") 
      });
    } catch (error) {
      console.error("Error marking attendance from FAB scanner:", error);
      setScanDisplayMessage({ type: 'error', text: `Failed to mark attendance for ${targetMiqaat.name}.` });
    } finally {
      setIsProcessingScan(false);
      setIsScannerDialogOpen(false);
    }
  };

  useEffect(() => {
    let scanTimeoutId: NodeJS.Timeout;
    if (isScannerDialogOpen && hasCameraPermission && !isScanningActive && !isProcessingScan) {
      setIsScanningActive(true); // Show "Scanning..."
      // Simulate a scan after 2.5 seconds
      scanTimeoutId = setTimeout(() => {
        if (isScannerDialogOpen) { // Check if dialog is still open before proceeding
            handleSimulatedScan();
        }
      }, 2500);
    }
    return () => clearTimeout(scanTimeoutId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScannerDialogOpen, hasCameraPermission, isScanningActive, isProcessingScan]);


  const adminOverviewStats: AdminStat[] = [
    { title: "Active Miqaats", value: activeMiqaatsCount, icon: CalendarCheck, isLoading: isLoadingStats && (currentUserRole === 'admin' || currentUserRole === 'superadmin') },
    { title: "Total Members", value: totalMembersCount, icon: Users, isLoading: isLoadingStats && (currentUserRole === 'admin' || currentUserRole === 'superadmin'), trend: currentUserRole === 'admin' ? "In your Mohallah" : "System-wide" },
  ];

  if (currentUserRole === 'superadmin') {
    adminOverviewStats.push(
      { title: "Total Mohallahs", value: totalMohallahsCount, icon: Building, isLoading: isLoadingStats }
    );
  }
   adminOverviewStats.push(
     { title: "Overall Attendance", value: "85%", icon: Activity, trend: "Avg. last 7 days (Mock)" }
   );


  if (isLoadingUser) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading user data...</p>
      </div>
    );
  }

  // User View
  if (currentUserRole === 'user') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-grow space-y-6">
          <Card className="shadow-lg bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
            <CardHeader>
              <CardTitle className="text-3xl font-bold text-foreground">Welcome, {currentUserName}!</CardTitle>
              <Separator className="my-2"/>
              <CardDescription className="text-muted-foreground">
                Ready to mark your attendance. Use the scanner icon below for quick check-in.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-foreground">Please ensure you are on time for all Miqaats.</p>
            </CardContent>
          </Card>

          {scanDisplayMessage && (
            <Alert variant={scanDisplayMessage.type === 'error' ? 'destructive' : 'default'} className={`mt-4 ${scanDisplayMessage.type === 'success' ? 'border-green-500 bg-green-50 dark:bg-green-900/30' : scanDisplayMessage.type === 'info' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : ''}`}>
              {scanDisplayMessage.type === 'success' && <CheckCircle2 className="h-4 w-4" />}
              {scanDisplayMessage.type === 'error' && <XCircle className="h-4 w-4" />}
              {scanDisplayMessage.type === 'info' && <AlertCircleIcon className="h-4 w-4" />}
              <AlertTitle>
                {scanDisplayMessage.type === 'success' ? "Scan Successful" : scanDisplayMessage.type === 'error' ? "Scan Error" : "Scan Info"}
              </AlertTitle>
              <AlertDescription>{scanDisplayMessage.text}</AlertDescription>
            </Alert>
          )}

          {/* Replaced dedicated card with FAB */}
        </div>
        <Button
          onClick={() => { setScanDisplayMessage(null); setIsScannerDialogOpen(true); }}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
          size="icon"
          aria-label="Scan Attendance"
        >
          <ScanLine className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  // Admin or Superadmin or Attendance Marker View
  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow space-y-6">
        <Card className="shadow-lg bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-foreground">
              {currentUserRole === 'attendance-marker' ? "Attendance Marker Dashboard" : "Admin Dashboard"}
            </CardTitle>
            <Separator className="my-2"/>
            <CardDescription className="text-muted-foreground">
              Welcome, {currentUserName}! Role: {currentUserRole}. 
              {currentUserRole === 'attendance-marker' ? " Use sidebar for actions." : " Overview of system activity."}
            </CardDescription>
          </CardHeader>
        </Card>

        {scanDisplayMessage && (
         <Alert variant={scanDisplayMessage.type === 'error' ? 'destructive' : 'default'} className={`mt-4 ${scanDisplayMessage.type === 'success' ? 'border-green-500 bg-green-50 dark:bg-green-900/30' : scanDisplayMessage.type === 'info' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : ''}`}>
            {scanDisplayMessage.type === 'success' && <CheckCircle2 className="h-4 w-4" />}
            {scanDisplayMessage.type === 'error' && <XCircle className="h-4 w-4" />}
            {scanDisplayMessage.type === 'info' && <AlertCircleIcon className="h-4 w-4" />}
            <AlertTitle>
              {scanDisplayMessage.type === 'success' ? "Scan Successful" : scanDisplayMessage.type === 'error' ? "Scan Error" : "Scan Info"}
            </AlertTitle>
            <AlertDescription>{scanDisplayMessage.text}</AlertDescription>
          </Alert>
        )}

        {(currentUserRole === 'admin' || currentUserRole === 'superadmin') && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {adminOverviewStats.map((stat) => (
              <Card key={stat.title} className="shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground break-words">{stat.title}</CardTitle>
                  <stat.icon className="h-5 w-5 text-accent shrink-0" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground break-all">
                    {stat.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stat.value}
                  </div>
                  {stat.trend && <p className="text-xs text-muted-foreground break-words">{stat.trend}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
         {(isLoadingStats && (currentUserRole === 'admin' || currentUserRole === 'superadmin') && !adminOverviewStats.some(s => !s.isLoading)) && (
          <div className="flex justify-center items-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Loading system data...</p>
          </div>
        )}
      </div>
      <Button
        onClick={() => { setScanDisplayMessage(null); setIsScannerDialogOpen(true); }}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
        size="icon"
        aria-label="Scan Attendance"
      >
        <ScanLine className="h-6 w-6" />
      </Button>

      {/* Scanner Dialog */}
      <Dialog open={isScannerDialogOpen} onOpenChange={(open) => {
          setIsScannerDialogOpen(open);
          if (!open) {
              stopCamera();
              setIsScanningActive(false);
              setIsProcessingScan(false);
              // Do not clear scanDisplayMessage here, it should persist on the main page
          }
      }}>
        <DialogContent className="sm:max-w-md p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center"><Camera className="mr-2 h-5 w-5"/>Scan Miqaat Barcode</DialogTitle>
            <DialogDescription className="pt-1">
              Point your camera at the Miqaat barcode. Scanning will start automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 space-y-4">
            <div className="aspect-video bg-muted rounded-md overflow-hidden flex items-center justify-center relative">
                <video
                    ref={videoRef}
                    className={`w-full h-full object-cover ${hasCameraPermission && (isScanningActive || isProcessingScan || !streamRef.current) ? '' : 'hidden'}`}
                    autoPlay
                    playsInline
                    muted
                />
                {!hasCameraPermission && hasCameraPermission !== null && (
                    <div className="text-center p-4">
                        <VideoOff size={48} className="mx-auto mb-2 text-destructive" />
                        <p className="font-semibold">Camera Access Denied or Unavailable</p>
                        <p className="text-xs text-muted-foreground">Please ensure camera permissions are enabled in your browser settings for this site.</p>
                    </div>
                )}
                {hasCameraPermission === null && (
                    <div className="text-center p-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                        <p>Initializing Camera...</p>
                    </div>
                )}
                {isScanningActive && hasCameraPermission && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white z-10">
                        <Loader2 className="h-10 w-10 animate-spin text-primary mb-2" />
                        <p className="text-lg font-semibold">Scanning...</p>
                    </div>
                )}
                 {isProcessingScan && hasCameraPermission && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white z-10">
                        <Loader2 className="h-10 w-10 animate-spin text-green-500 mb-2" />
                        <p className="text-lg font-semibold">Processing Scan...</p>
                    </div>
                )}
            </div>
          </div>
          <DialogFooter className="p-4 pt-0">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

