"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Mohallah, User } from "@/types";
import { PlusCircle, Search, Edit, Trash2, FileUp } from "lucide-react";
import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const memberSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  itsId: z.string().min(8, "ITS ID must be 8 characters").max(8, "ITS ID must be 8 characters"),
  bgkId: z.string().optional(),
  team: z.string().optional(),
  phoneNumber: z.string().optional(),
  role: z.enum(["user", "admin", "superadmin"]),
  mohallahId: z.string().min(1, "Mohallah must be selected"),
});

type MemberFormValues = z.infer<typeof memberSchema>;

const initialMohallahs: Mohallah[] = [
  { id: "moh1", name: "Saifee Mohallah", members: [], admin: undefined },
  { id: "moh2", name: "Burhani Mohallah", members: [], admin: undefined },
  { id: "moh3", name: "Najmi Mohallah", members: [], admin: undefined },
];

const initialMembers: User[] = [
  { id: "usr1", name: "Abbas Bhai", itsId: "10101010", team: "Team A", phoneNumber: "123-456-7890", role: "user", mohallah: "Saifee Mohallah", avatarUrl: "https://placehold.co/40x40.png?text=AB" },
  { id: "usr2", name: "Fatema Ben", itsId: "20202020", team: "Team B", phoneNumber: "987-654-3210", role: "admin", mohallah: "Burhani Mohallah", avatarUrl: "https://placehold.co/40x40.png?text=FB"},
  { id: "usr3", name: "Yusuf Bhai", itsId: "30303030", team: "Team A", phoneNumber: "555-555-5555", role: "user", mohallah: "Saifee Mohallah", avatarUrl: "https://placehold.co/40x40.png?text=YB" },
];

export default function MohallahManagementPage() {
  const [mohallahs, setMohallahs] = useState<Mohallah[]>(initialMohallahs);
  const [members, setMembers] = useState<User[]>(initialMembers);
  const [searchTerm, setSearchTerm] = useState("");
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<User | null>(null);
  const { toast } = useToast();

  const form = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      name: "", itsId: "", bgkId: "", team: "", phoneNumber: "", role: "user", mohallahId: initialMohallahs[0]?.id || ""
    },
  });

  useEffect(() => {
    if (editingMember) {
      const mohallah = mohallahs.find(m => m.name === editingMember.mohallah);
      form.reset({
        ...editingMember,
        mohallahId: mohallah?.id || initialMohallahs[0]?.id || "",
      });
    } else {
      form.reset({ name: "", itsId: "", bgkId: "", team: "", phoneNumber: "", role: "user", mohallahId: initialMohallahs[0]?.id || "" });
    }
  }, [editingMember, form, isMemberDialogOpen, mohallahs]);

  const handleMemberFormSubmit = (values: MemberFormValues) => {
    const mohallahName = mohallahs.find(m => m.id === values.mohallahId)?.name;
    const memberData = { ...values, mohallah: mohallahName };

    if (editingMember) {
      setMembers(members.map(m => m.id === editingMember.id ? { ...editingMember, ...memberData } : m));
      toast({ title: "Member Updated", description: `"${values.name}" has been updated.` });
    } else {
      setMembers([{ ...memberData, id: `usr${Date.now()}` }, ...members]);
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
  
  const handleImportCSV = () => {
    // Placeholder for CSV import functionality
    toast({ title: "Import CSV", description: "CSV import functionality is not yet implemented." });
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
            <Button variant="outline" onClick={handleImportCSV}>
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
                <form onSubmit={form.handleSubmit(handleMemberFormSubmit)} className="grid gap-4 py-4">
                  {/* Form Fields: Name, ITS ID, BGK ID, Team, Phone, Role, Mohallah */}
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">Name</Label><Input {...field} className="col-span-3" />{form.formState.errors.name && <p className="col-span-4 text-xs text-red-500 text-right">{form.formState.errors.name.message}</p>}</div>
                  )} />
                  <FormField control={form.control} name="itsId" render={({ field }) => (
                    <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">ITS ID</Label><Input {...field} className="col-span-3" />{form.formState.errors.itsId && <p className="col-span-4 text-xs text-red-500 text-right">{form.formS<ctrl63>