
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { MiqaatCard } from "@/components/dashboard/miqaat-card";
import type { Miqaat, UserRole, Mohallah } from "@/types";
import { PlusCircle, Search, Loader2, CalendarDays, ShieldAlert } from "lucide-react"; 
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Form, FormField, FormItem, FormControl, FormMessage, FormLabel as ShadFormLabel, FormDescription } from "@/components/ui/form";
import { getMiqaats, addMiqaat, updateMiqaat, deleteMiqaat as fbDeleteMiqaat, MiqaatDataForAdd, MiqaatDataForUpdate } from "@/lib/firebase/miqaatService";
import { getMohallahs } from "@/lib/firebase/mohallahService";
import { getUniqueTeamNames } from "@/lib/firebase/userService"; 
import { Separator } from "@/components/ui/separator";
import { allNavItems } from "@/components/dashboard/sidebar-nav";

const miqaatSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  location: z.string().optional(),
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid start date" }),
  endTime: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid end date" }),
  reportingTime: z.string().optional().nullable()
    .refine(val => !val || val === "" || !isNaN(Date.parse(val)), { message: "Invalid reporting date if provided" }),
  mohallahIds: z.array(z.string()).optional().default([]),
  teams: z.array(z.string()).optional().default([]), 
  barcodeData: z.string().optional(),
});

type MiqaatFormValues = z.infer<typeof miqaatSchema>;

