
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Mohallah, User, UserRole } from "@/types";
import { PlusCircle, Edit, Trash2, Loader2, Home, Pencil } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from 'next/navigation';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Form, FormField, FormControl, FormMessage, FormItem, FormLabel as ShadFormLabel } from "@/components/ui/form";
import { getMohallahs, addMohallah, updateMohallahName, deleteMohallah as fbDeleteMohallah } from "@/lib/firebase/mohallahService";
import { getUsers } from "@/lib/firebase/userService"; 
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent as AlertContent, AlertDialogDescription as AlertDesc, AlertDialogFooter as AlertFooter, AlertDialogHeader as AlertHeader, AlertDialogTitle as AlertTitle, AlertDialogTrigger as AlertTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import type { Unsubscribe } from "firebase/firestore";
import { allNavItems } from "@/components/dashboard/sidebar-nav";

const mohallahFormSchema = z.object({
  name: z.string().min(3, "Mohallah name must be at least 3 characters"),
});
type MohallahFormValues = z.infer<typeof mohallahFormSchema>;

export default function ManageMohallahsPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [mohallahs, setMohallahs] = useState<Mohallah[]>([]);
  const [isLoadingMohallahs, setIsLoadingMohallahs] = useState(true);
  const [members, setMembers] = useState<User[]>([]); 
  const [isLoadingMembers, setIsLoadingMembers] = useState(true); 
  
  const [isMohallahDialogOpen, setIsMohallahDialogOpen] = useState(false);
  const [editingMohallah, setEditingMohallah] = useState<Mohallah | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const { toast } = useToast();

  const mohallahForm = useForm<MohallahFormValues>({
    resolver: zodResolver(mohallahFormSchema),
    defaultValues: { name: "" },
  });

  useEffect(() => {
    const role = localStorage.getItem('userRole') as UserRole | null;
    const pageRights = JSON.parse(localStorage.getItem('userPageRights') || '[]');
    setCurrentUserRole(role);

    const navItem = allNavItems.find(item => item.href === '/dashboard/manage-mohallahs');
    const hasRoleAccess = navItem?.allowedRoles ? navItem.allowedRoles.includes(role || 'user') : false;
    const hasPageRight = pageRights.includes('/dashboard/manage-mohallahs');

    if (!role || (!hasRoleAccess && !hasPageRight)) {
      router.replace('/dashboard');
    } else {
      setIsAuthorized(true);
    }
  }, [router]);

  useEffect(() => {
    if (!isAuthorized) return;

    const role = localStorage.getItem('userRole') as UserRole | null;
    setCurrentUserRole(role);

    setIsLoadingMohallahs(true);
    const unsubscribeMohallahs = getMohallahs((fetchedMohallahs) => {
      setMohallahs(fetchedMohallahs);
      setIsLoadingMohallahs(false);
    });

    const fetchInitialMembers = async () => {
      setIsLoadingMembers(true);
      try {
        const fetchedMembers = await getUsers(); 
        setMembers(fetchedMembers);
      } catch (error) {
        toast({ title: "Error", description: "Failed to fetch Members for validation.", variant: "destructive" });
        console.error("Failed to fetch Members:", error);
      } finally {
        setIsLoadingMembers(false);
      }
    };
    fetchInitialMembers();

    return () => {
      unsubscribeMohallahs();
    };
  }, [isAuthorized, toast]);

  useEffect(() => {
    if (editingMohallah) {
      mohallahForm.reset({ name: editingMohallah.name });
    } else {
      mohallahForm.reset({ name: "" });
    }
  }, [editingMohallah, mohallahForm, isMohallahDialogOpen]);

  const handleMohallahFormSubmit = async (values: MohallahFormValues) => {
    try {
      if (editingMohallah) {
        await updateMohallahName(editingMohallah.id, values.name);
        toast({ title: "Mohallah Updated", description: `Mohallah "${values.name}" has been updated.` });
      } else {
        await addMohallah(values.name);
        toast({ title: "Mohallah Added", description: `Mohallah "${values.name}" has been added.` });
      }
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
    if (isLoadingMembers) {
        toast({ title: "Please wait", description: "Checking member assignments...", variant: "default" });
        return;
    }
    try {
      const currentMembers = await getUsers(); 
      setMembers(currentMembers);
      const membersInMohallah = currentMembers.filter(member => member.mohallahId === mohallah.id);
      if (membersInMohallah.length > 0) {
        toast({
          title: "Cannot Delete Mohallah",
          description: `Mohallah "${mohallah.name}" has ${membersInMohallah.length} member(s) assigned. Please reassign or delete them before deleting this Mohallah.`,
          variant: "destructive",
          duration: 7000,
        });
        return;
      }
      await fbDeleteMohallah(mohallah.id);
      toast({ title: "Mohallah Deleted", description: `Mohallah "${mohallah.name}" has been deleted.`});
    } catch (error) {
      console.error("Error deleting Mohallah:", error);
      toast({ title: "Database Error", description: "Could not delete Mohallah.", variant: "destructive" });
    }
  };

  const canManage = currentUserRole === 'admin' || currentUserRole === 'superadmin';

  if (!isAuthorized) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Verifying access...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <div className="flex-grow">
              <CardTitle className="flex items-center"><Home className="mr-2 h-5 w-5 text-primary" />Manage Mohallahs</CardTitle>
              <CardDescription className="mt-1">Add, edit, or delete Mohallahs. List updates in realtime.</CardDescription>
            </div>
            {canManage && (
              <Dialog open={isMohallahDialogOpen} onOpenChange={(open) => { setIsMohallahDialogOpen(open); if (!open) setEditingMohallah(null); }}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setEditingMohallah(null); setIsMohallahDialogOpen(true); }} className="w-full md:w-auto self-start md:self-center" size="sm">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add New Mohallah
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>{editingMohallah ? "Edit Mohallah Name" : "Add New Mohallah"}</DialogTitle>
                    <DialogDescription>
                      {editingMohallah ? "Update the name of this Mohallah." : "Enter the name for the new Mohallah."}
                    </DialogDescription>
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
                        <Button type="submit" disabled={mohallahForm.formState.isSubmitting || isLoadingMembers}>
                            {(mohallahForm.formState.isSubmitting || isLoadingMembers) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingMohallah ? "Save Changes" : "Add Mohallah"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <Separator />
        </CardHeader>
        <CardContent>
          {isLoadingMohallahs ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading Mohallahs data...</p>
            </div>
          ) : mohallahs.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No Mohallahs found. Add one to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mohallah Name</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mohallahs.map((mohallah) => (
                    <TableRow key={mohallah.id}>
                      <TableCell className="font-medium">{mohallah.name}</TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleEditMohallah(mohallah)} className="mr-2" aria-label="Edit Mohallah">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" aria-label="Delete Mohallah">
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
                                  disabled={isLoadingMembers}
                                >
                                  {isLoadingMembers && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                  Delete
                                </AlertDialogAction>
                              </AlertFooter>
                            </AlertContent>
                          </AlertDialog>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
         <CardFooter>
            <p className="text-xs text-muted-foreground">Total Mohallahs: {mohallahs.length}</p>
        </CardFooter>
      </Card>
    </div>
  );
}
