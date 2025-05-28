"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MiqaatCard } from "@/components/dashboard/miqaat-card";
import type { Miqaat } from "@/types";
import { PlusCircle, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";

const miqaatSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  location: z.string().optional(),
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid start date" }),
  endTime: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid end date" }),
  teams: z.string().transform(val => val.split(',').map(s => s.trim()).filter(Boolean)), // Comma-separated string to array
});

type MiqaatFormValues = z.infer<typeof miqaatSchema>;

const initialMiqaats: Miqaat[] = [
  { id: "m1", name: "Miqaat Al-Layl", startTime: new Date(2024, 9, 10, 19, 0).toISOString(), endTime: new Date(2024, 9, 10, 21, 0).toISOString(), teams: ["Alpha", "Bravo"], location: "Main Hall", barcodeData: "MLAYL20241010" },
  { id: "m2", name: "Ashara Mubarakah - Day 1", startTime: new Date(2024, 9, 15, 9, 0).toISOString(), endTime: new Date(2024, 9, 15, 12, 0).toISOString(), teams: ["Alpha", "Bravo", "Charlie"], location: "Community Center", barcodeData: "ASHARA0120241015" },
  { id: "m3", name: "Eid Majlis", startTime: new Date(2024, 10, 1, 8, 0).toISOString(), endTime: new Date(2024, 10, 1, 10, 0).toISOString(), teams: ["All Teams"], location: "Masjid Complex", barcodeData: "EIDMAJ20241101" },
];


export default function MiqaatManagementPage() {
  const [miqaats, setMiqaats] = useState<Miqaat[]>(initialMiqaats);
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
    },
  });

  useEffect(() => {
    if (editingMiqaat) {
      form.reset({
        name: editingMiqaat.name,
        location: editingMiqaat.location || "",
        startTime: new Date(editingMiqaat.startTime).toISOString().substring(0, 16), // Format for datetime-local
        endTime: new Date(editingMiqaat.endTime).toISOString().substring(0, 16), // Format for datetime-local
        teams: editingMiqaat.teams.join(", "),
      });
    } else {
      form.reset({ name: "", location: "", startTime: "", endTime: "", teams: "" });
    }
  }, [editingMiqaat, form, isDialogOpen]);

  const handleFormSubmit = (values: MiqaatFormValues) => {
    const miqaatData : Omit<Miqaat, 'id' | 'barcodeData'> & { id?: string; barcodeData?: string } = {
      ...values,
      teams: Array.isArray(values.teams) ? values.teams : values.teams.split(',').map(s => s.trim()).filter(Boolean),
      startTime: new Date(values.startTime).toISOString(),
      endTime: new Date(values.endTime).toISOString(),
    };

    if (editingMiqaat) {
      setMiqaats(miqaats.map(m => m.id === editingMiqaat.id ? { ...editingMiqaat, ...miqaatData } : m));
      toast({ title: "Miqaat Updated", description: `"${values.name}" has been updated.` });
    } else {
      const newMiqaat: Miqaat = {
        ...miqaatData,
        id: `m${Date.now()}`, // simple id generation
        barcodeData: `BARCODE${Date.now()}`, // simple barcode data
      };
      setMiqaats([newMiqaat, ...miqaats]);
      toast({ title: "Miqaat Created", description: `"${values.name}" has been added.` });
    }
    setIsDialogOpen(false);
    setEditingMiqaat(null);
  };

  const handleEdit = (miqaat: Miqaat) => {
    setEditingMiqaat(miqaat);
    setIsDialogOpen(true);
  };

  const handleDelete = (miqaatId: string) => {
    setMiqaats(miqaats.filter(m => m.id !== miqaatId));
    toast({ title: "Miqaat Deleted", description: "The Miqaat has been deleted.", variant: "destructive" });
  };

  const filteredMiqaats = miqaats.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Manage Miqaats</CardTitle>
            <CardDescription>Create, view, and manage all Miqaats.</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingMiqaat(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => {setEditingMiqaat(null); setIsDialogOpen(true);}}>
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
              <form onSubmit={form.handleSubmit(handleFormSubmit)} className="grid gap-4 py-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Name</Label>
                    <Input id="name" {...field} className="col-span-3" />
                    {form.formState.errors.name && <p className="col-span-4 text-red-500 text-xs text-right">{form.formState.errors.name.message}</p>}
                  </div>
                )} />
                <FormField control={form.control} name="location" render={({ field }) => (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="location" className="text-right">Location</Label>
                    <Input id="location" {...field} className="col-span-3" />
                  </div>
                )} />
                 <FormField control={form.control} name="startTime" render={({ field }) => (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="startTime" className="text-right">Start Time</Label>
                    <Input id="startTime" type="datetime-local" {...field} className="col-span-3" />
                    {form.formState.errors.startTime && <p className="col-span-4 text-red-500 text-xs text-right">{form.formState.errors.startTime.message}</p>}
                  </div>
                )} />
                <FormField control={form.control} name="endTime" render={({ field }) => (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="endTime" className="text-right">End Time</Label>
                    <Input id="endTime" type="datetime-local" {...field} className="col-span-3" />
                     {form.formState.errors.endTime && <p className="col-span-4 text-red-500 text-xs text-right">{form.formState.errors.endTime.message}</p>}
                  </div>
                )} />
                <FormField control={form.control} name="teams" render={({ field }) => (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="teams" className="text-right">Teams</Label>
                    <Input id="teams" placeholder="e.g. Alpha, Bravo, Charlie" {...field} className="col-span-3" />
                    <p className="col-start-2 col-span-3 text-xs text-muted-foreground">Comma-separated list of teams.</p>
                  </div>
                )} />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button type="submit">{editingMiqaat ? "Save Changes" : "Create Miqaat"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search Miqaats by name..."
                className="pl-8 w-full md:w-1/3"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          {filteredMiqaats.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {filteredMiqaats.map((miqaat) => (
                <MiqaatCard key={miqaat.id} miqaat={miqaat} onEdit={handleEdit} onDelete={handleDelete} />
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground">No Miqaats found matching your search.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}