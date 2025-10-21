
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { AuditLog, UserRole } from "@/types";
import { db } from "@/lib/firebase/firebase";
import { collection, query, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import { Loader2, ShieldAlert, Shield, Trash2, AlertTriangle, FileWarning, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { allNavItems, findNavItem } from "@/components/dashboard/sidebar-nav";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { FunkyLoader } from "@/components/ui/funky-loader";

const ITEMS_PER_PAGE = 20;

export default function AuditLogsPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const role = typeof window !== "undefined" ? localStorage.getItem('userRole') as UserRole : null;
    const navItem = findNavItem('/dashboard/audit-logs');
    
    if (navItem && navItem.allowedRoles?.includes(role || 'user')) {
      setIsAuthorized(true);
    } else {
      setIsAuthorized(false);
      setTimeout(() => router.replace('/dashboard'), 2000);
    }
  }, [router]);

  useEffect(() => {
    if (!isAuthorized) {
        setIsLoading(false);
        return;
    }
    const auditLogsCollectionRef = collection(db, 'audit_logs');
    const q = query(auditLogsCollectionRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const fetchedLogs = querySnapshot.docs.map(docSnapshot => {
            const data = docSnapshot.data();
            const timestamp = data.timestamp instanceof Timestamp
                              ? data.timestamp.toDate().toISOString()
                              : new Date().toISOString();
            return { ...data, id: docSnapshot.id, timestamp } as AuditLog;
        });
        setLogs(fetchedLogs);
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching audit logs:", error);
        toast({ title: "Error", description: "Could not load audit logs.", variant: "destructive" });
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [isAuthorized, toast]);
  
  const totalPages = Math.ceil(logs.length / ITEMS_PER_PAGE);
  const currentLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return logs.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [logs, currentPage]);

  const handlePreviousPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
  const handleNextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));


  const getLogLevelIcon = (level: 'info' | 'warning' | 'error' | 'critical') => {
    switch (level) {
      case 'info':
        return <CheckCircle className="h-5 w-5 text-blue-500 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />;
      case 'error':
        return <FileWarning className="h-5 w-5 text-orange-500 shrink-0" />;
      case 'critical':
        return <ShieldAlert className="h-5 w-5 text-red-500 shrink-0" />;
      default:
        return <CheckCircle className="h-5 w-5 text-gray-500 shrink-0" />;
    }
  };
  
  if (isAuthorized === null || isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <FunkyLoader size="lg">Loading Audit Logs...</FunkyLoader>
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
        <p className="text-muted-foreground mt-2">You do not have permissions to view this page.</p>
        <p className="text-sm text-muted-foreground mt-1">Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center"><Shield className="mr-2 h-5 w-5 text-primary"/>Audit Logs</CardTitle>
              <CardDescription className="mt-1">A log of all administrative actions taken in the system. Updates in real-time.</CardDescription>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={true}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear All Logs (Coming Soon)
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                  <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>This will permanently delete all audit logs. This action is irreversible and not recommended.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive hover:bg-destructive/90">Delete All Logs</AlertDialogAction>
                  </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        <CardContent>
          {currentLogs.length === 0 ? (
            <div className="text-center py-10">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <p className="mt-4 text-lg font-medium">No Admin Actions Logged</p>
              <p className="text-sm text-muted-foreground">No administrative actions have been recorded yet.</p>
            </div>
          ) : (
             <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
                {currentLogs.map(log => (
                    <div key={log.id} className="flex items-start gap-4 rounded-lg border p-4">
                        {getLogLevelIcon(log.level)}
                        <div className="flex-grow">
                            <p className="font-semibold text-card-foreground">{log.action}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Performed by: <span className="font-medium text-foreground">{log.actorName}</span> ({log.actorItsId})
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">{format(new Date(log.timestamp), "PPpp")}</p>
                            {log.context && (
                                <pre className="mt-2 text-xs bg-muted p-2 rounded-md whitespace-pre-wrap font-mono max-h-40 overflow-auto">
                                    {JSON.stringify(log.context, null, 2)}
                                </pre>
                            )}
                        </div>
                    </div>
                ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-between items-center pt-4 gap-2">
          <p className="text-xs text-muted-foreground">
            Showing {currentLogs.length > 0 ? ((currentPage - 1) * ITEMS_PER_PAGE) + 1 : 0} - {Math.min(currentPage * ITEMS_PER_PAGE, logs.length)} of {logs.length} logs
          </p>
          {totalPages > 1 && (
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={currentPage === 1}>
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
