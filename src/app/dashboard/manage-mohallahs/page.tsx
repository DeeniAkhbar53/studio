"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Mohallah, User, UserRole } from "@/types";
import { PlusCircle, Edit, Trash2, Loader2, Home, Pencil, ShieldAlert } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Form, FormField, FormControl, FormMessage, FormItem, FormLabel as ShadFormLabel } from "@/components/ui/form";
import { getMohallahs, addMohallah, updateMohallahName, deleteMohallah as fbDeleteMohallah } from "@/lib/firebase/mohallahService";
import { getUsers } from "@/lib/firebase/userService"; 
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent as AlertContent, AlertDialogDescription as AlertDesc, AlertDialogFooter as AlertFooter, AlertDialogHeader as AlertHeader, AlertDialogTitle as AlertTitle, AlertDialogTrigger as AlertTrigger } from "@/components/ui/alert-dialog";
import { allNavItems } from "@/components/dashboard/sidebar-nav";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FunkyLoader } from "@/components/ui/funky-loader";

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
    const role = typeof window !== "undefined" ? localStorage.getItem('userRole') as UserRole : null;
    const pageRightsRaw = typeof window !== "undefined" ? localStorage.getItem('userPageRights') : '[]';
    const pageRights = JSON.parse(pageRightsRaw || '[]');
    const navItem = allNavItems.find(item => item.href === '/dashboard/manage-mohallahs');
    
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
      
      toast({ title: "Database Error", description: "Could not delete Mohallah.", variant: "destructive" });
    }
  };

  const canManage = currentUserRole === 'admin' || currentUserRole === 'superadmin';

  if (isAuthorized === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <FunkyLoader size="lg" />
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
           <div className="flex flex-row justify-between items-center gap-4">
            <div className="flex-grow">
              <CardTitle className="flex items-center"><Home className="mr-2 h-5 w-5 text-primary" />Manage Mohallahs</CardTitle>
              <CardDescription className="mt-1">Add, edit, or delete Mohallahs. List updates in realtime.</CardDescription>
            </div>
            {canManage && (
              <Dialog open={isMohallahDialogOpen} onOpenChange={(open) => { setIsMohallahDialogOpen(open); if (!open) setEditingMohallah(null); }}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setEditingMohallah(null); setIsMohallahDialogOpen(true); }} size="sm" className="shrink-0">
                    <PlusCircle className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">Add New Mohallah</span>
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
        </CardHeader>
        <CardContent>
          {isLoadingMohallahs ? (
            <div className="flex justify-center items-center py-10">
              <FunkyLoader>Loading Mohallahs data...</FunkyLoader>
            </div>
          ) : mohallahs.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">No Mohallahs found. Add one to get started.</div>
          ) : (
            <>
              {/* Mobile View: Accordion */}
              <div className="md:hidden">
                <Accordion type="single" collapsible className="w-full">
                  {mohallahs.map((mohallah) => (
                    <AccordionItem value={mohallah.id} key={mohallah.id}>
                      <AccordionTrigger>
                        <div className="font-semibold text-card-foreground">{mohallah.name}</div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2">
                        {canManage && (
                          <div className="flex justify-end gap-2 px-2">
                            <Button variant="outline" size="sm" onClick={() => handleEditMohallah(mohallah)}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </Button>
                            <AlertDialog>
                              <AlertTrigger asChild>
                                <Button variant="destructive" size="sm">
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </Button>
                              </AlertTrigger>
                              <AlertContent>
                                <AlertHeader>
                                  <AlertTitle>Are you sure?</AlertTitle>
                                  <AlertDesc>
                                    This will permanently delete "{mohallah.name}". Ensure no members are assigned before deleting.
                                  </AlertDesc>
                                </AlertHeader>
                                <AlertFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteMohallah(mohallah)} className="bg-destructive hover:bg-destructive/90" disabled={isLoadingMembers}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertFooter>
                              </AlertContent>
                            </AlertDialog>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>

              {/* Desktop View: Table */}
              <div className="hidden md:block overflow-x-auto border rounded-lg">
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
            </>
          )}
        </CardContent>
         <CardFooter>
            <p className="text-xs text-muted-foreground">Total Mohallahs: {mohallahs.length}</p>
        </CardFooter>
      </Card>
    </div>
  );
}
