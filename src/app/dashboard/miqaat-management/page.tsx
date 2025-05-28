
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // Keep this if used outside RHF context
import { MiqaatCard } from "@/components/dashboard/miqaat-card";
import type { Miqaat } from "@/types";
import { PlusCircle, Search, Loader2 } from "lucide-react"; // Added Loader2
import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Form, FormField, FormItem, FormControl, FormMessage, FormLabel as ShadFormLabel, FormDescription } from "@/components/ui/form";
import { getMiqaats, addMiqaat, updateMiqaat, deleteMiqaat as fbDeleteMiqaat, MiqaatDataForAdd, MiqaatDataForUpdate } from "@/lib/firebase/miqaatService"; // Import Firestore service

const miqaatSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  location: z.string().optional(),
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid start date" }),
  endTime: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid end date" }),
  teams: z.string().transform(val => val.split(',').map(s => s.trim()).filter(Boolean)),
  barcodeData: z.string().optional(),
});

type MiqaatFormValues = z.infer<typeof miqaatSchema>;

export default function MiqaatManagementPage() {
  const [miqaats, setMiqaats] = useState<Miqaat[]>([]);
  const [isLoadingMiqaats, setIsLoadingMiqaats] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMiqaat, setEditingMiqaat] = useState<Miqaat | null>(null);
  const { toast } = useToast();

  const form = useForm<MiqaatFormValues>({
    resolver: zodResolver(miqaatSchema),
    defaultValues: {
      name: "",
      location: "",
      startTime: "",
      endTime: "",
      teams: "",
      barcodeData: "",
    },
  });

  const fetchAndSetMiqaats = useCallback(async () => {
    setIsLoadingMiqaats(true);
    try {
      const fetchedMiqaats = await getMiqaats();
      setMiqaats(fetchedMiqaats);
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch Miqaats.", variant: "destructive" });
      console.error("Failed to fetch Miqaats:", error);
    } finally {
      setIsLoadingMiqaats(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAndSetMiqaats();
  }, [fetchAndSetMiqaats]);

  useEffect(() => {
    if (editingMiqaat) {
      form.reset({
        name: editingMiqaat.name,
        location: editingMiqaat.location || "",
        startTime: new Date(editingMiqaat.startTime).toISOString().substring(0, 16),
        endTime: new Date(editingMiqaat.endTime).toISOString().substring(0, 16),
        teams: editingMiqaat.teams.join(", "),
        barcodeData: editingMiqaat.barcodeData || "",
      });
    } else {
      form.reset({ name: "", location: "", startTime: "", endTime: "", teams: "", barcodeData: "" });
    }
  }, [editingMiqaat, form, isDialogOpen]);

  const handleFormSubmit = async (values: MiqaatFormValues) => {
    const miqaatPayload = {
      name: values.name,
      location: values.location || undefined, // Store as undefined if empty, not ""
      startTime: new Date(values.startTime).toISOString(),
      endTime: new Date(values.endTime).toISOString(),
      teams: values.teams, // Zod transform ensures this is an array
      barcodeData: values.barcodeData || undefined, // Store as undefined if empty
    };
    
    form.formState.isSubmitting; // to ensure this is accessed if needed later

    try {
      if (editingMiqaat) {
        await updateMiqaat(editingMiqaat.id, miqaatPayload as MiqaatDataForUpdate);
        toast({ title: "Miqaat Updated", description: `"${values.name}" has been updated.` });
      } else {
        await addMiqaat(miqaatPayload as MiqaatDataForAdd);
        toast({ title: "Miqaat Created", description: `"${values.name}" has been added.` });
      }
      fetchAndSetMiqaats(); // Refresh the list
      setIsDialogOpen(false);
      setEditingMiqaat(null);
    } catch (error) {
        console.error("Error saving Miqaat:", error);
        toast({ title: "Database Error", description: `Could not save Miqaat data. ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
    }
  };

  const handleEdit = (miqaat: Miqaat) => {
    setEditingMiqaat(miqaat);
    setIsDialogOpen(true);
  };

  const handleDelete = async (miqaatId: string) => {
    try {
      await fbDeleteMiqaat(miqaatId);
      toast({ title: "Miqaat Deleted", description: "The Miqaat has been deleted.", variant: "destructive" });
      fetchAndSetMiqaats(); // Refresh the list
    } catch (error) {
      console.error("Error deleting Miqaat:", error);
      toast({ title: "Database Error", description: "Could not delete Miqaat.", variant: "destructive" });
    }
  };

  const filteredMiqaats = miqaats.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.location || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Manage Miqaats</CardTitle>
            <CardDescription>Create, view, and manage all Miqaats from Firestore.</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingMiqaat(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => {setEditingMiqaat(null); form.reset(); setIsDialogOpen(true);}}>
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
                <form onSubmit={form.handleSubmit(handleFormSubmit)} className="grid gap-4 py-4">
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
                  <FormField control={form.control} name="teams" render={({ field }) => (
                    <FormItem className="grid grid-cols-4 items-start gap-x-4 gap-y-1">
                      <ShadFormLabel htmlFor="teams" className="text-right pt-2">Teams</ShadFormLabel>
                      <div className="col-span-3 space-y-1">
                        <FormControl>
                          <Input id="teams" placeholder="e.g. Alpha, Bravo, Charlie" {...field} />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Comma-separated list of teams.
                        </FormDescription>
                        <FormMessage className="text-xs" />
                      </div>
                    </FormItem>
                  )} />
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
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                      {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {editingMiqaat ? "Save Changes" : "Create Miqaat"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search Miqaats by name or location..."
                className="pl-8 w-full md:w-1/3"
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
            <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {filteredMiqaats.map((miqaat) => (
                <MiqaatCard key={miqaat.id} miqaat={miqaat} onEdit={handleEdit} onDelete={handleDelete} />
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
