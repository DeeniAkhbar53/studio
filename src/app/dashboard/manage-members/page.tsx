
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Mohallah, User, UserRole, UserDesignation } from "@/types";
import { PlusCircle, Search, Edit, Trash2, FileUp, Loader2, Users as UsersIcon, Download, AlertTriangle } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Form, FormField, FormControl, FormMessage, FormItem, FormLabel as ShadFormLabel, FormDescription } from "@/components/ui/form";
import { getUsers, addUser, updateUser, deleteUser } from "@/lib/firebase/userService";
import { getMohallahs } from "@/lib/firebase/mohallahService";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent as AlertContent, AlertDialogDescription as AlertDesc, AlertDialogFooter as AlertFooter, AlertDialogHeader as AlertHeader, AlertDialogTitle as AlertTitle, AlertDialogTrigger as AlertTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle as ShadAlertTitle, AlertDescription as ShadAlertDescription } from "@/components/ui/alert";


const memberSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  itsId: z.string().min(8, "ITS ID must be 8 characters").max(8, "ITS ID must be 8 characters"),
  bgkId: z.string().optional().or(z.literal("")),
  team: z.string().optional().or(z.literal("")),
  phoneNumber: z.string().optional().or(z.literal("")),
  role: z.enum(["user", "admin", "superadmin", "attendance-marker"]),
  mohallahId: z.string().min(1, "Mohallah must be selected"),
  designation: z.enum(["Captain", "Vice Captain", "Member"]).optional().or(z.literal("")),
});

type MemberFormValues = z.infer<typeof memberSchema>;