export default function MiqaatManagementPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [miqaats, setMiqaats] = useState<Pick<Miqaat, "id" | "name" | "startTime" | "endTime" | "reportingTime" | "mohallahIds" | "teams" | "location" | "barcodeData" | "attendance" | "createdAt">[]>([]);
  const [isLoadingMiqaats, setIsLoadingMiqaats] = useState(true);
  const [availableMohallahs, setAvailableMohallahs] = useState<Mohallah[]>([]);
  const [isLoadingMohallahs, setIsLoadingMohallahs] = useState(true);
  const [availableTeams, setAvailableTeams] = useState<string[]>([]); 
  const [isLoadingTeams, setIsLoadingTeams] = useState(true); 
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMiqaat, setEditingMiqaat] = useState<Pick<Miqaat, "id" | "name" | "startTime" | "endTime" | "reportingTime" | "mohallahIds" | "teams" | "location" | "barcodeData" | "attendance" | "createdAt"> | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const { toast } = useToast();

  const form = useForm<MiqaatFormValues>({
    resolver: zodResolver(miqaatSchema),
    defaultValues: {
      name: "",
      location: "",
      startTime: "",
      endTime: "",
      reportingTime: "",
      mohallahIds: [],
      teams: [], 
      barcodeData: "",
    },
  });

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
        // Redirect after a short delay to show the message
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

    setIsLoadingMiqaats(true);
    const unsubscribeMiqaats = getMiqaats((fetchedMiqaats) => {
      setMiqaats(fetchedMiqaats);
      setIsLoadingMiqaats(false);
    });

    setIsLoadingMohallahs(true);
    const unsubscribeMohallahs = getMohallahs((fetchedMohallahs) => {
      setAvailableMohallahs(fetchedMohallahs);
      setIsLoadingMohallahs(false);
    });

    setIsLoadingTeams(true); 
    getUniqueTeamNames()
      .then(setAvailableTeams)
      .catch(err => {
        console.error("Failed to fetch teams", err);
        toast({ title: "Error", description: "Could not load team data.", variant: "destructive" });
      })
      .finally(() => setIsLoadingTeams(false));

    return () => {
      unsubscribeMiqaats();
      unsubscribeMohallahs();
    };
  }, [isAuthorized, toast]);

  useEffect(() => {
    if (editingMiqaat) {
      form.reset({
        name: editingMiqaat.name,
        location: editingMiqaat.location || "",
        startTime: editingMiqaat.startTime ? new Date(editingMiqaat.startTime).toISOString().substring(0, 16) : "",
        endTime: editingMiqaat.endTime ? new Date(editingMiqaat.endTime).toISOString().substring(0, 16) : "",
        reportingTime: editingMiqaat.reportingTime ? new Date(editingMiqaat.reportingTime).toISOString().substring(0, 16) : "",
        mohallahIds: editingMiqaat.mohallahIds || [],
        teams: editingMiqaat.teams || [], 
        barcodeData: editingMiqaat.barcodeData || "",
      });
    } else {
      form.reset({ name: "", location: "", startTime: "", endTime: "", reportingTime: "", mohallahIds: [], teams: [], barcodeData: "" });
    }
  }, [editingMiqaat, form, isDialogOpen]);

  const handleFormSubmit = async (values: MiqaatFormValues) => {
    const dataForService: MiqaatDataForAdd | MiqaatDataForUpdate = {
      name: values.name,
      startTime: values.startTime,
      endTime: values.endTime,
      mohallahIds: values.mohallahIds || [],
      teams: values.teams || [], 
      location: values.location, 
      reportingTime: values.reportingTime, 
      barcodeData: values.barcodeData,
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

  const handleEdit = (miqaat: Pick<Miqaat, "id" | "name" | "startTime" | "endTime" | "reportingTime" | "mohallahIds" | "teams" | "location" | "barcodeData" | "attendance" | "createdAt">) => {
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
              <DialogContent className="sm:max-w-[525px]">
                <DialogHeader>
                  <DialogTitle>{editingMiqaat ? "Edit Miqaat" : "Create New Miqaat"}</DialogTitle>
                  <DialogDescription>
                    {editingMiqaat ? "Update the details of the Miqaat." : "Fill in the details for the new Miqaat."}
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleFormSubmit)} className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-x-4">
                        <ShadFormLabel htmlFor="name" className="text-right">Name</ShadFormLabel>
                        <FormControl className="col-span-3">
                          <Input id="name" {...field} />
                        </FormControl>
                        <FormMessage className="col-start-2 col-span-3 text-xs" />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="location" render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-x-4">
                        <ShadFormLabel htmlFor="location" className="text-right">Location</ShadFormLabel>
                        <FormControl className="col-span-3">
                          <Input id="location" placeholder="Optional" {...field} />
                        </FormControl>
                        <FormMessage className="col-start-2 col-span-3 text-xs" />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="startTime" render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-x-4">
                        <ShadFormLabel htmlFor="startTime" className="text-right">Start Time</ShadFormLabel>
                        <FormControl className="col-span-3">
                          <Input id="startTime" type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage className="col-start-2 col-span-3 text-xs" />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="endTime" render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-x-4">
                        <ShadFormLabel htmlFor="endTime" className="text-right">End Time</ShadFormLabel>
                        <FormControl className="col-span-3">
                          <Input id="endTime" type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage className="col-start-2 col-span-3 text-xs" />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="reportingTime" render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-x-4">
                        <ShadFormLabel htmlFor="reportingTime" className="text-right">Reporting Time</ShadFormLabel>
                        <FormControl className="col-span-3">
                          <Input id="reportingTime" type="datetime-local" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormDescription className="col-start-2 col-span-3 text-xs">Optional. Leave blank if not applicable.</FormDescription>
                        <FormMessage className="col-start-2 col-span-3 text-xs" />
                      </FormItem>
                    )} />
                    
                    <FormField
                      control={form.control}
                      name="mohallahIds"
                      render={({ field }) => (
                        <FormItem className="grid grid-cols-4 items-start gap-x-4">
                          <ShadFormLabel className="text-right pt-2 col-span-1">Assigned Mohallahs</ShadFormLabel>
                          <div className="col-span-3 space-y-1">
                            <div className="rounded-md border p-3 min-h-[60px] max-h-40 overflow-y-auto space-y-2 bg-background">
                              {isLoadingMohallahs ? (
                                <p className="text-sm text-muted-foreground">Loading Mohallahs...</p>
                              ) : availableMohallahs.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No Mohallahs found. Please add Mohallahs first.</p>
                              ) : (
                                availableMohallahs.map((mohallah) => (
                                  <div key={mohallah.id} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`mohallah-checkbox-${mohallah.id}`}
                                      checked={field.value?.includes(mohallah.id)}
                                      onCheckedChange={(checked) => {
                                        const currentMohallahIds = Array.isArray(field.value) ? field.value : [];
                                        if (checked) {
                                          field.onChange([...currentMohallahIds, mohallah.id]);
                                        } else {
                                          field.onChange(currentMohallahIds.filter((id) => id !== mohallah.id));
                                        }
                                      }}
                                    />
                                    <Label htmlFor={`mohallah-checkbox-${mohallah.id}`} className="font-normal text-sm">
                                      {mohallah.name}
                                    </Label>
                                  </div>
                                ))
                              )}
                            </div>
                            <FormDescription className="text-xs">Select Mohallahs for this Miqaat.</FormDescription>
                            <FormMessage className="text-xs" />
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="teams"
                      render={({ field }) => (
                        <FormItem className="grid grid-cols-4 items-start gap-x-4">
                          <ShadFormLabel className="text-right pt-2 col-span-1">Assigned Teams</ShadFormLabel>
                          <div className="col-span-3 space-y-1">
                            <div className="rounded-md border p-3 min-h-[60px] max-h-40 overflow-y-auto space-y-2 bg-background">
                              {isLoadingTeams ? (
                                <p className="text-sm text-muted-foreground">Loading Teams...</p>
                              ) : availableTeams.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No Teams found. Members need to be assigned teams first.</p>
                              ) : (
                                availableTeams.map((teamName) => (
                                  <div key={teamName} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`team-checkbox-${teamName.replace(/\s+/g, '-')}`}
                                      checked={field.value?.includes(teamName)}
                                      onCheckedChange={(checked) => {
                                        const currentTeamNames = Array.isArray(field.value) ? field.value : [];
                                        if (checked) {
                                          field.onChange([...currentTeamNames, teamName]);
                                        } else {
                                          field.onChange(currentTeamNames.filter((name) => name !== teamName));
                                        }
                                      }}
                                    />
                                    <Label htmlFor={`team-checkbox-${teamName.replace(/\s+/g, '-')}`} className="font-normal text-sm">
                                      {teamName}
                                    </Label>
                                  </div>
                                ))
                              )}
                            </div>
                            <FormDescription className="text-xs">Select Teams for this Miqaat.</FormDescription>
                            <FormMessage className="text-xs" />
                          </div>
                        </FormItem>
                      )}
                    />


                    <FormField control={form.control} name="barcodeData" render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-x-4">
                        <ShadFormLabel htmlFor="barcodeData" className="text-right">Barcode Data</ShadFormLabel>
                        <FormControl className="col-span-3">
                          <Input id="barcodeData" placeholder="Optional (auto-generates if empty)" {...field} />
                        </FormControl>
                        <FormMessage className="col-start-2 col-span-3 text-xs" />
                      </FormItem>
                    )} />
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={form.formState.isSubmitting || isLoadingMohallahs || isLoadingTeams}>
                        {(form.formState.isSubmitting || isLoadingMohallahs || isLoadingTeams) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredMiqaats.map((miqaat) => (
                <MiqaatCard key={miqaat.id} miqaat={miqaat as Miqaat} onEdit={handleEdit} onDelete={handleDelete} currentUserRole={currentUserRole} allMohallahs={availableMohallahs} />
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground">
                {miqaats.length === 0 ? "No Miqaats created yet. Add one to get started." : "No Miqaats found matching your search."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
