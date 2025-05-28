
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Mohallah, User, UserRole } from "@/types";
import { PlusCircle, Search, Edit, Trash2, FileUp } from "lucide-react";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Form, FormField, FormControl, FormMessage, FormItem } from "@/components/ui/form";

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

const initialMohallahs: Mohallah[] = [
  { id: "moh1", name: "Saifee Mohallah", members: [], admin: undefined },
  { id: "moh2", name: "Burhani Mohallah", members: [], admin: undefined },
  { id: "moh3", name: "Najmi Mohallah", members: [], admin: undefined },
];

export const initialMembers: User[] = [ // Export for use in mark-attendance page
  { id: "usr1", name: "Abbas Bhai", itsId: "10101010", team: "Team A", phoneNumber: "123-456-7890", role: "user", mohallah: "Saifee Mohallah", avatarUrl: "https://placehold.co/40x40.png?text=AB" },
  { id: "usr2", name: "Fatema Ben", itsId: "20202020", team: "Team B", phoneNumber: "987-654-3210", role: "admin", mohallah: "Burhani Mohallah", avatarUrl: "https://placehold.co/40x40.png?text=FB"},
  { id: "usr3", name: "Yusuf Bhai", itsId: "30303030", team: "Team A", phoneNumber: "555-555-5555", role: "user", mohallah: "Saifee Mohallah", avatarUrl: "https://placehold.co/40x40.png?text=YB" },
  { id: "usr4", name: "Zainab Teacher", itsId: "40404040", team: "Team C", phoneNumber: "111-222-3333", role: "attendance-marker", mohallah: "Najmi Mohallah", avatarUrl: "https://placehold.co/40x40.png?text=ZT" },
];

