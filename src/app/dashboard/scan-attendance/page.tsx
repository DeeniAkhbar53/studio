
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Camera, VideoOff, ArrowLeft, SwitchCamera } from "lucide-react";

export default function ScanAttendancePage() {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const { toast } = useToast();

  const startCamera = useCallback(async (mode: 'user' | 'environment') => {
    // Stop any existing stream
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
      let description = `Could not access the ${mode === 'user' ? 'front' : 'back'} camera. Please ensure permissions are granted.`;
      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          description = `Camera access for the ${mode === 'user' ? 'front' : 'back'} camera was denied. Please enable it in your browser settings.`;
        } else if (error.name === "NotFoundError") {
          description = `The ${mode === 'user' ? 'front' : 'back'} camera was not found on your device.`;
        } else if (error.name === "OverconstrainedError") {
          description = `The ${mode === 'user' ? 'front' : 'back'} camera doesn't support the requested constraints. Trying default camera.`;
           // Try again without specific facingMode as a fallback
            try {
                toast({ title: "Camera Issue", description: `Trying default camera...` });
                const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
                setHasCameraPermission(true);
                if (videoRef.current) {
                    videoRef.current.srcObject = fallbackStream;
                }
                toast({ title: "Camera Fallback", description: `Using default camera.` });
                return; 
            } catch (fallbackError) {
                console.error("Fallback camera error:", fallbackError);
                description = "Could not access any camera. Please check your device and browser permissions.";
            }
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

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => router.push("/dashboard")} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </Button>

      <Card className="w-full max-w-2xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Camera className="mr-3 h-6 w-6 text-primary" />
            Scan Attendance Barcode
          </CardTitle>
          <CardDescription>
            Position the Miqaat barcode in front of your camera. Current: {facingMode === 'user' ? 'Front Camera' : 'Back Camera'}
          </CardDescription>
        </CardHeader>
        <CardContent className="aspect-video bg-muted rounded-md overflow-hidden flex items-center justify-center relative">
          {hasCameraPermission === null && <p>Requesting camera access...</p>}
          
          <video
            ref={videoRef}
            className={`w-full h-full object-cover ${hasCameraPermission ? '' : 'hidden'}`}
            autoPlay
            playsInline // Important for iOS
            muted // Muting is often required for autoplay
          />
          
          {hasCameraPermission === false && (
            <div className="text-center text-destructive p-4">
              <VideoOff size={48} className="mx-auto mb-2" />
              <p className="font-semibold">Camera Access Denied or Unavailable</p>
              <p className="text-sm">Please check permissions or ensure a camera is connected.</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-4 pt-6 sm:flex-row sm:justify-between sm:space-y-0">
          <Button onClick={handleSwitchCamera} disabled={hasCameraPermission === null || !hasCameraPermission} variant="outline">
            <SwitchCamera className="mr-2 h-4 w-4" /> Switch Camera
          </Button>
          {/* Placeholder for actual scan button or automatic detection */}
          <Button className="w-full sm:w-auto" disabled={!hasCameraPermission}>
            <Camera className="mr-2 h-4 w-4" />
            Scan (Placeholder)
          </Button>
        </CardFooter>
         {hasCameraPermission === false && (
             <Alert variant="destructive" className="m-6 mt-0">
              <AlertTitle>Camera Not Working</AlertTitle>
              <AlertDescription>
                Could not access the camera. Please ensure it's connected and permissions are granted in your browser settings. Try switching cameras if available.
              </AlertDescription>
            </Alert>
          )}
          <p className="text-xs text-muted-foreground text-center pb-4 px-6">
            Scanning will happen automatically once a barcode is detected.
          </p>
      </Card>
    </div>
  );
}
