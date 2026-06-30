"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { UserRole } from "@/types";
import { db, getYearPath } from "@/lib/firebase/firebase";
import { collection, query, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import { ShieldAlert, Mail, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Search, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { findNavItem } from "@/components/dashboard/sidebar-nav";
import { FunkyLoader } from "@/components/ui/funky-loader";

interface EmailLog {
  id: string;
  to: string;
  subject: string;
  status: 'success' | 'failed';
  timestamp: string;
  error?: string | null;
  snippet?: string;
}

const ITEMS_PER_PAGE = 20;

export default function EmailLogsPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const role = typeof window !== 'undefined' ? localStorage.getItem('userRole') as UserRole : null;
    const pageRights = JSON.parse(localStorage.getItem('userPageRights') || '[]');
    const navItem = findNavItem('/dashboard/email-logs');
    
    if (navItem) {
        const hasRoleAccess = navItem.allowedRoles?.includes(role || 'user');
        const hasPageRight = pageRights.includes(navItem.href);
        if (hasRoleAccess || hasPageRight) {
            setIsAuthorized(true);
        } else {
            setIsAuthorized(false);
            setTimeout(() => router.replace('/dashboard'), 2000);
        }
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
    
    const emailLogsCollectionRef = collection(db, getYearPath('email_logs'));
    const q = query(emailLogsCollectionRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const fetchedLogs = querySnapshot.docs.map(docSnapshot => {
            const data = docSnapshot.data();
            const timestamp = data.timestamp instanceof Timestamp
                              ? data.timestamp.toDate().toISOString()
                              : new Date().toISOString();
            return { 
              id: docSnapshot.id,
              to: data.to || 'N/A',
              subject: data.subject || 'N/A',
              status: data.status || 'success',
              error: data.error || null,
              snippet: data.snippet || '',
              timestamp 
            } as EmailLog;
        });
        setLogs(fetchedLogs);
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching email logs:", error);
        toast({ title: "Error", description: "Could not load email logs.", variant: "destructive" });
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [isAuthorized, toast]);

  // Filter logs by search query
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const lowerQuery = searchQuery.toLowerCase();
    return logs.filter(log => 
      log.to.toLowerCase().includes(lowerQuery) || 
      log.subject.toLowerCase().includes(lowerQuery) ||
      (log.error && log.error.toLowerCase().includes(lowerQuery))
    );
  }, [logs, searchQuery]);

  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const currentLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredLogs.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredLogs, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handlePreviousPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
  const handleNextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  
  if (isAuthorized === null || isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <FunkyLoader size="lg">Loading Email Logs...</FunkyLoader>
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
              <CardTitle className="flex items-center">
                <Mail className="mr-2 h-5 w-5 text-primary"/>
                Email Logs
              </CardTitle>
              <CardDescription className="mt-1">
                A historical log of all automated emails dispatched by the system (OTPs, notifications, and confirmations).
              </CardDescription>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search recipient or subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {currentLogs.length === 0 ? (
            <div className="text-center py-10">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-lg font-medium">No Email Logs Found</p>
              <p className="text-sm text-muted-foreground">Try adjusting your search filters or check back later.</p>
            </div>
          ) : (
             <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
                {currentLogs.map(log => (
                    <div 
                      key={log.id} 
                      className={`flex flex-col rounded-lg border p-4 transition-all duration-200 ${
                        log.status === 'failed' ? 'border-destructive/30 bg-destructive/5' : 'border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          {log.status === 'success' ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                          )}
                          <div className="space-y-1">
                            <p className="font-semibold text-foreground text-sm md:text-base">{log.subject}</p>
                            <p className="text-xs md:text-sm text-muted-foreground">
                              Recipient: <span className="font-medium text-foreground">{log.to}</span>
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {format(new Date(log.timestamp), "PPpp")}
                            </p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                        >
                          {expandedLogId === log.id ? (
                            <EyeOff className="h-4 w-4 mr-1" />
                          ) : (
                            <Eye className="h-4 w-4 mr-1" />
                          )}
                          Details
                        </Button>
                      </div>

                      {expandedLogId === log.id && (
                        <div className="mt-4 pt-4 border-t border-dashed space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                          {log.snippet && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Body Excerpt</p>
                              <div className="bg-muted p-3 rounded-md text-xs font-mono text-muted-foreground leading-relaxed">
                                {log.snippet}
                              </div>
                            </div>
                          )}
                          
                          {log.status === 'failed' && log.error && (
                            <div>
                              <p className="text-xs font-semibold text-destructive uppercase tracking-wider mb-1">Error Trace</p>
                              <div className="bg-destructive/10 text-destructive p-3 rounded-md text-xs font-mono">
                                {log.error}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-between items-center pt-4 gap-2">
          <p className="text-xs text-muted-foreground">
            Showing {filteredLogs.length > 0 ? ((currentPage - 1) * ITEMS_PER_PAGE) + 1 : 0} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredLogs.length)} of {filteredLogs.length} logs
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
