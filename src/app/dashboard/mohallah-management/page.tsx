
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Mohallah, User, UserRole } from "@/types";
import { PlusCircle, Search, Edit, Trash2, FileUp, Loader2, Home, Pencil } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Form, FormField, FormControl, FormMessage, FormItem, FormLabel as ShadFormLabel } from "@/components/ui/form"; // Renamed Label to ShadFormLabel
import { getUsers, addUser, updateUser, deleteUser } from "@/lib/firebase/userService";
import { getMohallahs, addMohallah, updateMohallahName, deleteMohallah as fbDeleteMohallah } from "@/lib/firebase/mohallahService";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent as AlertContent, AlertDialogDescription as AlertDesc, AlertDialogFooter as AlertFooter, AlertDialogHeader as AlertHeader, AlertDialogTitle as AlertTitle, AlertDialogTrigger as AlertTrigger } from "@/components/ui/alert-dialog";

const memberSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  itsId: z.string().min(8, "ITS ID must be 8 characters").max(8, "ITS ID must be 8 characters"),
  bgkId: z.string().optional().or(z.literal("")),
  team: z.string().optional().or(z.literal("")),
  phoneNumber: z.string().optional().or(z.literal("")),
  role: z.enum(["user", "admin", "superadmin", "attendance-marker"]),
  mohallahId: z.string().min(1, "Mohallah must be selected"),
});

type MemberFormValues = z.infer<typeof memberSchema>;

const mohallahFormSchema = z.object({
  name: z.string().min(3, "Mohallah name must be at least 3 characters"),
});
type MohallahFormValues = z.infer<typeof mohallahFormSchema>;


