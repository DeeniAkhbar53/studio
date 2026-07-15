"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, UserX, AlertCircle, Info, ShieldAlert } from "lucide-react";
import { getMiqaats, batchMarkSafarInMiqaat } from "@/lib/firebase/miqaatService";
import { getUserByItsOrBgkId, getUsers } from "@/lib/firebase/userService";
import type { Miqaat, UserRole, MiqaatSafarEntryItem } from "@/types";
import { findNavItem } from "@/components/dashboard/sidebar-nav";
import { format } from "date-fns";

export default function BulkSafarPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [selectedMiqaatId, setSelectedMiqaatId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [allMiqaats, setAllMiqaats] = useState<Pick<Miqaat, "id" | "name" | "startTime" | "endTime" | "sessions" | "type" | "mohallahIds" | "teams" | "eligibleItsIds" | "attendance" | "safarList">[]>([]);
  const [isLoadingMiqaats, setIsLoadingMiqaats] = useState(true);
  const [miqaatTypeFilter, setMiqaatTypeFilter] = useState<'local' | 'international'>('local');

  const [bulkSafarBgkInput, setBulkSafarBgkInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [currentUserMohallahId, setCurrentUserMohallahId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [markerItsId, setMarkerItsId] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  // Authorization check
  useEffect(() => {
    const role = typeof window !== "undefined" ? localStorage.getItem('userRole') as UserRole : null;
    const pageRightsRaw = typeof window !== "undefined" ? localStorage.getItem('userPageRights') : '[]';
    const pageRights = JSON.parse(pageRightsRaw || '[]');
    const navItem = findNavItem('/dashboard/mark-attendance');
    
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

  // Load user data
  useEffect(() => {
    if (!isAuthorized) return;
    if (typeof window !== "undefined") {
      setMarkerItsId(localStorage.getItem('userItsId'));
      setCurrentUserMohallahId(localStorage.getItem('userMohallahId'));
      setCurrentUserRole(localStorage.getItem('userRole') as UserRole | null);
      setIsOffline(!navigator.onLine);
    }

    const updateOnlineStatus = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, [isAuthorized]);

  // Fetch Miqaats
  useEffect(() => {
    if (!isAuthorized) return;
    setIsLoadingMiqaats(true);
    const unsubscribe = getMiqaats((fetchedMiqaats) => {
      setAllMiqaats(fetchedMiqaats.map(m => ({
        id: m.id,
        name: m.name,
        type: m.type,
        sessions: m.sessions || [],
        startTime: m.startTime,
        endTime: m.endTime,
        mohallahIds: m.mohallahIds || [],
        teams: m.teams || [],
        eligibleItsIds: m.eligibleItsIds || [],
        attendance: m.attendance || [],
        safarList: m.safarList || [],
      })));
      setIsLoadingMiqaats(false);
    });
    return () => unsubscribe();
  }, [isAuthorized]);

  const availableMiqaatsForUser = useMemo(() => {
    if (isLoadingMiqaats) return [];
    
    let baseFiltered = allMiqaats.filter(miqaat => miqaat.type === miqaatTypeFilter);
    
    if (currentUserRole === 'superadmin') return baseFiltered;
    if (!currentUserMohallahId) return [];

    return baseFiltered.filter(miqaat => {
      if (miqaat.eligibleItsIds && miqaat.eligibleItsIds.length > 0) {
        return true; 
      }
      if (!miqaat.mohallahIds || miqaat.mohallahIds.length === 0) {
        return true; 
      }
      return miqaat.mohallahIds.includes(currentUserMohallahId);
    });
  }, [allMiqaats, currentUserMohallahId, currentUserRole, isLoadingMiqaats, miqaatTypeFilter]);

  const currentMiqaatDetails = allMiqaats.find(m => m.id === selectedMiqaatId);

  const handleBulkSafarBgkSubmit = async () => {
    if (isOffline) {
      toast({ title: "Offline Mode", description: "Marking Safar requires an active internet connection.", variant: "destructive" });
      return;
    }
    const miqaatId = selectedMiqaatId;
    if (!miqaatId) {
      toast({ title: "Selection Required", description: "Please select a Miqaat first.", variant: "destructive" });
      return;
    }

    const bgkIds = bulkSafarBgkInput
      .split(/[\s,]+/)
      .map(id => id.trim())
      .filter(id => id.length > 0);

    if (bgkIds.length === 0) {
      toast({ title: "Input Required", description: "Please enter at least one BGK ID.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const markerId = markerItsId || 'System';

      // Fetch all system users to match BGK IDs to ITS IDs
      const allUsers = await getUsers();
      const bgkToUserMap = new Map(
        allUsers
          .filter(u => u.bgkId)
          .map(u => [u.bgkId!.toLowerCase().trim(), u])
      );

      const safarEntries: MiqaatSafarEntryItem[] = [];
      const notFoundBgkIds: string[] = [];

      const currentSession = currentMiqaatDetails?.type === 'international' 
          ? currentMiqaatDetails.sessions?.find(s => s.id === selectedSessionId) 
          : currentMiqaatDetails?.sessions?.[0]; // Local Miqaat

      bgkIds.forEach(bgkId => {
        const key = bgkId.toLowerCase();
        const user = bgkToUserMap.get(key);
        if (user) {
          safarEntries.push({
            userItsId: user.itsId,
            userName: user.name,
            markedAt: new Date().toISOString(),
            markedByItsId: markerId,
            status: 'safar',
            ...(currentSession && { sessionId: currentSession.id })
          });
        } else {
          notFoundBgkIds.push(bgkId);
        }
      });

      if (safarEntries.length > 0) {
        await batchMarkSafarInMiqaat(miqaatId, safarEntries);

        // Trigger confirmation emails for each successfully marked Safar user
        safarEntries.forEach(entry => {
          fetch('/api/attendance/send-confirmation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userItsId: entry.userItsId,
              miqaatId: miqaatId,
              status: 'safar',
              markedAt: entry.markedAt,
              sessionId: entry.sessionId
            })
          }).catch(err => console.error('Failed to trigger Safar confirmation email:', err));
        });

        if (notFoundBgkIds.length > 0) {
          toast({
            title: "Bulk Safar Partial Success",
            description: `Marked ${safarEntries.length} member(s) as Safar. The following ${notFoundBgkIds.length} BGK ID(s) were not found: ${notFoundBgkIds.join(", ")}`,
            variant: "default",
          });
        } else {
          toast({
            title: "Bulk Safar Success",
            description: `Successfully marked all ${safarEntries.length} member(s) as Safar.`,
            className: 'border-green-500 bg-green-50 dark:bg-green-900/30',
          });
        }
        
        setBulkSafarBgkInput("");
      } else {
        toast({
          title: "Update Failed",
          description: `No matching members found for the provided BGK IDs: ${notFoundBgkIds.join(", ")}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error during bulk Safar marking:", error);
      toast({
        title: "Update Failed",
        description: `Could not mark members as Safar. ${error instanceof Error ? error.message : "Please try again."}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthorized === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
        <p className="text-muted-foreground mt-2">You do not have permissions to view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.push("/dashboard/mark-attendance")} className="h-9 w-9">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <UserX className="h-6 w-6 text-amber-500" />
            Bulk Safar Marking
          </h1>
          <p className="text-sm text-muted-foreground">Mark multiple members as Safar (excused absence) for a Miqaat by pasting their BGK IDs.</p>
        </div>
      </div>

      {isOffline && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="font-semibold text-destructive">Offline Mode Active</p>
              <p className="text-xs text-muted-foreground">Bulk Safar marking requires an active internet connection and is disabled offline.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="glass-surface border-white/20 shadow-md">
        <CardHeader>
          <CardTitle>Configure Bulk Safar</CardTitle>
          <CardDescription>Select a Miqaat and input member BGK IDs to update their Safar status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup 
            value={miqaatTypeFilter} 
            onValueChange={(value) => {
              setMiqaatTypeFilter(value as 'local' | 'international');
              setSelectedMiqaatId(null);
            }} 
            className="flex items-center space-x-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="local" id="local-filter" />
              <Label htmlFor="local-filter">Local</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="international" id="international-filter" />
              <Label htmlFor="international-filter">International</Label>
            </div>
          </RadioGroup>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="miqaat-select">Select Miqaat</Label>
              <Select
                onValueChange={(value) => {
                  setSelectedMiqaatId(value);
                  setSelectedSessionId(null);
                }}
                value={selectedMiqaatId || undefined}
                disabled={isLoadingMiqaats || isSubmitting || isOffline}
              >
                <SelectTrigger id="miqaat-select">
                  <SelectValue placeholder={isLoadingMiqaats ? "Loading..." : "Choose a Miqaat"} />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingMiqaats && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                  {!isLoadingMiqaats && availableMiqaatsForUser.length === 0 && <SelectItem value="no-miqaats" disabled>No Miqaats available</SelectItem>}
                  {availableMiqaatsForUser.map(miqaat => (
                    <SelectItem key={miqaat.id} value={miqaat.id}>
                      {miqaat.name} ({format(new Date(miqaat.startTime), "P")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {currentMiqaatDetails?.type === 'international' && currentMiqaatDetails.sessions && currentMiqaatDetails.sessions.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="session-select">Select Session</Label>
                <Select
                  onValueChange={setSelectedSessionId}
                  value={selectedSessionId || undefined}
                  disabled={!selectedMiqaatId || isSubmitting || isOffline}
                >
                  <SelectTrigger id="session-select">
                    <SelectValue placeholder="Choose a session" />
                  </SelectTrigger>
                  <SelectContent>
                    {currentMiqaatDetails.sessions.map(session => (
                      <SelectItem key={session.id} value={session.id}>
                        {session.name} (Day {session.day})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-safar-bgk-ids">BGK IDs</Label>
            <Textarea
              id="bulk-safar-bgk-ids"
              placeholder="e.g. BGK012, BGK045, BGK089"
              value={bulkSafarBgkInput}
              onChange={(e) => setBulkSafarBgkInput(e.target.value)}
              disabled={!selectedMiqaatId || isSubmitting || isOffline}
              rows={6}
              className="font-mono text-sm"
            />
            <span className="text-[10px] text-muted-foreground block">Enter BGK IDs separated by commas, spaces, or newlines.</span>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between border-t border-white/10 pt-6">
          <Button variant="outline" onClick={() => router.push("/dashboard/mark-attendance")} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleBulkSafarBgkSubmit} 
            disabled={!selectedMiqaatId || !bulkSafarBgkInput.trim() || isSubmitting || isOffline}
            className="font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-500/90 hover:to-amber-600/90 text-white shadow-md shadow-amber-500/20 hover:shadow-lg hover:shadow-amber-500/30 transition-all duration-200 hover:-translate-y-[1px] active:translate-y-0"
          >
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
            ) : (
              <><UserX className="mr-2 h-4 w-4" /> Mark as Safar</>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