export default function MohallahManagementPage() {
  const [mohallahs, setMohallahs] = useState<Mohallah[]>(initialMohallahs);
  const [members, setMembers] = useState<User[]>(initialMembers);
  const [searchTerm, setSearchTerm] = useState("");
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<User | null>(null);
  const [isCsvImportDialogOpen, setIsCsvImportDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const form = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      name: "",
      itsId: "",
      bgkId: "",
      team: "",
      phoneNumber: "",
      role: "user",
      mohallahId: initialMohallahs[0]?.id || ""
    },
  });

  useEffect(() => {
    if (editingMember) {
      const mohallah = mohallahs.find(m => m.name === editingMember.mohallah);
      form.reset({
        name: editingMember.name,
        itsId: editingMember.itsId,
        bgkId: editingMember.bgkId || "",
        team: editingMember.team || "",
        phoneNumber: editingMember.phoneNumber || "",
        role: editingMember.role,
        mohallahId: mohallah?.id || initialMohallahs[0]?.id || "",
      });
    } else {
      form.reset({
        name: "",
        itsId: "",
        bgkId: "",
        team: "",
        phoneNumber: "",
        role: "user",
        mohallahId: initialMohallahs[0]?.id || ""
      });
    }
  }, [editingMember, form, isMemberDialogOpen, mohallahs]);

  const handleMemberFormSubmit = (values: MemberFormValues) => {
    const mohallahName = mohallahs.find(m => m.id === values.mohallahId)?.name;
    const memberData = { ...values, mohallah: mohallahName || "Unknown Mohallah", role: values.role as UserRole };

    if (editingMember) {
      setMembers(members.map(m => m.id === editingMember.id ? { ...editingMember, ...memberData, avatarUrl: m.avatarUrl } : m)); 
      toast({ title: "Member Updated", description: `"${values.name}" has been updated.` });
    } else {
      setMembers([{ ...memberData, id: `usr${Date.now()}`, avatarUrl: `https://placehold.co/40x40.png?text=${values.name.substring(0,2).toUpperCase()}` }, ...members]);
      toast({ title: "Member Added", description: `"${values.name}" has been added.` });
    }
    setIsMemberDialogOpen(false);
    setEditingMember(null);
  };

  const handleEditMember = (member: User) => {
    setEditingMember(member);
    setIsMemberDialogOpen(true);
  };

  const handleDeleteMember = (memberId: string) => {
    setMembers(members.filter(m => m.id !== memberId));
    toast({ title: "Member Deleted", description: "The member has been deleted.", variant: "destructive" });
  };
  
  const handleProcessCsvUpload = () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a CSV file to upload.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "CSV Upload (Placeholder)",
      description: `File "${selectedFile.name}" would be processed. Actual import functionality is not yet implemented.`,
    });
    setSelectedFile(null);
    setIsCsvImportDialogOpen(false);
  };

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.itsId.includes(searchTerm) ||
    (m.mohallah && m.mohallah.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Mohallah Member Management</CardTitle>
            <CardDescription>Add, view, and manage members by Mohallah.</CardDescription>
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
                  <DialogDescription>
                    {editingMember ? "Update member details." : "Fill in member details."}
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleMemberFormSubmit)} className="grid gap-4 py-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">Name</Label>
                        <FormControl><Input id="name" {...field} className="col-span-3" /></FormControl>
                        <FormMessage className="col-start-2 col-span-3 text-xs" />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="itsId" render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="itsId" className="text-right">ITS ID</Label>
                        <FormControl><Input id="itsId" {...field} className="col-span-3" /></FormControl>
                        <FormMessage className="col-start-2 col-span-3 text-xs" />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="bgkId" render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="bgkId" className="text-right">BGK ID</Label>
                        <FormControl><Input id="bgkId" {...field} className="col-span-3" /></FormControl>
                        <FormMessage className="col-start-2 col-span-3 text-xs" />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="team" render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="team" className="text-right">Team</Label>
                        <FormControl><Input id="team" {...field} className="col-span-3" /></FormControl>
                        <FormMessage className="col-start-2 col-span-3 text-xs" />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="phoneNumber" className="text-right">Phone</Label>
                        <FormControl><Input id="phoneNumber" {...field} className="col-span-3" /></FormControl>
                        <FormMessage className="col-start-2 col-span-3 text-xs" />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="role" render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="role" className="text-right">Role</Label>
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
                    <FormField control={form.control} name="mohallahId" render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="mohallahId" className="text-right">Mohallah</Label>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                           <FormControl><SelectTrigger id="mohallahId" className="col-span-3"><SelectValue placeholder="Select a Mohallah" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {mohallahs.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage className="col-start-2 col-span-3 text-xs" />
                      </FormItem>
                    )} />
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsMemberDialogOpen(false)}>Cancel</Button>
                      <Button type="submit">{editingMember ? "Save Changes" : "Add Member"}</Button>
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
                placeholder="Search members..."
                className="pl-8 w-full md:w-1/3"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
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
                      <AvatarImage src={member.avatarUrl} alt={member.name} data-ai-hint="avatar person" />
                      <AvatarFallback>{member.name.substring(0,2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell>{member.itsId}</TableCell>
                  <TableCell>{member.mohallah}</TableCell>
                  <TableCell>{member.team || "N/A"}</TableCell>
                  <TableCell>{member.role.charAt(0).toUpperCase() + member.role.slice(1).replace(/-/g, ' ')}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEditMember(member)} className="mr-2">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteMember(member.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    No members found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* CSV Import Dialog */}
      <Dialog open={isCsvImportDialogOpen} onOpenChange={(open) => { setIsCsvImportDialogOpen(open); if(!open) setSelectedFile(null); }}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Import Members via CSV</DialogTitle>
            <DialogDescription>
              Select a CSV file with member data. Expected columns: `name`, `itsId`, `bgkId` (optional), `team` (optional), `phoneNumber` (optional), `role` ('user', 'admin', 'superadmin', or 'attendance-marker'), `mohallahName` (must match an existing Mohallah name).
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
            <Button type="button" onClick={handleProcessCsvUpload}>Upload and Process</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
