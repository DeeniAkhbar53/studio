
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { Miqaat, UserRole, Mohallah, User } from "@/types";
import { PlusCircle, Search, Loader2, CalendarDays, ShieldAlert, Users, MoreHorizontal, Edit, Trash2, Barcode, Download, Eye, Shirt, Clock, CheckCircle, XCircle } from "lucide-react"; 
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Form, FormField, FormItem, FormControl, FormMessage, FormLabel as ShadFormLabel, FormDescription } from "@/components/ui/form";
import { getMiqaats, addMiqaat, updateMiqaat, deleteMiqaat as fbDeleteMiqaat, MiqaatDataForAdd, MiqaatDataForUpdate } from "@/lib/firebase/miqaatService";
import { getMohallahs } from "@/lib/firebase/mohallahService";
import { getUniqueTeamNames, getUsers } from "@/lib/firebase/userService"; 
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { allNavItems } from "@/components/dashboard/sidebar-nav";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { QRCodeSVG } from 'qrcode.react';
import { format } from "date-fns";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";


const miqaatSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  location: z.string().optional(),
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid start date" }),
  endTime: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid end date" }),
  reportingTime: z.string().optional().nullable()
    .refine(val => !val || val === "" || !isNaN(Date.parse(val)), { message: "Invalid reporting date if provided" }),
  eligibilityType: z.enum(['groups', 'specific_members']).default('groups'),
  mohallahIds: z.array(z.string()).optional().default([]),
  teams: z.array(z.string()).optional().default([]), 
  eligibleItsIds: z.array(z.string()).optional().default([]),
  barcodeData: z.string().optional(),
  uniformRequirements: z.object({
    fetaPaghri: z.boolean().default(false),
    koti: z.boolean().default(false),
  }).default({ fetaPaghri: false, koti: false }),
});

type MiqaatFormValues = z.infer<typeof miqaatSchema>;

// Helper function to format date to local YYYY-MM-DDTHH:MM for input[type=datetime-local]
const toLocalISOString = (date: Date) => {
  const ten = (i: number) => (i < 10 ? '0' : '') + i;
  const YYYY = date.getFullYear();
  const MM = ten(date.getMonth() + 1);
  const DD = ten(date.getDate());
  const HH = ten(date.getHours());
  const mm = ten(date.getMinutes());
  return `${YYYY}-${MM}-${DD}T${HH}:${mm}`;
};


