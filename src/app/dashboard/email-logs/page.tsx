"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { UserRole, Miqaat } from "@/types";
import { ShieldAlert, Mail, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Search, Eye, AlertTriangle, RefreshCw, Loader2, Calendar, MapPin, Users, Award, Percent } from "lucide-react";
import { format } from "date-fns";
import { findNavItem } from "@/components/dashboard/sidebar-nav";
import { FunkyLoader } from "@/components/ui/funky-loader";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { db, getYearPath } from "@/lib/firebase/firebase";
import { collection, query, orderBy, getDocs } from "firebase/firestore";

interface EmailLog {
  id: string; // This corresponds to the IMAP UID
  to: string;
  subject: string;
  status: 'success' | 'failed';
  timestamp: string;
  error?: string | null;
  snippet?: string;
}

const LIMIT_OPTIONS = ["10", "25", "50", "100"];

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
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Miqaat and Limit states
  const [miqaatsList, setMiqaatsList] = useState<Miqaat[]>([]);
  const [selectedMiqaatId, setSelectedMiqaatId] = useState<string>("all");
  const [selectedLimit, setSelectedLimit] = useState<string>("50");

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

  // Fetch Miqaats list from Firestore
  useEffect(() => {
    if (!isAuthorized) return;
    const fetchMiqaats = async () => {
      try {
        const miqaatsCol = collection(db, getYearPath('miqaats'));
        const q = query(miqaatsCol, orderBy('startTime', 'desc'));
        const snap = await getDocs(q);
        const list = snap.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        })) as Miqaat[];
        setMiqaatsList(list);
      } catch (err) {
        console.error("Failed to load miqaats list:", err);
      }
    };
    fetchMiqaats();
  }, [isAuthorized]);

  // Find currently selected Miqaat object
  const selectedMiqaatDetails = useMemo(() => {
    if (selectedMiqaatId === "all") return null;
    return miqaatsList.find(m => m.id === selectedMiqaatId) || null;
  }, [miqaatsList, selectedMiqaatId]);

  // Function to fetch email logs from API with filters
  const fetchEmailLogs = useCallback(async (showToast = false) => {
    setIsRefreshing(true);
    try {
      const role = localStorage.getItem('userRole') || '';
      
      let fetchUrl = `/api/email-logs/fetch?limit=${selectedLimit}`;
      if (selectedMiqaatDetails) {
        fetchUrl += `&miqaatName=${encodeURIComponent(selectedMiqaatDetails.name)}`;
      }

      const response = await fetch(fetchUrl, {
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
  }, [selectedLimit, selectedMiqaatDetails, toast]);

  // Trigger fetch when limit or selected Miqaat changes
  useEffect(() => {
    if (isAuthorized) {
      fetchEmailLogs();
    }
  }, [isAuthorized, selectedMiqaatId, selectedLimit, fetchEmailLogs]);

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

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const currentLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLogs, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage]);

  const handlePreviousPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
  const handleNextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));

  // Compute stats for selected Miqaat
  const miqaatStats = useMemo(() => {
    if (!selectedMiqaatDetails) return null;

    const attendance = selectedMiqaatDetails.attendance || [];
    const safarList = selectedMiqaatDetails.safarList || [];
    
    const presentCount = attendance.filter(a => a.status === 'early' || a.status === 'late' || a.status === 'present').length;
    const safarCount = safarList.length;
    
    // Uniform Compliance
    const totalWithUniformChecked = attendance.filter(a => a.uniformCompliance).length;
    const fetaCompliant = attendance.filter(a => a.uniformCompliance?.fetaPaghri === 'yes').length;
    const kotiCompliant = attendance.filter(a => a.uniformCompliance?.koti === 'yes').length;
    
    const fetaComplianceRate = totalWithUniformChecked > 0 ? Math.round((fetaCompliant / totalWithUniformChecked) * 100) : 0;
    const kotiComplianceRate = totalWithUniformChecked > 0 ? Math.round((kotiCompliant / totalWithUniformChecked) * 100) : 0;

    return {
      presentCount,
      safarCount,
      totalWithUniformChecked,
      fetaComplianceRate,
      kotiComplianceRate
    };
  }, [selectedMiqaatDetails]);
  
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
      {/* Top Header Card */}
      <Card className="shadow-lg border-primary/10">
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center text-xl md:text-2xl">
                <Mail className="mr-2 h-6 w-6 text-primary"/>
                Gmail Sent Control Center
              </CardTitle>
              <CardDescription className="mt-1">
                Monitor and sync confirmation emails directly from Gmail. No database storage footprint.
              </CardDescription>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Miqaat Filter */}
              <div className="flex flex-col w-full sm:w-60 gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">Filter by Miqaat</span>
                <Select value={selectedMiqaatId} onValueChange={setSelectedMiqaatId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Miqaat" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="all">All Miqaats / Latest</SelectItem>
                    {miqaatsList.map(miqaat => (
                      <SelectItem key={miqaat.id} value={miqaat.id}>{miqaat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Limit Filter */}
              <div className="flex flex-col w-full sm:w-28 gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">Retrieve Limit</span>
                <Select value={selectedLimit} onValueChange={setSelectedLimit}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Limit" />
                  </SelectTrigger>
                  <SelectContent>
                    {LIMIT_OPTIONS.map(opt => (
                      <SelectItem key={opt} value={opt}>Show {opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Premium Dashboard Metrics Panel (Only rendered if a specific Miqaat is selected) */}
      {selectedMiqaatDetails && miqaatStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-300">
          {/* Card 1: Event Info */}
          <Card className="shadow bg-gradient-to-br from-blue-50/50 to-indigo-50/20 dark:from-blue-950/20 dark:to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-blue-500" />
                Miqaat Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-lg font-bold text-foreground line-clamp-1">{selectedMiqaatDetails.name}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 text-blue-500" />
                <span>{selectedMiqaatDetails.location || "No location specified"}</span>
              </div>
              <div className="text-xs text-muted-foreground border-t pt-2 mt-2 space-y-1">
                <p>Start: <strong>{format(new Date(selectedMiqaatDetails.startTime), "PPp")}</strong></p>
                <p>End: <strong>{format(new Date(selectedMiqaatDetails.endTime), "PPp")}</strong></p>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Attendance Metrics */}
          <Card className="shadow bg-gradient-to-br from-green-50/50 to-emerald-50/20 dark:from-green-950/20 dark:to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                <Users className="h-4 w-4 text-green-500" />
                Attendance Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-0.5">
                  <p className="text-2xl font-black text-green-600 dark:text-green-400">{miqaatStats.presentCount}</p>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">Marked Present</p>
                </div>
                <div className="space-y-0.5 border-l pl-4">
                  <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{miqaatStats.safarCount}</p>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">On Safar</p>
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground border-t pt-2 mt-3 flex justify-between items-center">
                <span>Active Sessions:</span>
                <span className="font-semibold text-foreground">{selectedMiqaatDetails.sessions?.length || 1}</span>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Uniform Compliance & Delivery */}
          <Card className="shadow bg-gradient-to-br from-purple-50/50 to-fuchsia-50/20 dark:from-purple-950/20 dark:to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                <Award className="h-4 w-4 text-purple-500" />
                Uniform Compliance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Feta / Paghri Compliance:</span>
                  <span className="font-bold text-foreground">{miqaatStats.fetaComplianceRate}%</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-500 rounded-full transition-all duration-300"
                    style={{ width: `${miqaatStats.fetaComplianceRate}%` }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Koti Compliance:</span>
                  <span className="font-bold text-foreground">{miqaatStats.kotiComplianceRate}%</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-fuchsia-500 rounded-full transition-all duration-300"
                    style={{ width: `${miqaatStats.kotiComplianceRate}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sent Logs Card */}
      <Card className="shadow-lg">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-semibold flex items-center">
                Gmail Dispatch Logs
                {logs.length > 0 && (
                  <span className="ml-2 text-xs bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-bold">
                    Latest {logs.length} Sent
                  </span>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time connection with Gmail Sent Folder. Showing emails sent based on selected filters.
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-grow sm:w-60">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search recipient or subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => fetchEmailLogs(true)} 
                disabled={isRefreshing}
                className="gap-1.5 text-xs h-9"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                Sync
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {isRefreshing && logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground font-medium animate-pulse">Fetching sent list from Google IMAP...</p>
            </div>
          ) : currentLogs.length === 0 ? (
            <div className="text-center py-16">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-base font-semibold">No Sent Emails Located</p>
              <p className="text-xs text-muted-foreground mt-1">No sent messages match your active filters or selected Miqaat subject.</p>
            </div>
          ) : (
             <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
                {currentLogs.map(log => (
                    <div 
                      key={log.id} 
                      className={`flex flex-col rounded-lg border p-4 transition-all duration-200 ${
                        log.status === 'failed' ? 'border-destructive/30 bg-destructive/5' : 'border-border hover:bg-slate-50/50'
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
                            <p className="font-semibold text-foreground text-sm md:text-base leading-snug">{log.subject}</p>
                            <p className="text-xs text-muted-foreground">
                              Recipient: <span className="font-semibold text-foreground">{log.to}</span>
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {format(new Date(log.timestamp), "PPpp")}
                            </p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleOpenDetails(log)}
                          disabled={loadingBodyId === log.id}
                          className="h-8 text-xs shrink-0"
                        >
                          {loadingBodyId === log.id ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          ) : (
                            <Eye className="h-3.5 w-3.5 mr-1" />
                          )}
                          View Email
                        </Button>
                      </div>
                    </div>
                ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-between items-center pt-4 border-t gap-4">
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">
              Showing {filteredLogs.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} - {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of {filteredLogs.length} logs
            </p>
            <span className="text-muted-foreground text-xs">&bull;</span>
            <span className="text-xs text-muted-foreground">Page Size:</span>
            <select
              value={String(itemsPerPage)}
              onChange={(e) => setItemsPerPage(parseInt(e.target.value, 10))}
              className="text-xs bg-transparent border rounded p-0.5"
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={currentPage === 1} className="h-8">
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <span className="text-xs text-muted-foreground">Page {currentPage} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages} className="h-8">
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
