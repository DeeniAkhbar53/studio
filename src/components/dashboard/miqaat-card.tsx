
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
  const qrCodeDisplayRef = useRef<HTMLDivElement>(null); // Ref for the QR code displayed in dialog

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
  const canDelete = currentUserRole === 'admin' || currentUserRole === 'superadmin';

  const assignedMohallahNames = miqaat.mohallahIds && miqaat.mohallahIds.length > 0
    ? miqaat.mohallahIds.map(id => allMohallahs.find(m => m.id === id)?.name || 'Unknown ID').join(", ")
    : "All Mohallahs / Not Specified";

  const assignedTeamNames = miqaat.teams && miqaat.teams.length > 0
    ? miqaat.teams.join(", ")
    : "All Teams / Not Specified";

  const handleDownloadBarcode = () => {
    if (!qrCodeDisplayRef.current) return;

    const svgElement = qrCodeDisplayRef.current.querySelector('svg');
    if (!svgElement) {
      console.error("QR Code SVG element not found");
      return;
    }

    const qrRenderSize = 200; // Size of QR code on canvas
    const padding = 20;
    const textLineHeight = 20;
    const titleFontSize = 16;
    const timeFontSize = 12;
    const spaceBetweenTextAndQr = 15;

    const canvasWidth = qrRenderSize + 2 * padding; // Adjust canvas width if Miqaat name is very long
    const miqaatNameText = miqaat.name;
    const miqaatTimeText = `Starts: ${formatDate(miqaat.startTime)}`;

    // Estimate text height
    let textHeight = padding; // Top padding
    textHeight += textLineHeight; // For Miqaat Name
    textHeight += textLineHeight * 0.8; // For Miqaat Time (smaller font)
    textHeight += spaceBetweenTextAndQr; // Space before QR

    const canvasHeight = textHeight + qrRenderSize + padding; // Height for text, QR, and padding

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        console.error("Could not get canvas context");
        return;
    }

    // 1. Draw White Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Draw Miqaat Name
    ctx.fillStyle = "#000000";
    ctx.font = `${titleFontSize}px Arial`;
    ctx.textAlign = "center";
    let currentY = padding + titleFontSize;
    ctx.fillText(miqaatNameText, canvas.width / 2, currentY);

    // 3. Draw Miqaat Start Time
    currentY += textLineHeight * 0.8;
    ctx.font = `${timeFontSize}px Arial`;
    ctx.fillText(miqaatTimeText, canvas.width / 2, currentY);
    
    currentY += spaceBetweenTextAndQr; // Add space before QR

    // 4. Prepare and Draw QR Code Image
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const img = new Image();
    img.onload = () => {
      // Calculate QR code position
      const qrX = (canvas.width - qrRenderSize) / 2;
      const qrY = currentY;

      ctx.drawImage(img, qrX, qrY, qrRenderSize, qrRenderSize);

      // 5. Trigger Download
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
    img.onerror = (err) => {
        console.error("Error loading SVG into image:", err);
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
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
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => onEdit(miqaat)} aria-label="Edit Miqaat">
              <Edit className="h-4 w-4" />
            </Button>
            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" aria-label="Delete Miqaat" disabled={currentUserRole !== 'admin' && currentUserRole !== 'superadmin'}>
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
            )}
          </div>
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
          {/* This div is now specifically for the displayed QR in the dialog */}
          <div ref={qrCodeDisplayRef} className="flex justify-center items-center my-4 p-4 bg-white rounded-lg shadow-inner">
            {(miqaat.barcodeData || miqaat.id) ? (
              <QRCodeSVG
                value={miqaat.barcodeData || miqaat.id}
                size={250} // Size for display in dialog
                bgColor={"#ffffff"}
                fgColor={"#000000"}
                level={"Q"}
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

    