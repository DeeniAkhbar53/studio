
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import type { Miqaat, User, MarkedAttendanceEntry, AttendanceRecord } from "@/types";
import { getUserByItsOrBgkId } from "@/lib/firebase/userService";
import { getMiqaats } from "@/lib/firebase/miqaatService";
import { addAttendanceRecord, AttendanceDataForAdd } from "@/lib/firebase/attendanceService"; // Import attendance service
import { CheckCircle, AlertCircle, Users, ListChecks, Loader2 } from "lucide-react";

export default function MarkAttendancePage() {
  const [selectedMiqaatId, setSelectedMiqaatId] = useState<string | null>(null);
  const [memberIdInput, setMemberIdInput] = useState("");
  const [markedAttendance, setMarkedAttendance] = useState<MarkedAttendanceEntry[]>([]); // For current session display
  const [availableMiqaats, setAvailableMiqaats] = useState<Pick<Miqaat, "id" | "name" | "startTime">[]>([]);
  const [isLoadingMiqaats, setIsLoadingMiqaats] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false); // Combined loading state
  const [markerItsId, setMarkerItsId] = useState<string | null>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedMarkerItsId = localStorage.getItem('userItsId');
      setMarkerItsId(storedMarkerItsId);
    }
  }, []);

  useEffect(() => {
    const fetchMiqaats = async () => {
      setIsLoadingMiqaats(true);
      try {
        const fetchedMiqaats = await getMiqaats();
        setAvailableMiqaats(fetchedMiqaats.map(m => ({ id: m.id, name: m.name, startTime: m.startTime })));
      } catch (error) {
        toast({ title: "Error", description: "Failed to load Miqaats.", variant: "destructive" });
        console.error("Failed to load Miqaats for attendance marking:", error);
      } finally {
        setIsLoadingMiqaats(false);
      }
    };
    fetchMiqaats();
  }, [toast]);

  const handleMarkAttendance = async () => {
    if (!selectedMiqaatId) {
      toast({
        title: "Miqaat Not Selected",
        description: "Please select a Miqaat before marking attendance.",
        variant: "destructive",
      });
      return;
    }
    if (!memberIdInput.trim()) {
      toast({
        title: "ITS/BGK ID Required",
        description: "Please enter the member's ITS or BGK ID.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    let member: User | null = null;
    try {
      member = await getUserByItsOrBgkId(memberIdInput.trim());
    } catch (error) {
      toast({ title: "Database Error", description: "Could not verify member ID.", variant: "destructive" });
      setIsProcessing(false);
      return;
    }

    if (!member) {
      toast({
        title: "Member Not Found",
        description: `No member found with ID: ${memberIdInput} in the database.`,
        variant: "destructive",
      });
      setIsProcessing(false);
      return;
    }
    
    const selectedMiqaat = availableMiqaats.find(m => m.id === selectedMiqaatId);
    if (!selectedMiqaat) {
        toast({ title: "Error", description: "Selected Miqaat details not found.", variant: "destructive" });
        setIsProcessing(false);
        return;
    }

    const alreadyMarkedInSession = markedAttendance.find(
      (entry) => entry.miqaatId === selectedMiqaatId && entry.memberItsId === member.itsId
    );

    if (alreadyMarkedInSession) {
      toast({
        title: "Already Marked in Session",
        description: `${member.name} (${member.itsId}) has already been marked for ${selectedMiqaat.name} in this session.`,
        variant: "default",
      });
      setMemberIdInput(""); 
      setIsProcessing(false);
      return;
    }
    
    // Prepare record for Firestore
    const attendanceRecordPayload: AttendanceDataForAdd = {
        miqaatId: selectedMiqaat.id,
        miqaatName: selectedMiqaat.name,
        userItsId: member.itsId,
        userName: member.name,
        ...(markerItsId && { markedByItsId: markerItsId }) // Add marker ID if available
    };

    try {
        await addAttendanceRecord(attendanceRecordPayload);

        // If Firestore save is successful, update local state for session display
        const newSessionEntry: MarkedAttendanceEntry = {
          memberItsId: member.itsId,
          memberName: member.name,
          timestamp: new Date(), // Local timestamp for session display
          miqaatId: selectedMiqaat.id,
          miqaatName: selectedMiqaat.name,
        };
        setMarkedAttendance(prev => [newSessionEntry, ...prev]);
        
        toast({
          title: "Attendance Marked",
          description: `${member.name} (${member.itsId}) marked present for ${selectedMiqaat.name}. Record saved to database.`,
        });
        setMemberIdInput(""); 
    } catch (dbError) {
        console.error("Failed to save attendance to database:", dbError);
        toast({
            title: "Database Error",
            description: "Failed to save attendance record. Please try again.",
            variant: "destructive",
        });
    } finally {
        setIsProcessing(false);
    }
  };

  const currentMiqaatAttendance = markedAttendance.filter(entry => entry.miqaatId === selectedMiqaatId);
  const currentSelectedMiqaatName = availableMiqaats.find(m => m.id === selectedMiqaatId)?.name || 'Selected Miqaat';

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center"><ListChecks className="mr-2 h-6 w-6 text-primary" />Mark Member Attendance</CardTitle>
          <CardDescription>Select a Miqaat and enter member ITS/BGK ID to mark them present. Records are saved to the database.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-1 space-y-2">
              <Label htmlFor="miqaat-select">Select Miqaat</Label>
              <Select 
                onValueChange={(value) => {
                  setSelectedMiqaatId(value);
                  setMarkedAttendance([]); // Clear session attendance when Miqaat changes
                }} 
                value={selectedMiqaatId || undefined}
                disabled={isLoadingMiqaats || isProcessing}
              >
                <SelectTrigger id="miqaat-select">
                  <SelectValue placeholder={isLoadingMiqaats ? "Loading Miqaats..." : "Choose a Miqaat"} />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingMiqaats && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                  {!isLoadingMiqaats && availableMiqaats.length === 0 && <SelectItem value="no-miqaats" disabled>No Miqaats available</SelectItem>}
                  {availableMiqaats.map(miqaat => (
                    <SelectItem key={miqaat.id} value={miqaat.id}>
                      {miqaat.name} ({new Date(miqaat.startTime).toLocaleDateString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-1 space-y-2">
              <Label htmlFor="member-id">ITS / BGK ID</Label>
              <Input
                id="member-id"
                placeholder="Enter 8-digit ITS or BGK ID"
                value={memberIdInput}
                onChange={(e) => setMemberIdInput(e.target.value)}
                disabled={!selectedMiqaatId || isProcessing || isLoadingMiqaats}
              />
            </div>
            <Button 
              onClick={handleMarkAttendance} 
              disabled={!selectedMiqaatId || !memberIdInput || isProcessing || isLoadingMiqaats}
              className="w-full md:w-auto"
            >
              {isProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
               Mark Present
            </Button>
          </div>
          
          {selectedMiqaatId && (
            <div className="mt-6 pt-6 border-t">
                <h3 className="text-lg font-semibold mb-2 flex items-center">
                    <Users className="mr-2 h-5 w-5 text-primary" />
                    Attendance for: {currentSelectedMiqaatName} (This Session)
                </h3>
                <p className="text-muted-foreground mb-4">
                    Total marked in this session: <span className="font-bold text-foreground">{currentMiqaatAttendance.length}</span>
                </p>
                {currentMiqaatAttendance.length > 0 ? (
                    <div className="max-h-60 overflow-y-auto rounded-md border">
                        <Table>
                            <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>ITS ID</TableHead>
                                <TableHead>Time Marked</TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {currentMiqaatAttendance.map((entry) => (
                                <TableRow key={`${entry.memberItsId}-${entry.timestamp.toISOString()}`}>
                                <TableCell className="font-medium">{entry.memberName}</TableCell>
                                <TableCell>{entry.memberItsId}</TableCell>
                                <TableCell>{entry.timestamp.toLocaleTimeString()}</TableCell>
                                </TableRow>
                            ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No members marked yet for this Miqaat in this session.</p>
                )}
            </div>
          )}
        </CardContent>
        {!selectedMiqaatId && !isLoadingMiqaats && (
            <CardFooter>
                <p className="text-sm text-muted-foreground flex items-center">
                    <AlertCircle className="mr-2 h-4 w-4" /> Please select a Miqaat to begin marking attendance.
                </p>
            </CardFooter>
        )}
         {isLoadingMiqaats && (
            <CardFooter>
                <p className="text-sm text-muted-foreground flex items-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading Miqaats...
                </p>
            </CardFooter>
        )}
      </Card>
    </div>
  );
}
