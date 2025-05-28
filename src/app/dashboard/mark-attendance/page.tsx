
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import type { Miqaat, User, MarkedAttendanceEntry } from "@/types";
import { getUserByItsOrBgkId } from "@/lib/firebase/userService"; // Import Firestore service
import { CheckCircle, AlertCircle, Users, ListChecks, Loader2 } from "lucide-react";

// Mock Miqaat data (in a real app, this would be fetched from Firestore)
const mockMiqaats: Pick<Miqaat, "id" | "name" | "startTime">[] = [
  { id: "m1", name: "Miqaat Al-Layl", startTime: new Date(2024, 9, 10, 19, 0).toISOString()},
  { id: "m2", name: "Ashara Mubarakah - Day 1", startTime: new Date(2024, 9, 15, 9, 0).toISOString() },
  { id: "m3", name: "Eid Majlis", startTime: new Date(2024, 10, 1, 8, 0).toISOString() },
  { id: "m4", name: "Weekly Majlis", startTime: new Date().toISOString() }, // A current miqaat
];

export default function MarkAttendancePage() {
  const [selectedMiqaatId, setSelectedMiqaatId] = useState<string | null>(null);
  const [memberIdInput, setMemberIdInput] = useState("");
  const [markedAttendance, setMarkedAttendance] = useState<MarkedAttendanceEntry[]>([]);
  const [availableMiqaats, setAvailableMiqaats] = useState<Pick<Miqaat, "id" | "name" | "startTime">[]>([]);
  const [isSearchingMember, setIsSearchingMember] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    // Simulate fetching miqaats (replace with Firestore fetch later)
    setAvailableMiqaats(mockMiqaats.sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()));
  }, []);

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

    setIsSearchingMember(true);
    let member: User | null = null;
    try {
      member = await getUserByItsOrBgkId(memberIdInput.trim());
    } catch (error) {
      toast({ title: "Database Error", description: "Could not verify member ID.", variant: "destructive" });
      setIsSearchingMember(false);
      return;
    }
    setIsSearchingMember(false);

    const selectedMiqaat = availableMiqaats.find(m => m.id === selectedMiqaatId);

    if (!member) {
      toast({
        title: "Member Not Found",
        description: `No member found with ID: ${memberIdInput} in the database.`,
        variant: "destructive",
      });
      return;
    }
    
    if (!selectedMiqaat) {
        toast({ title: "Error", description: "Selected Miqaat details not found.", variant: "destructive" });
        return;
    }

    const alreadyMarked = markedAttendance.find(
      (entry) => entry.miqaatId === selectedMiqaatId && entry.memberItsId === member.itsId
    );

    if (alreadyMarked) {
      toast({
        title: "Already Marked",
        description: `${member.name} (${member.itsId}) has already been marked for ${selectedMiqaat.name}.`,
        variant: "default",
      });
      setMemberIdInput(""); 
      return;
    }

    const newEntry: MarkedAttendanceEntry = {
      memberItsId: member.itsId,
      memberName: member.name,
      timestamp: new Date(),
      miqaatId: selectedMiqaat.id,
      miqaatName: selectedMiqaat.name,
    };

    setMarkedAttendance(prev => [newEntry, ...prev]);
    toast({
      title: "Attendance Marked",
      description: `${member.name} (${member.itsId}) marked present for ${selectedMiqaat.name}.`,
    });
    setMemberIdInput(""); 
  };

  const currentMiqaatAttendance = markedAttendance.filter(entry => entry.miqaatId === selectedMiqaatId);

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center"><ListChecks className="mr-2 h-6 w-6 text-primary" />Mark Member Attendance</CardTitle>
          <CardDescription>Select a Miqaat and enter member ITS/BGK ID to mark them present.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-1 space-y-2">
              <Label htmlFor="miqaat-select">Select Miqaat</Label>
              <Select onValueChange={setSelectedMiqaatId} value={selectedMiqaatId || undefined}>
                <SelectTrigger id="miqaat-select">
                  <SelectValue placeholder="Choose a Miqaat" />
                </SelectTrigger>
                <SelectContent>
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
                disabled={!selectedMiqaatId || isSearchingMember}
              />
            </div>
            <Button 
              onClick={handleMarkAttendance} 
              disabled={!selectedMiqaatId || !memberIdInput || isSearchingMember}
              className="w-full md:w-auto"
            >
              {isSearchingMember ? (
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
                    Attendance for: {availableMiqaats.find(m => m.id === selectedMiqaatId)?.name || 'Selected Miqaat'}
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
        {!selectedMiqaatId && (
            <CardFooter>
                <p className="text-sm text-muted-foreground flex items-center">
                    <AlertCircle className="mr-2 h-4 w-4" /> Please select a Miqaat to begin marking attendance.
                </p>
            </CardFooter>
        )}
      </Card>
    </div>
  );
}
