
"use client";

import type { Miqaat, UserRole, Mohallah } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Users, Barcode, Edit, Trash2, Clock, MapPin, Tag, Download, Shirt } from "lucide-react";
import { QRCodeSVG } from 'qrcode.react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

interface MiqaatCardProps {
  miqaat: Miqaat;
  onEdit: (miqaat: Miqaat) => void;
  onDelete: (miqaatId: string) => void;
  currentUserRole: UserRole | null;
  allMohallahs: Mohallah[];
}

export function MiqaatCard({ miqaat, onEdit, onDelete, currentUserRole, allMohallahs }: MiqaatCardProps) {
  const [showBarcodeDialog, setShowBarcodeDialog] = useState(false);
  const qrCodeDisplayRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
  };

  const formatDateForFilename = (isoDateString?: string): string => {
    if (!isoDateString) return 'nodate';
    const date = new Date(isoDateString);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatUniformType = (type?: Miqaat['uniformType']) => {
    if (!type) return "Attendance Only";
    switch(type) {
        case 'feta_paghri': return "Feta/Paghri";
        case 'koti': return "Koti";
        case 'safar': return "Safar (Full)";
        case 'attendance_only':
        default:
            return "Attendance Only";
    }
  };

  const formattedStartDate = formatDate(miqaat.startTime);
  const formattedEndDate = formatDate(miqaat.endTime);
  const formattedReportingTime = formatDate(miqaat.reportingTime);
  const canManageMiqaat = currentUserRole === 'admin' || currentUserRole === 'superadmin';

  const assignedMohallahNames = miqaat.mohallahIds && miqaat.mohallahIds.length > 0
    ? miqaat.mohallahIds.map(id => allMohallahs.find(m => m.id === id)?.name || 'Unknown ID').join(", ")
    : "All Mohallahs / Not Specified";

  const assignedTeamNames = miqaat.teams && miqaat.teams.length > 0
    ? miqaat.teams.join(", ")
    : "All Teams / Not Specified";

  const handleDownloadBarcode = async () => {
    if (!qrCodeDisplayRef.current) return;

    const svgElement = qrCodeDisplayRef.current.querySelector('svg');
    if (!svgElement) {
      console.error("QR Code SVG element not found for download.");
      toast({ title: "Error", description: "QR code element not found.", variant: "destructive" });
      return;
    }

    const appLogoUrl = "https://app.burhaniguards.org/images/logo.png";
    const logoSize = 40;
    const qrRenderSize = 200;
    const padding = 20;
    const titleFontSize = 16;
    const timeFontSize = 12;
    const spaceBetweenElements = 10;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      toast({ title: "Error", description: "Could not create image for download.", variant: "destructive" });
      return;
    }

    const miqaatNameText = miqaat.name;
    const miqaatTimeText = `Starts: ${formatDate(miqaat.startTime)}`;
    const canvasWidth = qrRenderSize + 2 * padding; // Base width on QR code

    // Function to draw content on canvas
    const drawFinalImage = (includeLogo: boolean, loadedLogoImage: HTMLImageElement | null) => {
      let currentDynamicHeight = padding; // Start with top padding

      if (includeLogo && loadedLogoImage) {
        currentDynamicHeight += logoSize + spaceBetweenElements;
      }
      currentDynamicHeight += titleFontSize + spaceBetweenElements; // For Miqaat Name
      currentDynamicHeight += timeFontSize + spaceBetweenElements;   // For Miqaat Time
      currentDynamicHeight += qrRenderSize + padding;                // For QR Code + Bottom padding

      canvas.height = currentDynamicHeight;
      canvas.width = canvasWidth;

      let yDrawPos = padding; // Y position for drawing elements

      // 1. Draw White Background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Draw Logo
      if (includeLogo && loadedLogoImage) {
        const logoX = (canvas.width - logoSize) / 2;
        ctx.drawImage(loadedLogoImage, logoX, yDrawPos, logoSize, logoSize);
        yDrawPos += logoSize + spaceBetweenElements;
      }

      // 3. Draw Miqaat Name
      ctx.fillStyle = "#000000";
      ctx.font = `bold ${titleFontSize}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(miqaatNameText, canvas.width / 2, yDrawPos);
      yDrawPos += titleFontSize + spaceBetweenElements;

      // 4. Draw Miqaat Start Time
      ctx.font = `${timeFontSize}px Arial`;
      ctx.fillText(miqaatTimeText, canvas.width / 2, yDrawPos);
      yDrawPos += timeFontSize + spaceBetweenElements;

      // 5. Prepare and Draw QR Code Image
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const qrImage = new Image();
      qrImage.onload = () => {
        const qrX = (canvas.width - qrRenderSize) / 2;
        ctx.drawImage(qrImage, qrX, yDrawPos, qrRenderSize, qrRenderSize);

        // 6. Trigger Download
        const pngFile = canvas.toDataURL('image/png');
        const miqaatNameClean = miqaat.name.replace(/[^a-z0-9_]+/gi, '_').toLowerCase();
        const datePart = formatDateForFilename(miqaat.startTime);
        const filename = `${miqaatNameClean}_${datePart}_barcode.png`;

        const downloadLink = document.createElement('a');
        downloadLink.href = pngFile;
        downloadLink.download = filename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        toast({ title: "Barcode Downloaded", description: (includeLogo && loadedLogoImage) ? "Image with logo generated." : "Image generated (logo could not be loaded)." });
      };
      qrImage.onerror = (err) => {
        console.error("Error loading SVG QR code into image during download:", err);
        toast({ title: "QR Generation Error", description: "Could not render QR code for download.", variant: "destructive" });
      };
      // Ensure SVG data is correctly formatted for data URI
      const cleanSvgData = unescape(encodeURIComponent(svgData));
      qrImage.src = 'data:image/svg+xml;base64,' + btoa(cleanSvgData);
    };

    // Attempt to load logo
    const logoImage = new Image();
    logoImage.crossOrigin = "anonymous"; // Important for cross-origin images on canvas
    logoImage.src = appLogoUrl;

    logoImage.onload = () => {
      drawFinalImage(true, logoImage);
    };

    logoImage.onerror = () => {
      console.warn("Warning: Error loading app logo. Proceeding without logo. This is likely due to CORS restrictions on the image server.");
      toast({ title: "Logo Load Failed", description: "Barcode will be generated without the app logo.", variant: "default", duration: 5000 });
      drawFinalImage(false, null); // Proceed to draw without logo
    };
  };


  return (
    <>
      <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col h-full">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">{miqaat.name}</CardTitle>
          <CardDescription>{miqaat.location || "Location not specified"}</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow space-y-2 text-sm">
          <div className="flex items-center text-muted-foreground">
            <CalendarDays className="mr-2 h-4 w-4 text-primary shrink-0" />
            <span>Start: {formattedStartDate}</span>
          </div>
          <div className="flex items-center text-muted-foreground">
            <CalendarDays className="mr-2 h-4 w-4 text-primary shrink-0" />
            <span>End: {formattedEndDate}</span>
          </div>
          {miqaat.reportingTime && (
            <div className="flex items-center text-muted-foreground">
              <Clock className="mr-2 h-4 w-4 text-primary shrink-0" />
              <span>Reporting: {formattedReportingTime}</span>
            </div>
          )}
          <div className="flex items-center text-muted-foreground">
            <Shirt className="mr-2 h-4 w-4 text-primary shrink-0" />
            <span>Uniform: {formatUniformType(miqaat.uniformType)}</span>
          </div>
          <div className="flex items-center text-muted-foreground">
            <MapPin className="mr-2 h-4 w-4 text-primary shrink-0" />
            <span>Mohallahs: {assignedMohallahNames}</span>
          </div>
           <div className="flex items-center text-muted-foreground">
            <Tag className="mr-2 h-4 w-4 text-primary shrink-0" />
            <span>Teams: {assignedTeamNames}</span>
          </div>
          <div className="flex items-center text-muted-foreground">
             <Users className="mr-2 h-4 w-4 text-primary shrink-0" />
             <span>Attendance: {miqaat.attendance?.length || 0} marked</span>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2 justify-between items-center border-t pt-4 mt-auto">
          <Button variant="outline" size="sm" onClick={() => setShowBarcodeDialog(true)} disabled={!(miqaat.barcodeData || miqaat.id)}>
            <Barcode className="mr-2 h-4 w-4" />
            Barcode
          </Button>
          { canManageMiqaat && (
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => onEdit(miqaat)} aria-label="Edit Miqaat">
                <Edit className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" aria-label="Delete Miqaat">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the Miqaat &quot;{miqaat.name}&quot;.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(miqaat.id)} className="bg-destructive hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </CardFooter>
      </Card>

      <AlertDialog open={showBarcodeDialog} onOpenChange={setShowBarcodeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Barcode for {miqaat.name}</AlertDialogTitle>
            <AlertDialogDescription>
              Scan this barcode for attendance marking.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div ref={qrCodeDisplayRef} className="flex justify-center items-center my-4 p-4 bg-white rounded-lg shadow-inner">
            {(miqaat.barcodeData || miqaat.id) ? (
              <QRCodeSVG
                value={miqaat.barcodeData || miqaat.id}
                size={250}
                bgColor={"#ffffff"}
                fgColor={"#000000"}
                level={"Q"}
                includeMargin={true}
              />
            ) : (
              <p className="text-muted-foreground">Barcode data not available.</p>
            )}
          </div>
          <p className="text-center text-sm text-muted-foreground">Data: {miqaat.barcodeData || miqaat.id || 'N/A'}</p>
          <AlertDialogFooter>
            <Button variant="outline" onClick={handleDownloadBarcode} disabled={!(miqaat.barcodeData || miqaat.id)}>
              <Download className="mr-2 h-4 w-4" />
              Download Barcode
            </Button>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
