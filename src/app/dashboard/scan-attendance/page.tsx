
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Camera, VideoOff, ArrowLeft } from "lucide-react";

export default function ScanAttendancePage() {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const getCameraPermission = async () => {
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
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Error accessing camera:", error);
        setHasCameraPermission(false);
        let description = "Please enable camera permissions in your browser settings to use this feature.";
        if (error instanceof Error && error.name === "NotAllowedError") {
            description = "Camera access was denied. Please enable it in your browser settings.";
        } else if (error instanceof Error && error.name === "NotFoundError") {
            description = "No camera was found on your device.";
        }
        toast({
          variant: "destructive",
          title: "Camera Access Issue",
          description: description,
        });
      }
    };

    getCameraPermission();

    return () => {
      // Cleanup: stop the camera stream when the component unmounts
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [toast]);

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
            Position the Miqaat barcode in front of your camera.
          </CardDescription>
        </CardHeader>
        <CardContent className="aspect-video bg-muted rounded-md overflow-hidden flex items-center justify-center">
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
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-4 pt-6">
          {hasCameraPermission === false && (
             <Alert variant="destructive" className="w-full">
              <AlertTitle>Camera Not Working</AlertTitle>
              <AlertDescription>
                Could not access the camera. Please ensure it's connected and permissions are granted in your browser settings.
              </AlertDescription>
            </Alert>
          )}
          {/* Placeholder for actual scan button or automatic detection */}
          <Button className="w-full sm:w-auto" disabled={!hasCameraPermission}>
            <Camera className="mr-2 h-4 w-4" />
            Scan (Placeholder)
          </Button>
          <p className="text-xs text-muted-foreground">
            Scanning will happen automatically once a barcode is detected.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
