
"use client";

import type { Miqaat } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Users, Barcode, Edit, Trash2 } from "lucide-react";
import { QRCodeSVG } from 'qrcode.react'; // Import QRCodeSVG
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

  const formattedStartDate = new Date(miqaat.startTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  const formattedEndDate = new Date(miqaat.endTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <>
      <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col">
        <CardHeader>
          <CardTitle className="text-xl">{miqaat.name}</CardTitle>
          <CardDescription>{miqaat.location || "Location not specified"}</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow space-y-3">
          <div className="flex items-center text-sm text-muted-foreground">
            <CalendarDays className="mr-2 h-4 w-4 text-primary" />
            <span>{formattedStartDate} - {formattedEndDate}</span>
          </div>
          <div className="flex items-center text-sm text-muted-foreground">
            <Users className="mr-2 h-4 w-4 text-primary" />
            <span>Teams: {miqaat.teams.join(", ") || "N/A"}</span>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center border-t pt-4 mt-auto">
          <Button variant="outline" size="sm" onClick={() => setShowBarcodeDialog(true)} disabled={!(miqaat.barcodeData || miqaat.id)}>
            <Barcode className="mr-2 h-4 w-4" />
            Barcode
          </Button>
          <div className="space-x-2">
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

      {/* Barcode Dialog */}
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
                size={200} // Adjust size as needed
                bgColor={"#ffffff"}
                fgColor={"#000000"}
                level={"Q"} // Error correction level
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
