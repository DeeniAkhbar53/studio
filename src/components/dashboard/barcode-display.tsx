
"use client";

import Image from 'next/image';
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
          {/* In a real app, this would be a dynamically generated barcode image */}
          <Image 
            src={`https://placehold.co/250x250.png?text=${encodeURIComponent(barcodeData)}`} 
            alt={`Barcode for ${miqaatName}`} 
            width={250} 
            height={250} 
            data-ai-hint="barcode code"
            className="rounded"
          />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Data: {barcodeData}</p>
      </CardContent>
    </Card>
  );
}