export default function MohallahManagementPage() {
  const [mohallahs, setMohallahs] = useState<Mohallah[]>([]);
  const [isLoadingMohallahs, setIsLoadingMohallahs] = useState(true);
  const [members, setMembers] = useState<User[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<User | null>(null);
  
  const [isMohallahDialogOpen, setIsMohallahDialogOpen] = useState(false);
  const [editingMohallah, setEditingMohallah] = useState<Mohallah | null>(null);

  const [isCsvImportDialogOpen, setIsCsvImportDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const memberForm = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: { name: "", itsId: "", bgkId: "", team: "", phoneNumber: "", role: "user", mohallahId: "" },
  });

  const mohallahForm = useForm<MohallahFormValues>({
    resolver: zodResolver(mohallahFormSchema),
    defaultValues: { name: "" },
  });

  const fetchAndSetMohallahs = useCallback(async () => {
    setIsLoadingMohallahs(true);
    try {
      const fetchedMohallahs = await getMohallahs();
      setMohallahs(fetchedMohallahs);
      if (fetchedMohallahs.length > 0 && !memberForm.getValues("mohallahId")) {
        memberForm.setValue("mohallahId", fetchedMohallahs[0].id);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch Mohallahs.", variant: "destructive" });
      console.error("Failed to fetch Mohallahs:", error);
    } finally {
      setIsLoadingMohallahs(false);
    }
  }, [toast, memberForm]);

  const fetchAndSetMembers = useCallback(async () => {
    setIsLoadingMembers(true);
    try {
      const fetchedMembers = await getUsers();
      setMembers(fetchedMembers);
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch members.", variant: "destructive" });
      console.error("Failed to fetch members:", error);
    } finally {
      setIsLoadingMembers(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAndSetMohallahs();
    fetchAndSetMembers();
  }, [fetchAndSetMohallahs, fetchAndSetMembers]);

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
      });
    } else {
      memberForm.reset({
        name: "", itsId: "", bgkId: "", team: "", phoneNumber: "", role: "user",
        mohallahId: mohallahs.length > 0 ? mohallahs[0].id : "",
      });
    }
  }, [editingMember, memberForm, isMemberDialogOpen, mohallahs]);

  useEffect(() => {
    if (editingMohallah) {
      mohallahForm.reset({ name: editingMohallah.name });
    } else {
      mohallahForm.reset({ name: "" });
    }
  }, [editingMohallah, mohallahForm, isMohallahDialogOpen]);


  const handleMemberFormSubmit = async (values: MemberFormValues) => {
    const memberPayload: Omit<User, 'id' | 'avatarUrl'> & { avatarUrl?: string } = {
      name: values.name,
      itsId: values.itsId,
      bgkId: values.bgkId || undefined,
      team: values.team || undefined,
      phoneNumber: values.phoneNumber || undefined,
      role: values.role as UserRole,
      mohallahId: values.mohallahId,
    };

    try {
      if (editingMember) {
        await updateUser(editingMember.id, memberPayload);
        toast({ title: "Member Updated", description: `"${values.name}" has been updated.` });
      } else {
        await addUser(memberPayload);
        toast({ title: "Member Added", description: `"${values.name}" has been added.` });
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

  const handleDeleteMember = async (memberId: string, memberName: string) => {
    try {
      await deleteUser(memberId);
      toast({ title: "Member Deleted", description: `"${memberName}" has been deleted.`});
      fetchAndSetMembers();
    } catch (error) {
      console.error("Error deleting member:", error);
      toast({ title: "Database Error", description: "Could not delete member.", variant: "destructive" });
    }
  };

  const handleMohallahFormSubmit = async (values: MohallahFormValues) => {
    try {
      if (editingMohallah) {
        await updateMohallahName(editingMohallah.id, values.name);
        toast({ title: "Mohallah Updated", description: `Mohallah "${values.name}" has been updated.` });
      } else {
        await addMohallah(values.name);
        toast({ title: "Mohallah Added", description: `Mohallah "${values.name}" has been added.` });
      }
      fetchAndSetMohallahs();
      setIsMohallahDialogOpen(false);
      setEditingMohallah(null);
    } catch (error) {
      console.error("Error saving Mohallah:", error);
      toast({ title: "Database Error", description: `Could not save Mohallah. ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
    }
  };

  const handleEditMohallah = (mohallah: Mohallah) => {
    setEditingMohallah(mohallah);
    setIsMohallahDialogOpen(true);
  };

  const handleDeleteMohallah = async (mohallah: Mohallah) => {
    const membersInMohallah = members.filter(member => member.mohallahId === mohallah.id);
    if (membersInMohallah.length > 0) {
      toast({
        title: "Cannot Delete Mohallah",
        description: `Mohallah "${mohallah.name}" has ${membersInMohallah.length} member(s) assigned. Please reassign them before deleting.`,
        variant: "destructive",
        duration: 5000,
      });
      return;
    }
    try {
      await fbDeleteMohallah(mohallah.id);
      toast({ title: "Mohallah Deleted", description: `Mohallah "${mohallah.name}" has been deleted.`});
      fetchAndSetMohallahs();
    } catch (error) {
      console.error("Error deleting Mohallah:", error);
      toast({ title: "Database Error", description: "Could not delete Mohallah.", variant: "destructive" });
    }
  };
  
  const handleProcessCsvUpload = () => {
    if (!selectedFile) {
        toast({ title: "No file selected", description: "Please select a CSV file to upload.", variant: "destructive" });
        return;
    }
    toast({ title: "CSV Upload (Placeholder)", description: `File "${selectedFile.name}" selected. Actual import functionality is not yet implemented.` });
    setIsCsvImportDialogOpen(false);
    setSelectedFile(null);
  };

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.itsId.includes(searchTerm) ||
    (mohallahs.find(moh => moh.id === m.mohallahId)?.name.toLowerCase() || "").includes(searchTerm.toLowerCase())
  );

  const getMohallahNameById = (id?: string) => mohallahs.find(m => m.id === id)?.name || "N/A";

  return (
    <div className="space-y-6">
      {/* Mohallah Management Card */}
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center"><Home className="mr-2 h-5 w-5 text-primary" />Manage Mohallahs</CardTitle>
            <CardDescription>Add, edit, or delete Mohallahs stored in Firestore.</CardDescription>
          </div>
          <Dialog open={isMohallahDialogOpen} onOpenChange={(open) => { setIsMohallahDialogOpen(open); if (!open) setEditingMohallah(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingMohallah(null); setIsMohallahDialogOpen(true); }}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Mohallah
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{editingMohallah ? "Edit Mohallah Name" : "Add New Mohallah"}</DialogTitle>
              </DialogHeader>
              <Form {...mohallahForm}>
                <form onSubmit={mohallahForm.handleSubmit(handleMohallahFormSubmit)} className="grid gap-4 py-4">
                  <FormField control={mohallahForm.control} name="name" render={({ field }) => (
                    <FormItem>
                      <ShadFormLabel htmlFor="mohallahName">Mohallah Name</ShadFormLabel>
                      <FormControl><Input id="mohallahName" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsMohallahDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={mohallahForm.formState.isSubmitting}>{editingMohallah ? "Save Changes" : "Add Mohallah"}</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoadingMohallahs ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading Mohallahs...</p>
            </div>
          ) : mohallahs.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No Mohallahs found. Add one to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mohallah Name</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mohallahs.map((mohallah) => (
                  <TableRow key={mohallah.id}>
                    <TableCell className="font-medium">{mohallah.name}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEditMohallah(mohallah)} className="mr-2">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertTrigger>
                        <AlertContent>
                          <AlertHeader>
                            <AlertTitle>Are you sure?</AlertTitle>
                            <AlertDesc>
                              This action cannot be undone. This will permanently delete the Mohallah "{mohallah.name}".
                              Ensure no members are assigned to this Mohallah before deleting.
                            </AlertDesc>
                          </AlertHeader>
                          <AlertFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteMohallah(mohallah)}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertFooter>
                        </AlertContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Member Management Card */}
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Mohallah Member Management</CardTitle>
            <CardDescription>Add, view, and manage members. Data from Firestore.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsCsvImportDialogOpen(true)}>
              <FileUp className="mr-2 h-4 w-4" /> Import CSV
            </Button>
            <Dialog open={isMemberDialogOpen} onOpenChange={(open) => { setIsMemberDialogOpen(open); if (!open) setEditingMember(null); }}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingMember(null); setIsMemberDialogOpen(true); }}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add New Member
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[525px]">
                <DialogHeader>
                  <DialogTitle>{editingMember ? "Edit Member" : "Add New Member"}</DialogTitle>
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
                        <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingMohallahs || mohallahs.length === 0}>
                           <FormControl><SelectTrigger id="mohallahId" className="col-span-3"><SelectValue placeholder="Select a Mohallah" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {isLoadingMohallahs ? <SelectItem value="loading" disabled>Loading...</SelectItem> :
                             mohallahs.length === 0 ? <SelectItem value="no-mohallah" disabled>No Mohallahs available</SelectItem> :
                             mohallahs.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage className="col-start-2 col-span-3 text-xs" />
                      </FormItem>
                    )} />
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsMemberDialogOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={memberForm.formState.isSubmitting || isLoadingMohallahs || (mohallahs.length === 0 && !isLoadingMohallahs) }>
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
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search members by name, ITS, or Mohallah..."
                className="pl-8 w-full md:w-1/2"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          {isLoadingMembers ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading members...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Avatar</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>ITS ID</TableHead>
                  <TableHead>Mohallah</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.length > 0 ? filteredMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.avatarUrl || `https://placehold.co/40x40.png?text=${member.name.substring(0,2).toUpperCase()}`} alt={member.name} data-ai-hint="avatar person" />
                        <AvatarFallback>{member.name.substring(0,2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell>{member.itsId}</TableCell>
                    <TableCell>{getMohallahNameById(member.mohallahId)}</TableCell>
                    <TableCell>{member.team || "N/A"}</TableCell>
                    <TableCell>{member.role.charAt(0).toUpperCase() + member.role.slice(1).replace(/-/g, ' ')}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEditMember(member)} className="mr-2" aria-label="Edit Member">
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
                            <AlertDialogAction onClick={() => handleDeleteMember(member.id, member.name)} className="bg-destructive hover:bg-destructive/90">
                              Delete
                            </AlertDialogAction>
                          </AlertFooter>
                        </AlertContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-24">
                      No members found {searchTerm && "matching your search"}.
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
              Total Members: {members.length}
            </p>
        </CardFooter>
      </Card>

      {/* CSV Import Dialog */}
      <Dialog open={isCsvImportDialogOpen} onOpenChange={(open) => { setIsCsvImportDialogOpen(open); if(!open) setSelectedFile(null); }}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Import Members via CSV</DialogTitle>
            <DialogDescription>
              Select a CSV file with member data. Expected columns: `name`, `itsId`, `bgkId` (optional), `team` (optional), `phoneNumber` (optional), `role` ('user', 'admin', 'superadmin', or 'attendance-marker'), `mohallahName` (must match an existing Mohallah name - this will be converted to mohallahId).
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


    