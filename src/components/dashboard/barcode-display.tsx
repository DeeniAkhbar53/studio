
"use client";

import { QRCodeSVG } from 'qrcode.react'; // Import QRCodeSVG
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface BarcodeDisplayProps {
  miqaatName: string;
  barcodeData: string;
}

export function BarcodeDisplay({ miqaatName, barcodeData }: BarcodeDisplayProps) {
  return (
    <Card className="w-full max-w-md mx-auto shadow-lg">
      <CardHeader>
        <CardTitle>Barcode: {miqaatName}</CardTitle>
        <CardDescription>Use this barcode for attendance marking.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center p-6">
        <div className="p-4 bg-white rounded-lg shadow-inner">
          {barcodeData ? (
            <QRCodeSVG 
              value={barcodeData} 
              size={200} // Adjust size as needed
              bgColor={"#ffffff"}
              fgColor={"#000000"}
              level={"Q"} // Error correction level
            />
          ) : (
            <p className="text-muted-foreground">Barcode data not available.</p>
          )}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Data: {barcodeData || 'N/A'}</p>
      </CardContent>
    </Card>
  );
}
