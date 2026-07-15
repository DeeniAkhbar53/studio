
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Mohallah, User, UserRole } from "@/types";
import { PlusCircle, Edit, Trash2, Loader2, Home, Pencil, ShieldAlert } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Form, FormField, FormControl, FormMessage, FormItem, FormLabel as ShadFormLabel } from "@/components/ui/form";
import { getMohallahs, addMohallah, updateMohallahName, deleteMohallah as fbDeleteMohallah } from "@/lib/firebase/mohallahService";
import { getUsers } from "@/lib/firebase/userService"; 
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent as AlertContent, AlertDialogDescription as AlertDesc, AlertDialogFooter as AlertFooter, AlertDialogHeader as AlertHeader, AlertDialogTitle as AlertTitle, AlertDialogTrigger as AlertTrigger } from "@/components/ui/alert-dialog";
import { allNavItems, findNavItem } from "@/components/dashboard/sidebar-nav";
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

  const [selectedMohallahIds, setSelectedMohallahIds] = useState<string[]>([]);
  const [isBulkAlertOpen, setIsBulkAlertOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const mohallahForm = useForm<MohallahFormValues>({
    resolver: zodResolver(mohallahFormSchema),
    defaultValues: { name: "" },
  });

  useEffect(() => {
    const role = typeof window !== 'undefined' ? localStorage.getItem('userRole') as UserRole : null;
    const pageRights = JSON.parse(localStorage.getItem('userPageRights') || '[]');
    const navItem = findNavItem('/dashboard/manage-mohallahs');
    
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

  const handleDeleteMohallah = async (mohallahId: string, name: string) => {
    try {
      await fbDeleteMohallah(mohallahId);
      toast({ title: "Mohallah Deleted", description: `Mohallah "${name}" and all associated data have been permanently deleted.`});
      setSelectedMohallahIds(prev => prev.filter(id => id !== mohallahId));
    } catch (error) {
      toast({ title: "Database Error", description: "Could not delete Mohallah.", variant: "destructive" });
    }
  };

  const handleSelectMohallah = (id: string, checked: boolean) => {
    setSelectedMohallahIds(prev => checked ? [...prev, id] : prev.filter(x => x !== id));
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedMohallahIds(checked ? mohallahs.map(m => m.id) : []);
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      await Promise.all(selectedMohallahIds.map(id => fbDeleteMohallah(id)));
      toast({
        title: "Mohallahs Deleted",
        description: `Successfully deleted ${selectedMohallahIds.length} Mohallah(s) and all their associated data.`
      });
      setSelectedMohallahIds([]);
      setIsBulkAlertOpen(false);
    } catch (error) {
      toast({
        title: "Error Deleting Mohallahs",
        description: "An error occurred while performing bulk deletion.",
        variant: "destructive"
      });
    } finally {
      setIsBulkDeleting(false);
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
               <div className="flex items-center gap-2 shrink-0">
                 {selectedMohallahIds.length > 0 && (
                   <AlertDialog open={isBulkAlertOpen} onOpenChange={setIsBulkAlertOpen}>
                     <AlertTrigger asChild>
                       <Button variant="destructive" size="sm" className="shrink-0">
                         <Trash2 className="h-4 w-4 md:mr-2" />
                         <span className="hidden md:inline">Delete Selected ({selectedMohallahIds.length})</span>
                       </Button>
                     </AlertTrigger>
                     <AlertContent>
                       <AlertHeader>
                         <AlertTitle>Are you absolutely sure?</AlertTitle>
                         <AlertDesc>
                           This action cannot be undone. This will permanently delete the <strong>{selectedMohallahIds.length}</strong> selected Mohallah(s), along with all their associated teams and members.
                         </AlertDesc>
                       </AlertHeader>
                       <AlertFooter>
                         <AlertDialogCancel>Cancel</AlertDialogCancel>
                         <AlertDialogAction
                           onClick={handleBulkDelete}
                           className="bg-destructive hover:bg-destructive/90"
                           disabled={isBulkDeleting}
                         >
                           {isBulkDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                           Delete All Selected
                         </AlertDialogAction>
                       </AlertFooter>
                     </AlertContent>
                   </AlertDialog>
                 )}
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
               </div>
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
                      <div className="flex items-center px-2">
                        {canManage && (
                          <Checkbox
                            checked={selectedMohallahIds.includes(mohallah.id)}
                            onCheckedChange={(checked) => handleSelectMohallah(mohallah.id, !!checked)}
                            onClick={(e) => e.stopPropagation()}
                            className="mr-3 shrink-0"
                            aria-label={`Select mohallah ${mohallah.name}`}
                          />
                        )}
                        <AccordionTrigger className="flex-1 py-4 hover:no-underline">
                          <div className="font-semibold text-card-foreground text-left">{mohallah.name}</div>
                        </AccordionTrigger>
                      </div>
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
                                    This action cannot be undone. This will permanently delete the Mohallah "{mohallah.name}" along with all its associated teams and members.
                                  </AlertDesc>
                                </AlertHeader>
                                <AlertFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteMohallah(mohallah.id, mohallah.name)} className="bg-destructive hover:bg-destructive/90">
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
                      {canManage && (
                        <TableHead className="w-[50px]">
                          <Checkbox
                            checked={mohallahs.length > 0 && selectedMohallahIds.length === mohallahs.length}
                            onCheckedChange={(checked) => handleSelectAll(!!checked)}
                            aria-label="Select all mohallahs"
                          />
                        </TableHead>
                      )}
                      <TableHead>Mohallah Name</TableHead>
                      {canManage && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mohallahs.map((mohallah) => (
                      <TableRow key={mohallah.id} data-state={selectedMohallahIds.includes(mohallah.id) ? "selected" : undefined}>
                        {canManage && (
                          <TableCell>
                            <Checkbox
                              checked={selectedMohallahIds.includes(mohallah.id)}
                              onCheckedChange={(checked) => handleSelectMohallah(mohallah.id, !!checked)}
                              aria-label={`Select mohallah ${mohallah.name}`}
                            />
                          </TableCell>
                        )}
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
                                    This action cannot be undone. This will permanently delete the Mohallah "{mohallah.name}" along with all its associated teams and members.
                                  </AlertDesc>
                                </AlertHeader>
                                <AlertFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteMohallah(mohallah.id, mohallah.name)}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
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