export default function ManageMembersPage() {
  const [mohallahs, setMohallahs] = useState<Mohallah[]>([]);
  const [isLoadingMohallahs, setIsLoadingMohallahs] = useState(true);
  const [members, setMembers] = useState<User[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<User | null>(null);
  
  const [isCsvImportDialogOpen, setIsCsvImportDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [selectedFilterMohallahId, setSelectedFilterMohallahId] = useState<string>("all");
  const [fetchError, setFetchError] = useState<string | null>(null);


  const memberForm = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: { name: "", itsId: "", bgkId: "", team: "", phoneNumber: "", role: "user", mohallahId: "", designation: "Member" },
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const role = localStorage.getItem('userRole') as UserRole | null;
      setCurrentUserRole(role);
      // If user is not superadmin, they should not see "all" mohallahs by default.
      // This part depends on how you want to restrict non-superadmin views.
      // For now, the filter is only visible to superadmin.
    }
  }, []);

  const fetchAndSetMohallahs = useCallback(async () => {
    setIsLoadingMohallahs(true);
    try {
      const fetchedMohallahs = await getMohallahs();
      setMohallahs(fetchedMohallahs);
      // If it's not a superadmin or if no specific mohallah is selected for filter,
      // and if the form's mohallahId isn't set, default to the first available mohallah.
      if (fetchedMohallahs.length > 0 && !memberForm.getValues("mohallahId") && selectedFilterMohallahId === 'all') {
        memberForm.setValue("mohallahId", fetchedMohallahs[0].id);
      } else if (selectedFilterMohallahId !== 'all') {
         memberForm.setValue("mohallahId", selectedFilterMohallahId);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch Mohallahs.", variant: "destructive" });
      console.error("Failed to fetch Mohallahs:", error);
    } finally {
      setIsLoadingMohallahs(false);
    }
  }, [toast, memberForm, selectedFilterMohallahId]);

  const fetchAndSetMembers = useCallback(async () => {
    setIsLoadingMembers(true);
    setFetchError(null);
    try {
      const fetchedMembers = await getUsers(currentUserRole === 'superadmin' && selectedFilterMohallahId === 'all' ? undefined : selectedFilterMohallahId);
      setMembers(fetchedMembers);
    } catch (error: any) {
      console.error("Failed to fetch members:", error);
      if (currentUserRole === 'superadmin' && selectedFilterMohallahId === 'all' && error.message.includes("index")) {
        const specificErrorMsg = "Could not fetch all members across Mohallahs. This might be due to missing Firestore indexes for collection group queries. Please select a specific Mohallah to view and manage its members, or contact your system administrator to configure Firestore indexes (e.g., on 'itsId', 'bgkId' for the 'members' collection group).";
        setFetchError(specificErrorMsg);
        toast({ title: "Data Fetch Warning", description: specificErrorMsg, variant: "destructive", duration: 10000 });
        setMembers([]); // Clear members to prevent displaying stale data
      } else {
        toast({ title: "Error", description: "Failed to fetch members.", variant: "destructive" });
        setFetchError("Failed to fetch members. Please try again.");
      }
    } finally {
      setIsLoadingMembers(false);
    }
  }, [toast, currentUserRole, selectedFilterMohallahId]);

  useEffect(() => {
    fetchAndSetMohallahs();
  }, [fetchAndSetMohallahs]);

  useEffect(() => {
    // Fetch members when role is known AND ( (superadmin AND a mohallah filter is set) OR not a superadmin )
    // This ensures we don't try to fetch "all" if superadmin hasn't picked a filter yet, or if it fails
    if (currentUserRole) {
        fetchAndSetMembers();
    }
  }, [fetchAndSetMembers, currentUserRole, selectedFilterMohallahId]);


  useEffect(() => {
    if (editingMember) {
      memberForm.reset({
        name: editingMember.name,
        itsId: editingMember.itsId,
        bgkId: editingMember.bgkId || "",
        team: editingMember.team || "",
        phoneNumber: editingMember.phoneNumber || "",
        role: editingMember.role,
        mohallahId: editingMember.mohallahId || (mohallahs.length > 0 ? mohallahs[0].id : ""),
        designation: editingMember.designation || "Member",
      });
    } else {
      // When adding a new member, default mohallahId to the selected filter if it's not "all",
      // otherwise default to the first mohallah or empty if none.
      const defaultMohallah = selectedFilterMohallahId !== 'all' 
                              ? selectedFilterMohallahId 
                              : (mohallahs.length > 0 ? mohallahs[0].id : "");
      memberForm.reset({
        name: "", itsId: "", bgkId: "", team: "", phoneNumber: "", role: "user",
        mohallahId: defaultMohallah,
        designation: "Member",
      });
    }
  }, [editingMember, memberForm, isMemberDialogOpen, mohallahs, selectedFilterMohallahId]);

  const handleMemberFormSubmit = async (values: MemberFormValues) => {
    // mohallahId from form values is the one to use for add/update action
    const targetMohallahId = values.mohallahId;
    if (!targetMohallahId) {
        toast({ title: "Error", description: "Mohallah ID is missing.", variant: "destructive" });
        return;
    }

    const memberPayload: Omit<User, 'id' | 'avatarUrl'> & { avatarUrl?: string, designation?: UserDesignation } = {
      name: values.name,
      itsId: values.itsId,
      // Pass empty strings as is; userService will handle if they should be omitted or stored
      bgkId: values.bgkId, 
      team: values.team,
      phoneNumber: values.phoneNumber,
      role: values.role as UserRole,
      mohallahId: targetMohallahId, // Ensure this is part of the payload for denormalization
      designation: values.designation || "Member" as UserDesignation,
    };

    try {
      if (editingMember && editingMember.mohallahId) { // Ensure editingMember.mohallahId exists for update path
        await updateUser(editingMember.id, editingMember.mohallahId, memberPayload);
        toast({ title: "Member Updated", description: `"${values.name}" has been updated.` });
      } else {
        await addUser(memberPayload, targetMohallahId); // Pass targetMohallahId for subcollection path
        toast({ title: "Member Added", description: `"${values.name}" has been added to ${getMohallahNameById(targetMohallahId)}.` });
      }
      fetchAndSetMembers();
      setIsMemberDialogOpen(false);
      setEditingMember(null);
    } catch (error) {
      console.error("Error saving member:", error);
      toast({ title: "Database Error", description: `Could not save member data. ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
    }
  };

  const handleEditMember = (member: User) => {
    setEditingMember(member);
    setIsMemberDialogOpen(true);
  };

  const handleDeleteMember = async (member: User) => {
    if (!member.mohallahId) {
      toast({ title: "Error", description: "Cannot delete member: Mohallah ID is missing.", variant: "destructive" });
      return;
    }
    try {
      await deleteUser(member.id, member.mohallahId);
      toast({ title: "Member Deleted", description: `"${member.name}" has been deleted.`});
      fetchAndSetMembers();
    } catch (error) {
      console.error("Error deleting member:", error);
      toast({ title: "Database Error", description: "Could not delete member.", variant: "destructive" });
    }
  };
  
  const handleProcessCsvUpload = async () => {
    if (!selectedFile) {
        toast({ title: "No file selected", description: "Please select a CSV file to upload.", variant: "destructive" });
        return;
    }
    
    toast({ 
        title: "CSV Upload Initialized", 
        description: `File "${selectedFile.name}" selected. 
        Conceptual Process:
        1. Parse CSV data.
        2. For each row: Validate fields (name, itsId, role, mohallahName, designation are key).
        3. Convert Mohallah Name to Mohallah ID (requires fetching existing Mohallahs or ensuring CSV uses IDs).
        4. Check if ITS ID already exists IN THE TARGET MOHALLAH using getUserByItsOrBgkId (or a similar targeted check).
        5. If new, add user to the specified Mohallah's subcollection. If duplicate in that Mohallah, report error.
        6. Provide summary of successful/failed imports.
        This detailed processing is a future enhancement.`,
        duration: 15000, // Increased duration for longer message
    });
    setIsCsvImportDialogOpen(false);
    setSelectedFile(null);
  };

  const downloadSampleCsv = () => {
    const csvHeaders = "name,itsId,bgkId,team,phoneNumber,role,mohallahName,designation\n";
    const csvDummyData = [
      "Abbas Bhai,10101010,BGK001,Alpha Team,1234567890,user,Houston,Member",
      "Fatema Ben,20202020,,Bravo Team,0987654321,attendance-marker,Dallas,Vice Captain",
      "Yusuf Bhai,30303030,BGK003,Alpha Team,,admin,Houston,Captain",
    ].join("\n");
    const csvContent = csvHeaders + csvDummyData;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "sample_members_import.csv");
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
     toast({ title: "Sample CSV Downloaded", description: "Please replace dummy data with your actual member information. MohallahName must match an existing Mohallah." });
  };

  const filteredMembers = members.filter(m => {
    const searchTermMatch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            m.itsId.includes(searchTerm) ||
                            (mohallahs.find(moh => moh.id === m.mohallahId)?.name.toLowerCase() || "").includes(searchTerm.toLowerCase());
    
    // Mohallah filter is already applied at data fetching level (fetchAndSetMembers)
    // So, no additional client-side filtering by mohallahId is strictly needed here IF selectedFilterMohallahId is not 'all'.
    // However, if 'all' was fetched and errored, 'members' could be empty.
    // The `getUsers` service call now handles the mohallahId filter.
    return searchTermMatch;
  });

  const getMohallahNameById = (id?: string) => mohallahs.find(m => m.id === id)?.name || "N/A";

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center"><UsersIcon className="mr-2 h-5 w-5 text-primary"/>Manage Members</CardTitle>
            <Separator className="my-2" />
            <CardDescription>Add, view, and manage members within Mohallahs. Data from Firestore.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadSampleCsv} className="w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" /> Download Sample CSV
            </Button>
            <Button variant="outline" onClick={() => setIsCsvImportDialogOpen(true)} className="w-full sm:w-auto">
              <FileUp className="mr-2 h-4 w-4" /> Import CSV
            </Button>
            <Dialog open={isMemberDialogOpen} onOpenChange={(open) => { setIsMemberDialogOpen(open); if (!open) setEditingMember(null); }}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingMember(null); setIsMemberDialogOpen(true); }} className="w-full sm:w-auto" disabled={isLoadingMohallahs || (currentUserRole === 'superadmin' && selectedFilterMohallahId === 'all' && mohallahs.length === 0)}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add New Member
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[525px]">
                <DialogHeader>
                  <DialogTitle>{editingMember ? "Edit Member" : "Add New Member"}</DialogTitle>
                   <DialogDescription>
                    {editingMember ? "Update the details for this member." : `Fill in the details for the new member. They will be added to Mohallah: ${getMohallahNameById(memberForm.getValues("mohallahId")) || "selected Mohallah"}.`}
                  </DialogDescription>
                </DialogHeader>
                <Form {...memberForm}>
                  <form onSubmit={memberForm.handleSubmit(handleMemberFormSubmit)} className="grid gap-4 py-4">
                    <FormField control={memberForm.control} name="name" render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-x-4">
                        <ShadFormLabel htmlFor="name" className="text-right">Name</ShadFormLabel>
                        <FormControl><Input id="name" {...field} className="col-span-3" /></FormControl>
                        <FormMessage className="col-start-2 col-span-3 text-xs" />
                      </FormItem>
                    )} />
                    <FormField control={memberForm.control} name="itsId" render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-x-4">
                        <ShadFormLabel htmlFor="itsId" className="text-right">ITS ID</ShadFormLabel>
                        <FormControl><Input id="itsId" {...field} className="col-span-3" /></FormControl>
                        <FormMessage className="col-start-2 col-span-3 text-xs" />
                      </FormItem>
                    )} />
                    <FormField control={memberForm.control} name="bgkId" render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-x-4">
                        <ShadFormLabel htmlFor="bgkId" className="text-right">BGK ID</ShadFormLabel>
                        <FormControl><Input id="bgkId" {...field} className="col-span-3" placeholder="Optional" /></FormControl>
                        <FormMessage className="col-start-2 col-span-3 text-xs" />
                      </FormItem>
                    )} />
                    <FormField control={memberForm.control} name="team" render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-x-4">
                        <ShadFormLabel htmlFor="team" className="text-right">Team</ShadFormLabel>
                        <FormControl><Input id="team" {...field} className="col-span-3" placeholder="Optional" /></FormControl>
                        <FormMessage className="col-start-2 col-span-3 text-xs" />
                      </FormItem>
                    )} />
                    <FormField control={memberForm.control} name="phoneNumber" render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-x-4">
                        <ShadFormLabel htmlFor="phoneNumber" className="text-right">Phone</ShadFormLabel>
                        <FormControl><Input id="phoneNumber" {...field} className="col-span-3" placeholder="Optional" /></FormControl>
                        <FormMessage className="col-start-2 col-span-3 text-xs" />
                      </FormItem>
                    )} />
                     <FormField control={memberForm.control} name="designation" render={({ field }) => (
                        <FormItem className="grid grid-cols-4 items-center gap-x-4">
                          <ShadFormLabel htmlFor="designation" className="text-right">Designation</ShadFormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "Member"}>
                            <FormControl><SelectTrigger id="designation" className="col-span-3"><SelectValue placeholder="Select a designation" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="Member">Member</SelectItem>
                              <SelectItem value="Vice Captain">Vice Captain</SelectItem>
                              <SelectItem value="Captain">Captain</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage className="col-start-2 col-span-3 text-xs" />
                        </FormItem>
                      )} />
                    <FormField control={memberForm.control} name="role" render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-x-4">
                        <ShadFormLabel htmlFor="role" className="text-right">Role</ShadFormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger id="role" className="col-span-3"><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="attendance-marker">Attendance Marker</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="superadmin">Super Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="col-start-2 col-span-3 text-xs" />
                      </FormItem>
                    )} />
                    <FormField control={memberForm.control} name="mohallahId" render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-x-4">
                        <ShadFormLabel htmlFor="mohallahId" className="text-right">Mohallah</ShadFormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value} 
                          disabled={isLoadingMohallahs || mohallahs.length === 0 || !!editingMember} // Disable if editing, mohallah change is not direct
                        >
                           <FormControl><SelectTrigger id="mohallahId" className="col-span-3"><SelectValue placeholder="Select a Mohallah" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {isLoadingMohallahs ? <SelectItem value="loading" disabled>Loading...</SelectItem> :
                             mohallahs.length === 0 ? <SelectItem value="no-mohallah" disabled>No Mohallahs available</SelectItem> :
                             mohallahs.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {!!editingMember && <FormDescription className="col-start-2 col-span-3 text-xs">To change a member's Mohallah, delete and re-add them to the new Mohallah.</FormDescription>}
                        <FormMessage className="col-start-2 col-span-3 text-xs" />
                      </FormItem>
                    )} />
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsMemberDialogOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={memberForm.formState.isSubmitting || isLoadingMohallahs || (mohallahs.length === 0 && !isLoadingMohallahs && !memberForm.getValues("mohallahId")) }>
                        {memberForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {editingMember ? "Save Changes" : "Add Member"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {fetchError && (
             <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <ShadAlertTitle>Data Fetch Error</ShadAlertTitle>
              <ShadAlertDescription>{fetchError}</ShadAlertDescription>
            </Alert>
          )}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-grow">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search members by name, ITS, or Mohallah..."
                className="pl-8 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {currentUserRole === 'superadmin' && (
              <div className="w-full sm:w-auto sm:min-w-[200px]">
                <Select 
                    value={selectedFilterMohallahId} 
                    onValueChange={(value) => {
                        setSelectedFilterMohallahId(value);
                        // If a specific mohallah is selected for filtering, update the form's default mohallahId for new members
                        if (value !== 'all') {
                            memberForm.setValue("mohallahId", value);
                        } else if (mohallahs.length > 0) {
                            memberForm.setValue("mohallahId", mohallahs[0].id); // Or clear it, or set to first
                        }
                    }} 
                    disabled={isLoadingMohallahs}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by Mohallah" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Mohallahs</SelectItem>
                    {isLoadingMohallahs && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                    {mohallahs.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {isLoadingMembers || (isLoadingMohallahs && currentUserRole === 'superadmin' && selectedFilterMohallahId === 'all' ) ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading members...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px] sm:w-[80px]">Avatar</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>ITS ID</TableHead>
                  <TableHead>Mohallah</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.length > 0 ? filteredMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                        <AvatarImage src={member.avatarUrl || `https://placehold.co/40x40.png?text=${member.name.substring(0,2).toUpperCase()}`} alt={member.name} data-ai-hint="avatar person" />
                        <AvatarFallback>{member.name.substring(0,2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell>{member.itsId}</TableCell>
                    <TableCell>{getMohallahNameById(member.mohallahId)}</TableCell>
                    <TableCell>{member.team || "N/A"}</TableCell>
                    <TableCell>{member.designation || "N/A"}</TableCell>
                    <TableCell>{member.role.charAt(0).toUpperCase() + member.role.slice(1).replace(/-/g, ' ')}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEditMember(member)} className="mr-1 sm:mr-2" aria-label="Edit Member">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" aria-label="Delete Member">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertTrigger>
                        <AlertContent>
                          <AlertHeader>
                            <AlertTitle>Are you sure?</AlertTitle>
                            <AlertDesc>
                              This action cannot be undone. This will permanently delete the member "{member.name}".
                            </AlertDesc>
                          </AlertHeader>
                          <AlertFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteMember(member)} className="bg-destructive hover:bg-destructive/90">
                              Delete
                            </AlertDialogAction>
                          </AlertFooter>
                        </AlertContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center h-24">
                      No members found { (searchTerm || (selectedFilterMohallahId && selectedFilterMohallahId !=='all' && !fetchError)) && "matching your criteria"}.
                      {fetchError && selectedFilterMohallahId === 'all' && "Select a specific Mohallah to view members."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
         <CardFooter>
            <p className="text-xs text-muted-foreground">
              Total Members Displayed: {filteredMembers.length} / { (selectedFilterMohallahId === 'all' && !fetchError) ? members.length : (filteredMembers.length > 0 ? filteredMembers.length : members.length) }
            </p>
        </CardFooter>
      </Card>

      <Dialog open={isCsvImportDialogOpen} onOpenChange={(open) => { setIsCsvImportDialogOpen(open); if(!open) setSelectedFile(null); }}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Import Members via CSV</DialogTitle>
            <DialogDescription>
              Select a CSV file with member data. Expected columns: `name`, `itsId`, `bgkId` (optional), `team` (optional), `phoneNumber` (optional), `role` ('user', 'admin', 'superadmin', or 'attendance-marker'), `mohallahName` (must match an existing Mohallah name), `designation` ('Captain', 'Vice Captain', 'Member', optional). Members will be added to the Mohallah specified in the CSV.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="csvFile" className="text-right">
                CSV File
              </Label>
              <Input
                id="csvFile"
                type="file"
                accept=".csv"
                className="col-span-3"
                onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => {setIsCsvImportDialogOpen(false); setSelectedFile(null);}}>Cancel</Button>
            <Button type="button" onClick={handleProcessCsvUpload} disabled={!selectedFile}>Upload and Process</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