export default function MiqaatManagementPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [miqaats, setMiqaats] = useState<Pick<Miqaat, "id" | "name" | "startTime" | "endTime" | "reportingTime" | "mohallahIds" | "teams" | "eligibleItsIds" | "location" | "barcodeData" | "attendance" | "createdAt" | "uniformRequirements">[]>([]);
  const [isLoadingMiqaats, setIsLoadingMiqaats] = useState(true);
  const [availableMohallahs, setAvailableMohallahs] = useState<Mohallah[]>([]);
  const [isLoadingMohallahs, setIsLoadingMohallahs] = useState(true);
  const [availableTeams, setAvailableTeams] = useState<string[]>([]); 
  const [isLoadingTeams, setIsLoadingTeams] = useState(true); 
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [memberSearchTerm, setMemberSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMiqaat, setEditingMiqaat] = useState<Pick<Miqaat, "id" | "name" | "startTime" | "endTime" | "reportingTime" | "mohallahIds" | "teams" | "eligibleItsIds" | "location" | "barcodeData" | "attendance" | "createdAt" | "uniformRequirements"> | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const { toast } = useToast();
  
  const [showBarcodeDialog, setShowBarcodeDialog] = useState(false);
  const [barcodeMiqaat, setBarcodeMiqaat] = useState<Miqaat | null>(null);

  const form = useForm<MiqaatFormValues>({
    resolver: zodResolver(miqaatSchema),
    defaultValues: {
      name: "",
      location: "",
      startTime: "",
      endTime: "",
      reportingTime: "",
      eligibilityType: "groups",
      mohallahIds: [],
      teams: [], 
      eligibleItsIds: [],
      barcodeData: "",
      uniformRequirements: { fetaPaghri: false, koti: false },
    },
  });

  const eligibilityType = form.watch("eligibilityType");

  useEffect(() => {
    const role = typeof window !== "undefined" ? localStorage.getItem('userRole') as UserRole : null;
    const pageRightsRaw = typeof window !== "undefined" ? localStorage.getItem('userPageRights') : '[]';
    const pageRights = JSON.parse(pageRightsRaw || '[]');
    const navItem = allNavItems.find(item => item.href === '/dashboard/miqaat-management');
    
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
    if (!isAuthorized) return;
    const role = localStorage.getItem('userRole') as UserRole | null;
    setCurrentUserRole(role);

    const dataFetchPromises = [
        new Promise<void>(resolve => { setIsLoadingMiqaats(true); const unsub = getMiqaats(data => { setMiqaats(data); setIsLoadingMiqaats(false); resolve(); }); }),
        new Promise<void>(resolve => { setIsLoadingMohallahs(true); const unsub = getMohallahs(data => { setAvailableMohallahs(data); setIsLoadingMohallahs(false); resolve(); }); }),
        getUniqueTeamNames().then(setAvailableTeams).catch(err => console.error("Failed to fetch teams", err)).finally(() => setIsLoadingTeams(false)),
        getUsers().then(setAllUsers).catch(err => console.error("Failed to fetch users", err)).finally(() => setIsLoadingUsers(false)),
    ];

    Promise.all(dataFetchPromises);

  }, [isAuthorized]);

  useEffect(() => {
    if (editingMiqaat) {
      let type: 'groups' | 'specific_members' = 'groups';
      if (editingMiqaat.eligibleItsIds && editingMiqaat.eligibleItsIds.length > 0) {
        type = 'specific_members';
      }

      form.reset({
        name: editingMiqaat.name,
        location: editingMiqaat.location || "",
        startTime: editingMiqaat.startTime ? toLocalISOString(new Date(editingMiqaat.startTime)) : "",
        endTime: editingMiqaat.endTime ? toLocalISOString(new Date(editingMiqaat.endTime)) : "",
        reportingTime: editingMiqaat.reportingTime ? toLocalISOString(new Date(editingMiqaat.reportingTime)) : "",
        eligibilityType: type,
        mohallahIds: editingMiqaat.mohallahIds || [],
        teams: editingMiqaat.teams || [], 
        eligibleItsIds: editingMiqaat.eligibleItsIds || [],
        barcodeData: editingMiqaat.barcodeData || "",
        uniformRequirements: editingMiqaat.uniformRequirements || { fetaPaghri: false, koti: false },
      });
    } else {
      form.reset({ name: "", location: "", startTime: "", endTime: "", reportingTime: "", eligibilityType: "groups", mohallahIds: [], teams: [], eligibleItsIds: [], barcodeData: "", uniformRequirements: { fetaPaghri: false, koti: false } });
    }
  }, [editingMiqaat, form, isDialogOpen]);

  const handleFormSubmit = async (values: MiqaatFormValues) => {
    
    const dataForService: MiqaatDataForAdd | MiqaatDataForUpdate = {
      name: values.name,
      startTime: values.startTime,
      endTime: values.endTime,
      mohallahIds: values.eligibilityType === 'groups' ? (values.mohallahIds || []) : [],
      teams: values.eligibilityType === 'groups' ? (values.teams || []) : [],
      eligibleItsIds: values.eligibilityType === 'specific_members' ? (values.eligibleItsIds || []) : [],
      location: values.location, 
      reportingTime: values.reportingTime, 
      barcodeData: values.barcodeData,
      uniformRequirements: values.uniformRequirements,
    };
    
    try {
      if (editingMiqaat) {
        await updateMiqaat(editingMiqaat.id, dataForService as MiqaatDataForUpdate);
        toast({ title: "Miqaat Updated", description: `"${values.name}" has been updated.` });
      } else {
        await addMiqaat(dataForService as MiqaatDataForAdd);
        toast({ title: "Miqaat Created", description: `"${values.name}" has been added.` });
      }
      setIsDialogOpen(false);
      setEditingMiqaat(null);
    } catch (error) {
        console.error("Error saving Miqaat:", error);
        toast({ title: "Database Error", description: `Could not save Miqaat data. ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
    }
  };

  const handleEdit = (miqaat: Pick<Miqaat, "id" | "name" | "startTime" | "endTime" | "reportingTime" | "mohallahIds" | "teams" | "eligibleItsIds" | "location" | "barcodeData" | "attendance" | "createdAt" | "uniformRequirements">) => {
    setEditingMiqaat(miqaat);
    setIsDialogOpen(true);
  };

  const handleDelete = async (miqaatId: string) => {
    try {
      await fbDeleteMiqaat(miqaatId);
      toast({ title: "Miqaat Deleted", description: "The Miqaat has been deleted.", variant: "destructive" });
    } catch (error) {
      console.error("Error deleting Miqaat:", error);
      toast({ title: "Database Error", description: "Could not delete Miqaat.", variant: "destructive" });
    }
  };

  const filteredMiqaats = miqaats.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.location || "").toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredUsers = allUsers.filter(user => {
    if (!memberSearchTerm) return true;
    return user.itsId.includes(memberSearchTerm) || (user.bgkId || '').includes(memberSearchTerm);
  });
  
  if (isAuthorized === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
       <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
        <p className="text-muted-foreground mt-2">
          You do not have the required permissions to view this page.
        </p>
        <p className="text-sm text-muted-foreground mt-1">Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <div className="flex-grow">
              <CardTitle className="flex items-center"><CalendarDays className="mr-2 h-5 w-5 text-primary"/>Manage Miqaats</CardTitle>
              <CardDescription className="mt-1">Create, view, and manage all Miqaats. List updates in realtime.</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingMiqaat(null); }}>
              <DialogTrigger asChild>
                <Button onClick={() => {setEditingMiqaat(null); form.reset(); setIsDialogOpen(true);}} size="sm" className="w-full md:w-auto self-start md:self-center">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add New Miqaat
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>{editingMiqaat ? "Edit Miqaat" : "Create New Miqaat"}</DialogTitle>
                  <DialogDescription>
                    {editingMiqaat ? "Update the details of the Miqaat." : "Fill in the details for the new Miqaat."}
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem><ShadFormLabel>Name</ShadFormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField control={form.control} name="location" render={({ field }) => (
                      <FormItem><ShadFormLabel>Location</ShadFormLabel><FormControl><Input placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="startTime" render={({ field }) => (
                        <FormItem><ShadFormLabel>Start Time</ShadFormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="endTime" render={({ field }) => (
                        <FormItem><ShadFormLabel>End Time</ShadFormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                     <FormField control={form.control} name="reportingTime" render={({ field }) => (
                      <FormItem><ShadFormLabel>Reporting Time</ShadFormLabel><FormControl><Input type="datetime-local" {...field} value={field.value || ""} /></FormControl><FormDescription className="text-xs">Optional. Leave blank if not applicable.</FormDescription><FormMessage /></FormItem>
                    )} />
                    <FormField
                        control={form.control}
                        name="uniformRequirements"
                        render={() => (
                          <FormItem className="space-y-2 pt-2">
                            <ShadFormLabel className="font-semibold">Uniform Requirements</ShadFormLabel>
                            <div className="flex gap-4">
                                <FormField control={form.control} name="uniformRequirements.fetaPaghri" render={({ field }) => (
                                    <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><ShadFormLabel className="font-normal text-sm">Feta/Paghri</ShadFormLabel></FormItem>
                                )}/>
                                <FormField control={form.control} name="uniformRequirements.koti" render={({ field }) => (
                                    <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><ShadFormLabel className="font-normal text-sm">Koti</ShadFormLabel></FormItem>
                                )}/>
                            </div>
                            <FormDescription className="text-xs">If none selected, only attendance will be marked.</FormDescription>
                          </FormItem>
                        )}
                    />
                    
                    <FormField control={form.control} name="eligibilityType" render={({ field }) => (
                        <FormItem className="space-y-3 pt-2">
                            <ShadFormLabel className="font-semibold">Eligibility</ShadFormLabel>
                            <FormControl>
                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex space-x-4">
                                    <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="groups" /></FormControl><ShadFormLabel className="font-normal">By Group (Mohallah/Team)</ShadFormLabel></FormItem>
                                    <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="specific_members" /></FormControl><ShadFormLabel className="font-normal">By Specific Members</ShadFormLabel></FormItem>
                                </RadioGroup>
                            </FormControl>
                        </FormItem>
                    )}/>
                    
                    {eligibilityType === 'groups' && (
                        <>
                        <FormField control={form.control} name="mohallahIds" render={({ field }) => (
                        <FormItem><ShadFormLabel>Assigned Mohallahs</ShadFormLabel>
                            <ScrollArea className="rounded-md border p-3 h-40">
                              {isLoadingMohallahs ? (<p className="text-sm text-muted-foreground">Loading...</p>) : (
                                availableMohallahs.map((mohallah) => (
                                  <FormField key={mohallah.id} control={form.control} name="mohallahIds" render={({ field: checkboxField }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 mb-2">
                                      <FormControl><Checkbox checked={checkboxField.value?.includes(mohallah.id)} onCheckedChange={(checked) => {
                                        return checked ? checkboxField.onChange([...(checkboxField.value || []), mohallah.id]) : checkboxField.onChange(checkboxField.value?.filter((value) => value !== mohallah.id));
                                      }} /></FormControl>
                                      <ShadFormLabel className="font-normal text-sm">{mohallah.name}</ShadFormLabel>
                                    </FormItem>
                                  )}/>
                                ))
                              )}
                            </ScrollArea>
                            <FormDescription className="text-xs">Select Mohallahs. Leave empty for all.</FormDescription><FormMessage /></FormItem>
                        )}/>
                        <FormField control={form.control} name="teams" render={({ field }) => (
                        <FormItem><ShadFormLabel>Assigned Teams</ShadFormLabel>
                            <ScrollArea className="rounded-md border p-3 h-40">
                              {isLoadingTeams ? (<p className="text-sm text-muted-foreground">Loading...</p>) : (
                                availableTeams.map((team) => (
                                  <FormField key={team} control={form.control} name="teams" render={({ field: checkboxField }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 mb-2">
                                      <FormControl><Checkbox checked={checkboxField.value?.includes(team)} onCheckedChange={(checked) => {
                                        return checked ? checkboxField.onChange([...(checkboxField.value || []), team]) : checkboxField.onChange(checkboxField.value?.filter((value) => value !== team));
                                      }} /></FormControl>
                                      <ShadFormLabel className="font-normal text-sm">{team}</ShadFormLabel>
                                    </FormItem>
                                  )}/>
                                ))
                              )}
                            </ScrollArea>
                            <FormDescription className="text-xs">Select Teams. Leave empty for all.</FormDescription><FormMessage /></FormItem>
                        )}/>
                        </>
                    )}
                    
                     {eligibilityType === 'specific_members' && (
                        <FormField control={form.control} name="eligibleItsIds" render={({ field }) => (
                            <FormItem>
                                <ShadFormLabel>Eligible Members</ShadFormLabel>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search by ITS or BGK ID..."
                                        value={memberSearchTerm}
                                        onChange={(e) => setMemberSearchTerm(e.target.value)}
                                        className="pl-8 mb-2"
                                    />
                                </div>
                                <ScrollArea className="rounded-md border p-3 h-60">
                                {isLoadingUsers ? (<p className="text-sm text-muted-foreground">Loading Users...</p>) : (
                                    filteredUsers.map((user) => (
                                    <FormField key={user.id} control={form.control} name="eligibleItsIds" render={({ field: checkboxField }) => (
                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 mb-2">
                                        <FormControl><Checkbox checked={checkboxField.value?.includes(user.itsId)} onCheckedChange={(checked) => {
                                            return checked ? checkboxField.onChange([...(checkboxField.value || []), user.itsId]) : checkboxField.onChange(checkboxField.value?.filter((value) => value !== user.itsId));
                                        }} /></FormControl>
                                        <ShadFormLabel className="font-normal text-sm">{user.name} ({user.itsId})</ShadFormLabel>
                                        </FormItem>
                                    )}/>
                                    ))
                                )}
                                {filteredUsers.length === 0 && !isLoadingUsers && <p className="text-sm text-muted-foreground text-center py-4">No members found matching search.</p>}
                                </ScrollArea>
                                <FormDescription className="text-xs">Select individual members eligible for this Miqaat.</FormDescription>
                            <FormMessage /></FormItem>
                        )}/>
                    )}

                    <FormField control={form.control} name="barcodeData" render={({ field }) => (
                      <FormItem><ShadFormLabel>Barcode Data</ShadFormLabel><FormControl><Input placeholder="Optional (auto-generates if empty)" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={form.formState.isSubmitting || isLoadingMohallahs || isLoadingTeams || isLoadingUsers}>
                        {(form.formState.isSubmitting || isLoadingMohallahs || isLoadingTeams || isLoadingUsers) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {editingMiqaat ? "Save Changes" : "Create Miqaat"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
          <Separator />
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search Miqaats by name or location..."
                className="pl-8 w-full md:w-1/2 lg:w-1/3"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          {isLoadingMiqaats ? (
            <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Loading Miqaats...</p>
            </div>
          ) : filteredMiqaats.length > 0 ? (
            <>
              {/* Mobile View: Accordion */}
              <div className="md:hidden">
                <Accordion type="single" collapsible className="w-full">
                  {filteredMiqaats.map((miqaat, index) => {
                    const isSpecific = miqaat.eligibleItsIds && miqaat.eligibleItsIds.length > 0;
                    const eligibility = isSpecific ? `${miqaat.eligibleItsIds?.length} members` : "Groups";
                    const isExpired = new Date(miqaat.endTime) < new Date();

                    return (
                      <AccordionItem value={miqaat.id} key={miqaat.id}>
                        <AccordionTrigger className="hover:no-underline">
                           <div className="flex items-center gap-4 w-full">
                             <span className="text-sm font-mono text-muted-foreground">{index + 1}.</span>
                             <div className="flex-grow text-left">
                               <p className="font-semibold text-card-foreground">{miqaat.name}</p>
                               <p className="text-xs text-muted-foreground">{format(new Date(miqaat.startTime), "PP")}</p>
                             </div>
                              <Badge variant={isExpired ? 'destructive' : 'default'} className="whitespace-nowrap">
                               {isExpired ? <XCircle className="mr-1 h-3 w-3" /> : <CheckCircle className="mr-1 h-3 w-3" />}
                               {isExpired ? 'Expired' : 'Active'}
                              </Badge>
                           </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                           <div className="grid grid-cols-2 gap-4 text-sm px-2">
                              <div className="space-y-1">
                                  <p className="font-medium text-muted-foreground">Location</p>
                                  <p>{miqaat.location || "N/A"}</p>
                              </div>
                               <div className="space-y-1">
                                  <p className="font-medium text-muted-foreground">Eligibility</p>
                                  <p>{eligibility}</p>
                              </div>
                               <div className="space-y-1">
                                  <p className="font-medium text-muted-foreground">Attendance</p>
                                  <p>{miqaat.attendance?.length || 0}</p>
                              </div>
                              <div className="space-y-1">
                                  <p className="font-medium text-muted-foreground">Uniform</p>
                                  <div className="flex flex-col gap-1">
                                      {miqaat.uniformRequirements?.fetaPaghri && <Badge variant="secondary" className="text-xs w-fit">Feta/Paghri</Badge>}
                                      {miqaat.uniformRequirements?.koti && <Badge variant="secondary" className="text-xs w-fit">Koti</Badge>}
                                      {!miqaat.uniformRequirements?.fetaPaghri && !miqaat.uniformRequirements?.koti && <span className="text-xs">N/A</span>}
                                  </div>
                              </div>
                           </div>
                           <Separator/>
                            <div className="flex justify-end gap-2 px-2">
                                <Button variant="outline" size="sm" onClick={() => { setBarcodeMiqaat(miqaat as Miqaat); setShowBarcodeDialog(true); }}>
                                    <Barcode className="mr-2 h-4 w-4"/> Barcode
                                </Button>
                                {currentUserRole === 'admin' || currentUserRole === 'superadmin' ? (
                                    <>
                                        <Button variant="outline" size="sm" onClick={() => handleEdit(miqaat)}>
                                            <Edit className="mr-2 h-4 w-4"/> Edit
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="destructive" size="sm">
                                                    <Trash2 className="mr-2 h-4 w-4"/> Delete
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>This will permanently delete "{miqaat.name}" and all its attendance records.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDelete(miqaat.id)}>Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </>
                                ) : null}
                           </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
              
              {/* Desktop View: Table */}
              <div className="hidden md:block border rounded-lg overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]">Sr.No.</TableHead>
                            <TableHead>Miqaat Title</TableHead>
                            <TableHead>Dates</TableHead>
                            <TableHead>Eligibility</TableHead>
                            <TableHead>Attendance</TableHead>
                            <TableHead>Uniform</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredMiqaats.map((miqaat, index) => {
                            const isSpecific = miqaat.eligibleItsIds && miqaat.eligibleItsIds.length > 0;
                            const eligibility = isSpecific
                                ? `${miqaat.eligibleItsIds?.length} members`
                                : "Groups";

                            return (
                                <TableRow key={miqaat.id}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell className="font-medium">
                                        {miqaat.name}
                                        <p className="text-sm text-muted-foreground line-clamp-1">{miqaat.location || "No location"}</p>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-xs">Start: {format(new Date(miqaat.startTime), "PPp")}</div>
                                        <div className="text-xs">End: {format(new Date(miqaat.endTime), "PPp")}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={isSpecific ? "secondary" : "outline"}>{eligibility}</Badge>
                                    </TableCell>
                                    <TableCell className="text-center">{miqaat.attendance?.length || 0}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                          {miqaat.uniformRequirements?.fetaPaghri && <Badge variant="default" className="text-xs">Feta/Paghri</Badge>}
                                          {miqaat.uniformRequirements?.koti && <Badge variant="default" className="text-xs">Koti</Badge>}
                                          {!miqaat.uniformRequirements?.fetaPaghri && !miqaat.uniformRequirements?.koti && <Badge variant="secondary" className="text-xs">N/A</Badge>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right space-x-1">
                                        <Button variant="ghost" size="icon" onClick={() => { setBarcodeMiqaat(miqaat as Miqaat); setShowBarcodeDialog(true); }}>
                                            <Barcode className="h-4 w-4"/>
                                            <span className="sr-only">View Barcode</span>
                                        </Button>
                                        {currentUserRole === 'admin' || currentUserRole === 'superadmin' ? (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreHorizontal className="h-4 w-4"/>
                                                        <span className="sr-only">More actions</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleEdit(miqaat)}>
                                                        <Edit className="mr-2 h-4 w-4" /> Edit
                                                    </DropdownMenuItem>
                                                     <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                            </DropdownMenuItem>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                                <AlertDialogDescription>This will permanently delete "{miqaat.name}" and all its attendance records.</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDelete(miqaat.id)}>Delete</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        ) : null }
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground">
                {miqaats.length === 0 ? "No Miqaats created yet. Add one to get started." : "No Miqaats found matching your search."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      
       <AlertDialog open={showBarcodeDialog} onOpenChange={setShowBarcodeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Barcode for {barcodeMiqaat?.name}</AlertDialogTitle>
            <AlertDialogDescription>
              Scan this barcode for attendance marking.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-center items-center my-4 p-4 bg-white rounded-lg shadow-inner">
            {(barcodeMiqaat?.barcodeData || barcodeMiqaat?.id) ? (
              <QRCodeSVG
                value={barcodeMiqaat.barcodeData || barcodeMiqaat.id}
                size={250}
                bgColor={"#ffffff"}
                fgColor={"#000000"}
                level={"Q"}
                includeMargin={true}
              />
            ) : (
              <p className="text-muted-foreground">Barcode data not available.</p>
            )}
          </div>
          <p className="text-center text-sm text-muted-foreground">Data: {barcodeMiqaat?.barcodeData || barcodeMiqaat?.id || 'N/A'}</p>
          <AlertDialogFooter>
            <Button variant="outline" disabled> 
              <Download className="mr-2 h-4 w-4" />
              Download (Coming Soon)
            </Button>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
