
"use client";

// This page has been intentionally cleared as per user request.
// The "Scan My QR" functionality was removed from the user dashboard.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function ScanAttendancePageRemoved() {
  const router = useRouter();

  useEffect(() => {
    // Redirect users away from this page as it's no longer active
    router.replace('/dashboard'); 
  }, [router]);

  return (
    <div className="flex flex-col flex-1 items-center justify-center h-full">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="mt-4 text-muted-foreground">This page is no longer available. Redirecting...</p>
    </div>
  );
}
