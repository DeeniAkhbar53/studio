"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { UserRole } from "@/types";
import { ShieldAlert, Mail, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Search, Eye, AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { findNavItem } from "@/components/dashboard/sidebar-nav";
import { FunkyLoader } from "@/components/ui/funky-loader";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface EmailLog {
  id: string; // This corresponds to the IMAP UID
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
  
  // Dialog state
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Cache for loaded email bodies
  const [cachedBodies, setCachedBodies] = useState<Record<string, string>>({});
  const [loadingBodyId, setLoadingBodyId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);

  // Authenticate user role client-side
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

  // Function to fetch email logs from API
  const fetchEmailLogs = async (showToast = false) => {
    setIsRefreshing(true);
    try {
      const role = localStorage.getItem('userRole') || '';
      const response = await fetch('/api/email-logs/fetch', {
        method: 'GET',
        headers: {
          'x-user-role': role
        }
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        setLogs(data.logs || []);
        if (showToast) {
          toast({ title: "Success", description: "Email logs synchronized with Gmail." });
        }
      } else {
        throw new Error(data.error || 'Failed to fetch logs');
      }
    } catch (error: any) {
      console.error("Error loading email logs:", error);
      toast({ 
        title: "Error Connecting to Gmail", 
        description: error.message || "Please check your network connection or server email configuration.", 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchEmailLogs();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorized]);

  // Load email body on demand and open details popup
  const handleOpenDetails = async (log: EmailLog) => {
    setSelectedLogId(log.id);
    setIsDialogOpen(true);

    // If the body is already loaded, don't fetch it again
    if (cachedBodies[log.id]) {
      return;
    }

    setLoadingBodyId(log.id);
    try {
      const role = localStorage.getItem('userRole') || '';
      const response = await fetch(`/api/email-logs/fetch-body?uid=${log.id}`, {
        method: 'GET',
        headers: {
          'x-user-role': role
        }
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setCachedBodies(prev => ({
          ...prev,
          [log.id]: data.body || 'No text content available.'
        }));
      } else {
        throw new Error(data.error || 'Could not load details');
      }
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Details Error",
        description: err.message || "Failed to load full email body.",
        variant: "destructive"
      });
      setIsDialogOpen(false);
    } finally {
      setLoadingBodyId(null);
    }
  };

  // Filter logs by search query
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const lowerQuery = searchQuery.toLowerCase();
    return logs.filter(log => 
      log.to.toLowerCase().includes(lowerQuery) || 
      log.subject.toLowerCase().includes(lowerQuery)
    );
  }, [logs, searchQuery]);

  const selectedLog = useMemo(() => {
    return logs.find(log => log.id === selectedLogId);
  }, [logs, selectedLogId]);

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
        <FunkyLoader size="lg">Loading Gmail Sent Mails...</FunkyLoader>
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
                Gmail Sent Logs
              </CardTitle>
              <CardDescription className="mt-1">
                Displaying sent messages directly from your system's Google Mail server. Zero database storage footprint.
              </CardDescription>
            </div>
            <div className="flex w-full md:w-auto items-center gap-3">
              <div className="relative flex-grow md:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search recipient or subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => fetchEmailLogs(true)} 
                disabled={isRefreshing}
                title="Sync with Gmail"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {currentLogs.length === 0 ? (
            <div className="text-center py-10">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-lg font-medium">No Email Records Found</p>
              <p className="text-sm text-muted-foreground">Try adjusting your search filters or check your connection status.</p>
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
                          onClick={() => handleOpenDetails(log)}
                          disabled={loadingBodyId === log.id}
                        >
                          {loadingBodyId === log.id ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Eye className="h-4 w-4 mr-1" />
                          )}
                          Details
                        </Button>
                      </div>
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

      {/* Styled Email Viewer Popup Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl w-[90vw] h-[85vh] flex flex-col p-6 gap-4">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center text-lg md:text-xl font-bold truncate">
              <Mail className="mr-2 h-5 w-5 text-primary shrink-0" />
              <span className="truncate">{selectedLog?.subject || "Email View"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Sent to: <span className="font-semibold text-foreground">{selectedLog?.to}</span> on {selectedLog ? format(new Date(selectedLog.timestamp), "PPpp") : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-grow overflow-hidden relative bg-white border rounded-md">
            {selectedLogId && loadingBodyId === selectedLogId ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-50/50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground font-medium animate-pulse">Downloading styled email from Gmail...</span>
              </div>
            ) : selectedLogId && cachedBodies[selectedLogId] ? (
              <iframe
                srcDoc={cachedBodies[selectedLogId]}
                className="w-full h-full border-0 bg-white"
                title="Email Content"
                sandbox="allow-same-origin"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                No content retrieved.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
