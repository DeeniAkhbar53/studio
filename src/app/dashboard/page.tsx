
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
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";

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

const qrReaderElementId = "qr-reader-dashboard";

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
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [scanDisplayMessage, setScanDisplayMessage] = useState<ScanDisplayMessage | null>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);

  // Effect to load user auth data from localStorage
  useEffect(() => {
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
        setIsLoadingUser(false);
    } else {
        router.push('/'); // Redirect if no auth data
        // setIsLoadingUser will effectively be true until redirect happens, or page unmounts
    }
  }, [router]);

  // Effect to fetch data once auth info is available
  useEffect(() => {
    if (!currentUserItsId || !currentUserRole) {
        setIsLoadingStats(false);
        setAllMiqaatsList([]); 
        setActiveMiqaatsCount(0);
        setTotalMembersCount(0);
        setTotalMohallahsCount(0);
        return; 
    }

    setIsLoadingStats(true);
    let miqaatsLoaded = false;
    // Initialize adminCountsLoaded to true if the user is not an admin/superadmin,
    // meaning these counts are not expected to load.
    let adminCountsLoaded = !(currentUserRole === 'admin' || currentUserRole === 'superadmin');

    const checkAndSetLoadingDone = () => {
        if (miqaatsLoaded && adminCountsLoaded) {
            setIsLoadingStats(false);
        }
    };

    const unsubscribeMiqaats = getMiqaats((fetchedMiqaats) => {
        setActiveMiqaatsCount(fetchedMiqaats.filter(m => new Date(m.endTime) > new Date()).length);
        setAllMiqaatsList(fetchedMiqaats);
        miqaatsLoaded = true;
        checkAndSetLoadingDone();
    });

    if (currentUserRole === 'admin' || currentUserRole === 'superadmin') {
        const fetchAdminCounts = async () => {
            try {
                const membersCountPromise = getUsersCount(currentUserRole === 'admin' ? currentUserMohallahId || undefined : undefined);
                const mohallahsCountPromise = currentUserRole === 'superadmin' ? getMohallahsCount() : Promise.resolve(0);

                const [membersCount, mohallahsCountValue] = await Promise.all([membersCountPromise, mohallahsCountPromise]);
                
                setTotalMembersCount(membersCount);
                if (currentUserRole === 'superadmin') {
                    setTotalMohallahsCount(mohallahsCountValue);
                }
            } catch (err) {
                console.error("Failed to fetch admin dashboard counts", err);
            } finally {
                adminCountsLoaded = true;
                checkAndSetLoadingDone();
            }
        };
        fetchAdminCounts();
    }

    return () => {
        unsubscribeMiqaats();
    };
  }, [currentUserItsId, currentUserRole, currentUserMohallahId]);


  const handleQrCodeScanned = useCallback(async (decodedText: string) => {
    if (!currentUserItsId || !currentUserName) {
        // This toast was commented out, ensure useToast is imported if re-enabled
        // toast({ title: "User Error", description: "User details not found. Please log in again.", variant: "destructive"});
        console.error("User details not found for QR scan processing.");
        setScanDisplayMessage({ type: 'error', text: "User details not found. Please log in again."});
        setIsProcessingScan(false);
        setIsScannerDialogOpen(false);
        return;
    }
    
    setIsProcessingScan(true);
    setScanDisplayMessage(null);

    const targetMiqaat = allMiqaatsList.find(m => m.id === decodedText || m.barcodeData === decodedText);

    if (!targetMiqaat) {
      setScanDisplayMessage({ type: 'error', text: `Miqaat not found for scanned data: ${decodedText.substring(0,30)}...` });
      setIsProcessingScan(false);
      setIsScannerDialogOpen(false);
      return;
    }

    let isEligible = false;
    // Superadmin and admin/attendance-marker can mark for any miqaat they can see / is listed
    if (currentUserRole === 'superadmin' || currentUserRole === 'admin' || currentUserRole === 'attendance-marker') {
        isEligible = true; 
    } else if (currentUserRole === 'user') {
        // User eligibility: Miqaat is global (no specific mohallahIds) OR user's mohallahId is included
        isEligible = !targetMiqaat.mohallahIds || targetMiqaat.mohallahIds.length === 0 || (!!currentUserMohallahId && targetMiqaat.mohallahIds.includes(currentUserMohallahId));
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
        markedByItsId: currentUserItsId, 
      };
      await markAttendanceInMiqaat(targetMiqaat.id, attendanceEntry);
      
      setAllMiqaatsList(prev => prev.map(m => m.id === targetMiqaat.id ? {...m, attendance: [...(m.attendance || []), attendanceEntry]} : m));

      setScanDisplayMessage({ 
        type: 'success', 
        text: `Attendance marked successfully for ${targetMiqaat.name} at ${format(new Date(), "p")}.`,
        miqaatName: targetMiqaat.name,
        time: format(new Date(), "PPp") 
      });
    } catch (error) {
      console.error("Error marking attendance from scanner:", error);
      setScanDisplayMessage({ type: 'error', text: `Failed to mark attendance for ${targetMiqaat.name}. Error: ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      setIsProcessingScan(false);
      setIsScannerDialogOpen(false);
    }
  }, [currentUserItsId, currentUserName, currentUserRole, currentUserMohallahId, allMiqaatsList]);

  useEffect(() => {
    if (isScannerDialogOpen) {
      setScannerError(null);
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(qrReaderElementId);
      }
      const qrCode = html5QrCodeRef.current;

      if (qrCode && qrCode.getState() !== Html5QrcodeScannerState.SCANNING && qrCode.getState() !== Html5QrcodeScannerState.PAUSED) {
        const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };
        
        qrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText, decodedResult) => {
            setIsScannerActive(false); 
            if (qrCode.getState() === Html5QrcodeScannerState.SCANNING) {
                qrCode.stop().catch(err => console.warn("Error stopping scanner after success:", err));
            }
            handleQrCodeScanned(decodedText);
          },
          (errorMessage) => {
            // This callback is for errors during scanning (e.g., QR not found).
            // console.warn(`QR Code scanning error: ${errorMessage}`);
          }
        )
        .then(() => {
          setIsScannerActive(true);
        })
        .catch((err) => { 
          console.error("Error starting QR scanner:", err);
          setScannerError(`Could not start camera. ${err instanceof Error ? err.message : String(err)} Please check permissions.`);
          setIsScannerActive(false);
        });
      }
    } else { 
      if (html5QrCodeRef.current && html5QrCodeRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
        html5QrCodeRef.current.stop()
          .then(() => setIsScannerActive(false))
          .catch(err => console.error("Error stopping scanner on dialog close:", err));
      }
    }

    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
         html5QrCodeRef.current.stop().catch(err => console.error("Error stopping scanner on cleanup:", err));
      }
    };
  }, [isScannerDialogOpen, handleQrCodeScanned]);


  const adminOverviewStats: AdminStat[] = [
    { title: "Active Miqaats", value: activeMiqaatsCount, icon: CalendarCheck, isLoading: isLoadingStats },
    { title: "Total Members", value: totalMembersCount, icon: Users, isLoading: isLoadingStats, trend: currentUserRole === 'admin' ? "In your Mohallah" : "System-wide" },
  ];

  if (currentUserRole === 'superadmin') {
    adminOverviewStats.push(
      { title: "Total Mohallahs", value: totalMohallahsCount, icon: Building, isLoading: isLoadingStats }
    );
  }
  // Mock stat, can be removed or replaced with real data later
  //  adminOverviewStats.push(
  //    { title: "Overall Attendance", value: "85%", icon: Activity, trend: "Avg. last 7 days (Mock)" }
  //  );


  if (isLoadingUser && !currentUserItsId) { // Show loader only if user data is truly not yet loaded for a decision
    return (
      <div className="flex flex-col flex-1 items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading user data...</p>
      </div>
    );
  }
  
  // If user is not authenticated (itsId is null after loading attempt), router.push will handle redirect.
  // This prevents rendering the dashboard content prematurely.
  if (!currentUserItsId) {
      return null; 
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow space-y-6">
        <Card className="shadow-lg bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-foreground">
              {currentUserRole === 'user' ? `Welcome, ${currentUserName}!` :
               currentUserRole === 'attendance-marker' ? "Attendance Marker Dashboard" : "Admin Dashboard"}
            </CardTitle>
            <Separator className="my-2"/>
            <CardDescription className="text-muted-foreground">
              {currentUserRole === 'user' ? "Ready to mark your attendance. Use the scanner icon below for quick check-in." :
               `Welcome, ${currentUserName}! Role: ${currentUserRole ? currentUserRole.charAt(0).toUpperCase() + currentUserRole.slice(1).replace(/-/g, ' ') : ''}. ${currentUserRole === 'attendance-marker' ? " Use sidebar for actions." : " Overview of system activity."}`
              }
            </CardDescription>
          </CardHeader>
          {currentUserRole === 'user' && (
            <CardContent>
              <p className="text-foreground">Please ensure you are on time for all Miqaats.</p>
            </CardContent>
          )}
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
         {(isLoadingStats && (currentUserRole === 'admin' || currentUserRole === 'superadmin')) && (
          <div className="flex justify-center items-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Loading system data...</p>
          </div>
        )}
      </div>
      <Button
        onClick={() => { setScanDisplayMessage(null); setScannerError(null); setIsScannerDialogOpen(true); }}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 bg-primary hover:bg-primary/90 text-primary-foreground"
        size="icon"
        aria-label="Scan Attendance"
      >
        <ScanLine className="h-6 w-6" />
      </Button>

      <Dialog open={isScannerDialogOpen} onOpenChange={(open) => {
          setIsScannerDialogOpen(open);
          if (!open) { 
            if (html5QrCodeRef.current && html5QrCodeRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
              html5QrCodeRef.current.stop().catch(err => console.error("Error stopping scanner on dialog manual close:", err));
            }
            setIsScannerActive(false);
            setIsProcessingScan(false);
            setScannerError(null);
          }
      }}>
        <DialogContent className="sm:max-w-md p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center"><Camera className="mr-2 h-5 w-5"/>Scan Miqaat Barcode</DialogTitle>
            <DialogDescription className="pt-1">
              Point your camera at the Miqaat QR code.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 space-y-3">
            <div id={qrReaderElementId} className="w-full aspect-square bg-muted rounded-md overflow-hidden flex items-center justify-center text-sm text-muted-foreground">
              {/* html5-qrcode will inject camera view here */}
            </div>
            {scannerError && (
                <Alert variant="destructive">
                  <AlertCircleIcon className="h-4 w-4" />
                  <AlertTitle>Scanner Error</AlertTitle>
                  <AlertDescription>{scannerError}</AlertDescription>
                </Alert>
            )}
            {!isScannerActive && !scannerError && !isProcessingScan && !isScannerDialogOpen && (
                 <div className="text-center text-muted-foreground py-2">
                    <p>Scanner Ready.</p> {/* Default state when dialog is closed or just opened */}
                 </div>
            )}
            {!isScannerActive && !scannerError && !isProcessingScan && isScannerDialogOpen && (
                 <div className="text-center text-muted-foreground py-2">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
                    <p>Initializing Camera...</p>
                 </div>
            )}
             {isScannerActive && !isProcessingScan && (
                 <div className="text-center text-green-600 py-2">
                    <p>Scanning...</p>
                 </div>
            )}
            {isProcessingScan && (
                 <div className="text-center text-blue-600 py-2">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
                    <p>Processing Scan...</p>
                 </div>
            )}
          </div>
          <DialogFooter className="p-4 pt-2">
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

    