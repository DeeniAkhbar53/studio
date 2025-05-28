
"use client";

import type { Miqaat } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Users, Barcode, Edit, Trash2, Clock } from "lucide-react"; 
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
import { useState } from "react";

interface MiqaatCardProps {
  miqaat: Miqaat; 
  onEdit: (miqaat: Miqaat) => void;
  onDelete: (miqaatId: string) => void;
}

export function MiqaatCard({ miqaat, onEdit, onDelete }: MiqaatCardProps) {
  const [showBarcodeDialog, setShowBarcodeDialog] = useState(false);

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
  };

  const formattedStartDate = formatDate(miqaat.startTime);
  const formattedEndDate = formatDate(miqaat.endTime);
  const formattedReportingTime = formatDate(miqaat.reportingTime);

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
            <Users className="mr-2 h-4 w-4 text-primary shrink-0" />
            <span>Teams: {miqaat.teams && miqaat.teams.length > 0 ? miqaat.teams.join(", ") : "All"}</span>
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
          <div className="flex justify-center items-center my-4 p-4 bg-white rounded-lg shadow-inner">
            {(miqaat.barcodeData || miqaat.id) ? (
              <QRCodeSVG
                value={miqaat.barcodeData || miqaat.id}
                size={200}
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
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
