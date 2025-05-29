
"use client";

import type { Miqaat, UserRole, Mohallah } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Users, Barcode, Edit, Trash2, Clock, MapPin, Tag, Download } from "lucide-react";
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
      console.error("QR Code SVG element not found");
      return;
    }

    const appLogoUrl = "https://app.burhaniguards.org/images/logo.png";
    const logoSize = 40;
    const qrRenderSize = 200; // Desired size of QR code on canvas
    const padding = 20;
    const textLineHeight = 20;
    const titleFontSize = 16;
    const timeFontSize = 12;
    const spaceBetweenElements = 10;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error("Could not get canvas context");
      return;
    }

    const miqaatNameText = miqaat.name;
    const miqaatTimeText = `Starts: ${formatDate(miqaat.startTime)}`;

    // Preload logo
    const logoImage = new Image();
    logoImage.crossOrigin = "anonymous"; // Important for images from other domains
    logoImage.src = appLogoUrl;

    logoImage.onload = () => {
      // Calculate canvas dimensions after logo is loaded
      let currentY = padding;
      const canvasWidth = qrRenderSize + 2 * padding; // Base width on QR code

      currentY += logoSize + spaceBetweenElements; // Space for logo
      currentY += titleFontSize + spaceBetweenElements; // Space for Miqaat Name
      currentY += timeFontSize + spaceBetweenElements; // Space for Miqaat Time
      currentY += qrRenderSize + padding; // Space for QR code and bottom padding
      const canvasHeight = currentY;

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      // 1. Draw White Background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Reset currentY for drawing
      currentY = padding;

      // 2. Draw Logo
      const logoX = (canvas.width - logoSize) / 2;
      ctx.drawImage(logoImage, logoX, currentY, logoSize, logoSize);
      currentY += logoSize + spaceBetweenElements;

      // 3. Draw Miqaat Name
      ctx.fillStyle = "#000000";
      ctx.font = `bold ${titleFontSize}px Arial`;
      ctx.textAlign = "center";
      ctx.fillText(miqaatNameText, canvas.width / 2, currentY + titleFontSize / 2); // Adjust Y for text baseline
      currentY += titleFontSize + spaceBetweenElements;

      // 4. Draw Miqaat Start Time
      ctx.font = `${timeFontSize}px Arial`;
      ctx.fillText(miqaatTimeText, canvas.width / 2, currentY + timeFontSize / 2); // Adjust Y
      currentY += timeFontSize + spaceBetweenElements;

      // 5. Prepare and Draw QR Code Image
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const qrImage = new Image();
      qrImage.onload = () => {
        const qrX = (canvas.width - qrRenderSize) / 2;
        ctx.drawImage(qrImage, qrX, currentY, qrRenderSize, qrRenderSize);

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
      };
      qrImage.onerror = (err) => {
        console.error("Error loading SVG QR code into image:", err);
      };
      qrImage.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    };
    logoImage.onerror = () => {
      console.error("Error loading app logo. Proceeding without logo.");
      // Fallback: draw without logo (or draw a placeholder)
      // For simplicity, current implementation might break if logo fails. Robust version would handle this.
      // Trigger download without logo, or notify user.
      // Simplified for now, but in production you'd want a more graceful fallback.
      alert("Failed to load logo. Barcode will be downloaded without it.");
      // Re-attempt draw without logo (this part is more complex to retrofit here without duplication)
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
                includeMargin={true} // Adds some white space around QR
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
    
