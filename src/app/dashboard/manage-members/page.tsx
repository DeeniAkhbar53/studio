
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import type { Mohallah, User, UserRole, UserDesignation, PageRightConfig } from "@/types";
import { PlusCircle, Search, Edit, Trash2, FileUp, Loader2, Users as UsersIcon, Download, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Form, FormField, FormControl, FormMessage, FormItem, FormLabel, FormDescription } from "@/components/ui/form";
import { getUsers, addUser, updateUser, deleteUser, getUserByItsOrBgkId } from "@/lib/firebase/userService";
import { getMohallahs } from "@/lib/firebase/mohallahService";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent as AlertContent, AlertDialogDescription as AlertDesc, AlertDialogFooter as AlertFooter, AlertDialogHeader as AlertHeader, AlertDialogTitle as AlertTitle, AlertDialogTrigger as AlertTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle as ShadAlertTitle, AlertDescription as ShadAlertDescription } from "@/components/ui/alert";
import Papa from 'papaparse';
import type { Unsubscribe } from "firebase/firestore";

const memberSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  itsId: z.string().min(8, "ITS ID must be 8 characters").max(8, "ITS ID must be 8 characters"),
  bgkId: z.string().optional().or(z.literal("")),
  team: z.string().optional().or(z.literal("")),
  phoneNumber: z.string().optional().or(z.literal("")),
  role: z.enum(["user", "admin", "superadmin", "attendance-marker"]),
  mohallahId: z.string().min(1, "Mohallah must be selected"),
  designation: z.enum(["Captain", "Vice Captain", "Member"]).optional().or(z.literal("")),
  pageRights: z.array(z.string()).optional().default([]),
});

type MemberFormValues = z.infer<typeof memberSchema>;

const roleDescriptions: Record<UserRole, string> = {
    user: "Regular user with basic access. Can scan their own attendance and view profile/notifications.",
    "attendance-marker": "Can mark attendance for members and view reports. Specific page access can be customized.",
    admin: "Can manage users, Miqaats, Mohallahs, and generate reports within their assigned Mohallah. Specific page access can be customized.",
    superadmin: "Full access to all system features and settings, across all Mohallahs. Specific page access can be customized.",
};

const AVAILABLE_PAGE_RIGHTS: PageRightConfig[] = [
  { id: 'mark-attendance', label: 'Mark Attendance', path: '/dashboard/mark-attendance', description: 'Allows user to mark attendance for others.' },
  { id: 'miqaat-management', label: 'Manage Miqaats', path: '/dashboard/miqaat-management', description: 'Create, edit, delete Miqaats.' },
  { id: 'manage-mohallahs', label: 'Manage Mohallahs', path: '/dashboard/manage-mohallahs', description: 'Create, edit, delete Mohallahs.' },
  { id: 'manage-members', label: 'Manage Members', path: '/dashboard/manage-members', description: 'Add, edit, delete members and assign roles/rights.' },
  { id: 'manage-notifications', label: 'Manage Notifications', path: '/dashboard/manage-notifications', description: 'Create and delete system-wide notifications.' },
  { id: 'reports', label: 'View Reports', path: '/dashboard/reports', description: 'Generate and view various attendance reports.' },
];

const ITEMS_PER_PAGE = 10;

export default function ManageMembersPage() {
  const [mohallahs, setMohallahs] = useState<Mohallah[]>([]);
  const [isLoadingMohallahs, setIsLoadingMohallahs] = useState(true);
  const [members, setMembers] = useState<User[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<User | null>(null);

  const [isCsvImportDialogOpen, setIsCsvImportDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCsvProcessing, setIsCsvProcessing] = useState(false);
  const { toast } = useToast();

  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [currentUserMohallahId, setCurrentUserMohallahId] = useState<string | null>(null);
  const [selectedFilterMohallahId, setSelectedFilterMohallahId] = useState<string>("all");
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isBulkDeleteAlertOpen, setIsBulkDeleteAlertOpen] = useState(false);

  const memberForm = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: { name: "", itsId: "", bgkId: "", team: "", phoneNumber: "", role: "user", mohallahId: "", designation: "Member", pageRights: [] },
  });

  const watchedRole = memberForm.watch("role");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const role = localStorage.getItem('userRole') as UserRole | null;
      const mohallahId = localStorage.getItem('userMohallahId');
      setCurrentUserRole(role);
      setCurrentUserMohallahId(mohallahId);
      if (role === 'admin' && mohallahId) {
        setSelectedFilterMohallahId(mohallahId);
      }
    }
  }, []);

  useEffect(() => {
    setIsLoadingMohallahs(true);
    const unsubscribeMohallahs = getMohallahs((fetchedMohallahs) => {
      setMohallahs(fetchedMohallahs);
      setIsLoadingMohallahs(false);
    });
    return () => unsubscribeMohallahs();
  }, []);

  const fetchAndSetMembers = useCallback(async (targetMohallahIdForFetch?: string) => {
    setIsLoadingMembers(true);
    setFetchError(null);
    setCurrentPage(1);
    setSelectedMemberIds([]);
    try {
        const fetchedMembers = await getUsers(targetMohallahIdForFetch);
        setMembers(fetchedMembers);
    } catch (error: any) {
        console.error("Failed to fetch members:", error);
        if (currentUserRole === 'superadmin' && (!targetMohallahIdForFetch || targetMohallahIdForFetch === 'all') && error.message.includes("index")) {
            const specificErrorMsg = "Could not fetch all members. This may be due to missing database indexes. Please select a specific Mohallah to view its members or configure database indexes in your console.";
            setFetchError(specificErrorMsg);
            toast({ title: "Data Fetch Warning", description: specificErrorMsg, variant: "destructive", duration: 10000 });
            setMembers([]);
        } else {
            toast({ title: "Error", description: "Failed to fetch members.", variant: "destructive" });
            setFetchError("Failed to fetch members. Please try again.");
            setMembers([]);
        }
    } finally {
        setIsLoadingMembers(false);
    }
  }, [toast, currentUserRole]);

  useEffect(() => {
    if (!currentUserRole) {
      setIsLoadingMembers(false);
      return;
    }

    let mohallahIdToFetch: string | undefined = undefined;

    if (currentUserRole === 'admin') {
      if (currentUserMohallahId) {
        mohallahIdToFetch = currentUserMohallahId;
        fetchAndSetMembers(mohallahIdToFetch);
      } else {
        setMembers([]);
        setIsLoadingMembers(false);
        setFetchError("Admin's Mohallah ID not found. Cannot display members.");
      }
    } else if (currentUserRole === 'superadmin') {
      mohallahIdToFetch = selectedFilterMohallahId === 'all' ? undefined : selectedFilterMohallahId;
      fetchAndSetMembers(mohallahIdToFetch);
    } else {
      // For other roles like 'user' or 'attendance-marker', they don't manage members here
      setMembers([]);
      setIsLoadingMembers(false);
    }
  }, [currentUserRole, currentUserMohallahId, selectedFilterMohallahId, fetchAndSetMembers]);


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
        designation: editingMember.designation || "Member",
        pageRights: editingMember.pageRights || [],
      });
    } else {
      let defaultMohallahForForm = "";
      if (currentUserRole === 'admin' && currentUserMohallahId) {
        defaultMohallahForForm = currentUserMohallahId;
      } else if (currentUserRole === 'superadmin') {
        defaultMohallahForForm = selectedFilterMohallahId !== 'all'
                              ? selectedFilterMohallahId
                              : (mohallahs.length > 0 ? mohallahs[0].id : "");
      }
      memberForm.reset({
        name: "", itsId: "", bgkId: "", team: "", phoneNumber: "", role: "user",
        mohallahId: defaultMohallahForForm,
        designation: "Member",
        pageRights: [],
      });
    }
  }, [editingMember, memberForm, isMemberDialogOpen, mohallahs, selectedFilterMohallahId, currentUserRole, currentUserMohallahId]);

  const handleMemberFormSubmit = async (values: MemberFormValues) => {
    const targetMohallahId = values.mohallahId;
    console.log("Attempting to save member. Payload before service call:", values, "Target Mohallah ID for path:", targetMohallahId);
    if (!targetMohallahId) {
        toast({ title: "Error", description: "Mohallah ID is missing.", variant: "destructive" });
        return;
    }

    const memberPayload: Omit<User, 'id' | 'avatarUrl'> & { avatarUrl?: string, designation?: UserDesignation, pageRights?: string[] } = {
      name: values.name,
      itsId: values.itsId,
      bgkId: values.bgkId,
      team: values.team,
      phoneNumber: values.phoneNumber,
      role: values.role as UserRole,
      mohallahId: targetMohallahId,
      designation: values.designation as UserDesignation || "Member",
      pageRights: values.role === 'user' ? [] : (values.pageRights || []),
    };

    console.log("Attempting to save member to Firestore. Payload for service:", memberPayload, "Target Mohallah ID for path:", targetMohallahId);

    try {
      if (editingMember && editingMember.mohallahId) {
        const updatePayload = { ...memberPayload };
        await updateUser(editingMember.id, editingMember.mohallahId, updatePayload);
        toast({ title: "Member Updated", description: `"${values.name}" has been updated.` });
      } else {
        await addUser(memberPayload, targetMohallahId);
        toast({ title: "Member Added", description: `"${values.name}" has been added to ${getMohallahNameById(targetMohallahId)}.` });
      }
      if (currentUserRole === 'admin' && currentUserMohallahId) {
        fetchAndSetMembers(currentUserMohallahId);
      } else if (currentUserRole === 'superadmin') {
        fetchAndSetMembers(selectedFilterMohallahId === 'all' ? undefined : selectedFilterMohallahId);
      }
      setIsMemberDialogOpen(false);
      setEditingMember(null);
    } catch (error) {
      console.error("Error saving member to database:", error);
      toast({ title: "Database Error", description: `Could not save member data. ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
    }
  };

  const handleEditMember = (member: User) => {
    setEditingMember(member);
    setIsMemberDialogOpen(true);
  };

  const handleDeleteMember = async (member: User) => {
    if (!member.mohallahId) {
      toast({ title: "Error", description: "Cannot delete member: Mohallah ID is missing.", variant: "destructive" });
      return;
    }
    try {
      await deleteUser(member.id, member.mohallahId);
      toast({ title: "Member Deleted", description: `"${member.name}" has been deleted.`});
      setSelectedMemberIds(prev => prev.filter(id => id !== member.id)); // Remove from selection
      if (currentUserRole === 'admin' && currentUserMohallahId) {
        fetchAndSetMembers(currentUserMohallahId);
      } else if (currentUserRole === 'superadmin') {
        fetchAndSetMembers(selectedFilterMohallahId === 'all' ? undefined : selectedFilterMohallahId);
      }
    } catch (error) {
      console.error("Error deleting member:", error);
      toast({ title: "Database Error", description: "Could not delete member.", variant: "destructive" });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedMemberIds.length === 0) {
      toast({ title: "No members selected", description: "Please select members to delete.", variant: "default" });
      setIsBulkDeleteAlertOpen(false);
      return;
    }

    let deletedCount = 0;
    let failedCount = 0;

    for (const memberId of selectedMemberIds) {
      const memberToDelete = members.find(m => m.id === memberId);
      if (memberToDelete && memberToDelete.mohallahId) {
        try {
          await deleteUser(memberToDelete.id, memberToDelete.mohallahId);
          deletedCount++;
        } catch (error) {
          console.error(`Error deleting member ${memberToDelete.name}:`, error);
          failedCount++;
        }
      } else {
        failedCount++; // Member not found or mohallahId missing
      }
    }

    toast({
      title: "Bulk Delete Complete",
      description: `${deletedCount} member(s) deleted. ${failedCount} failed.`,
      variant: failedCount > 0 ? "destructive" : "default",
    });

    setSelectedMemberIds([]);
    setIsBulkDeleteAlertOpen(false);
    if (currentUserRole === 'admin' && currentUserMohallahId) {
      fetchAndSetMembers(currentUserMohallahId);
    } else if (currentUserRole === 'superadmin') {
      fetchAndSetMembers(selectedFilterMohallahId === 'all' ? undefined : selectedFilterMohallahId);
    }
  };


  const handleProcessCsvUpload = async () => {
    if (!selectedFile) {
        toast({ title: "No file selected", description: "Please select a CSV file to upload.", variant: "destructive" });
        return;
    }
    setIsCsvProcessing(true);

    try {
      const fileContent = await selectedFile.text();
      Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          let successfullyAddedCount = 0;
          let skippedCount = 0;
          let errorCount = 0;
          const failedRecords: { data: any, reason: string }[] = [];

          const dataRows = results.data as any[];

          for (const row of dataRows) {
            if (Object.keys(row).length === 0 || Object.values(row).every(val => val === "" || val === null)) {
                continue;
            }
            if (!row.name || !row.itsId || !row.mohallahName || !row.role) {
              failedRecords.push({ data: row, reason: "Missing required fields (name, itsId, mohallahName, role)." });
              skippedCount++;
              continue;
            }

            const mohallah = mohallahs.find(m => m.name.toLowerCase() === row.mohallahName.toLowerCase());
            if (!mohallah) {
              failedRecords.push({ data: row, reason: `Mohallah "${row.mohallahName}" not found.` });
              skippedCount++;
              continue;
            }
            const mohallahId = mohallah.id;
            if (currentUserRole === 'admin' && mohallahId !== currentUserMohallahId) {
                failedRecords.push({ data: row, reason: `Admins can only import to their assigned Mohallah. Row skipped for Mohallah "${row.mohallahName}".` });
                skippedCount++;
                continue;
            }

            try {
              const existingUser = await getUserByItsOrBgkId(row.itsId);
              if (existingUser) {
                failedRecords.push({ data: row, reason: `User with ITS ID ${row.itsId} already exists.` });
                skippedCount++;
                continue;
              }
            } catch (err) {
               failedRecords.push({ data: row, reason: `Error checking duplicate for ITS ID ${row.itsId}.` });
               errorCount++;
               continue;
            }

            const memberPayload: Omit<User, 'id' | 'avatarUrl'> & { avatarUrl?: string } = {
              name: row.name,
              itsId: row.itsId,
              bgkId: row.bgkId || undefined,
              team: row.team || undefined,
              phoneNumber: row.phoneNumber || undefined,
              role: row.role as UserRole,
              mohallahId: mohallahId,
              designation: (row.designation as UserDesignation) || "Member",
              pageRights: row.pageRights ? row.pageRights.split(';').map((s: string) => s.trim()).filter(Boolean) : [],
            };

            const validation = memberSchema.safeParse({
                ...memberPayload,
                bgkId: memberPayload.bgkId || "",
                team: memberPayload.team || "",
                phoneNumber: memberPayload.phoneNumber || "",
            });

            if (!validation.success) {
                const errorMessages = Object.values(validation.error.flatten().fieldErrors).flat().join(' ');
                failedRecords.push({ data: row, reason: `Validation failed: ${errorMessages}` });
                skippedCount++;
                continue;
            }

            try {
              await addUser(validation.data, mohallahId);
              successfullyAddedCount++;
            } catch (dbError: any) {
              failedRecords.push({ data: row, reason: `DB Error: ${dbError.message}` });
              errorCount++;
            }
          }

          setIsCsvProcessing(false);
          setIsCsvImportDialogOpen(false);
          setSelectedFile(null);
          if (currentUserRole === 'admin' && currentUserMohallahId) {
            fetchAndSetMembers(currentUserMohallahId);
          } else if (currentUserRole === 'superadmin') {
            fetchAndSetMembers(selectedFilterMohallahId === 'all' ? undefined : selectedFilterMohallahId);
          }

           if (errorCount > 0 || (successfullyAddedCount === 0 && dataRows.length > 0)) {
            toast({
                title: "CSV Import Error",
                description: "Could not import users from CSV. See console for details.",
                variant: "destructive",
            });
          } else {
            toast({
                title: "CSV Import Successful",
                description: `Successfully processed CSV file.`,
            });
          }

          if (failedRecords.length > 0) {
            console.warn("CSV Import - Skipped/Failed Records:", failedRecords);
          }
        },
        error: (error: any) => {
          console.error("Error parsing CSV:", error);
          setIsCsvProcessing(false);
          toast({
            title: "CSV Parsing Error",
            description: `Could not parse file: ${error.message}.`,
            variant: "destructive",
          });
        }
      });
    } catch (error) {
      console.error("Error reading file:", error);
      setIsCsvProcessing(false);
      toast({
        title: "File Read Error",
        description: "Could not read the selected file.",
        variant: "destructive",
      });
    }
  };

  const downloadSampleCsv = () => {
    const csvHeaders = "name,itsId,bgkId,team,phoneNumber,role,mohallahName,designation,pageRights\n";
    const csvDummyData = [
      "Abbas Bhai,10101010,BGK001,Alpha Team,1234567890,user,Houston,Member,",
      "Fatema Ben,20202020,,Bravo Team,0987654321,attendance-marker,Dallas,Vice Captain,/dashboard/reports;/dashboard/mark-attendance",
      "Yusuf Bhai,30303030,BGK003,Alpha Team,,admin,Houston,Captain,/dashboard/reports;/dashboard/manage-members",
    ].join("\n");
    const csvContent = csvHeaders + csvDummyData;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "sample_members_import.csv");
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
     toast({ title: "Sample CSV Downloaded", description: "Replace dummy data. MohallahName must match existing. pageRights are semicolon-separated paths." });
  };

  const filteredMembers = useMemo(() => members.filter(m => {
    const searchTermMatch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            m.itsId.includes(searchTerm) ||
                            (mohallahs.find(moh => moh.id === m.mohallahId)?.name.toLowerCase() || "").includes(searchTerm.toLowerCase());
    return searchTermMatch;
  }), [members, searchTerm, mohallahs]);

  const totalPages = Math.ceil(filteredMembers.length / ITEMS_PER_PAGE);
  const currentMembersToDisplay = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredMembers.slice(startIndex, endIndex);
  }, [filteredMembers, currentPage]);

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const handleSelectAll = (checked: boolean | string) => {
    if (checked) {
      setSelectedMemberIds(currentMembersToDisplay.map(member => member.id));
    } else {
      setSelectedMemberIds([]);
    }
  };

  const handleSelectMember = (memberId: string, checked: boolean | string) => {
    if (checked) {
      setSelectedMemberIds(prev => [...prev, memberId]);
    } else {
      setSelectedMemberIds(prev => prev.filter(id => id !== memberId));
    }
  };

  const getMohallahNameById = (id?: string) => mohallahs.find(m => m.id === id)?.name || "N/A";

  const canAddOrImport = () => {
    if (isLoadingMohallahs) return false;
    if (currentUserRole === 'admin') return !!currentUserMohallahId;
    if (currentUserRole === 'superadmin') return true;
    return false;
  };

  const canManageMembers = currentUserRole === 'admin' || currentUserRole === 'superadmin';

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
            <div className="flex-grow">
              <CardTitle className="flex items-center"><UsersIcon className="mr-2 h-5 w-5 text-primary"/>Manage Members</CardTitle>
              <CardDescription className="mt-1">
                {currentUserRole === 'admin' && currentUserMohallahId
                  ? `Managing members for Mohallah: ${getMohallahNameById(currentUserMohallahId)}.`
                  : 'Add, view, and manage members. Data is stored in the system.'}
              </CardDescription>
            </div>
             {canManageMembers && (
                <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                   {selectedMemberIds.length > 0 && (
                     <AlertDialog open={isBulkDeleteAlertOpen} onOpenChange={setIsBulkDeleteAlertOpen}>
                        <AlertTrigger asChild>
                          <Button variant="destructive" size="icon" aria-label={`Delete ${selectedMemberIds.length} selected members`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertTrigger>
                        <AlertContent>
                          <AlertHeader>
                            <AlertTitle>Confirm Bulk Deletion</AlertTitle>
                            <AlertDesc>
                              Are you sure you want to delete {selectedMemberIds.length} selected member(s)? This action cannot be undone.
                            </AlertDesc>
                          </AlertHeader>
                          <AlertFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive hover:bg-destructive/90">
                              Delete Selected
                            </AlertDialogAction>
                          </AlertFooter>
                        </AlertContent>
                      </AlertDialog>
                  )}
                  <Button variant="outline" onClick={downloadSampleCsv} size="icon" aria-label="Download Sample CSV">
                      <Download className="h-4 w-4" />
                  </Button>
                  <Dialog open={isCsvImportDialogOpen} onOpenChange={(open) => { setIsCsvImportDialogOpen(open); if(!open) setSelectedFile(null); }}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="icon" aria-label="Import Members via CSV" disabled={!canAddOrImport()}>
                            <FileUp className="h-4 w-4" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[525px]">
                    <DialogHeader>
                        <DialogTitle>Import Members via CSV</DialogTitle>
                        <DialogDescription>
                        Select CSV file. Columns: `name`, `itsId`, `bgkId`, `team`, `phoneNumber`, `role`, `mohallahName`, `designation`, `pageRights` (semicolon-separated paths). MohallahName must exist. Admins can only import to their assigned Mohallah.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                        <FormLabel htmlFor="csvFile" className="text-right">
                            CSV File
                        </FormLabel>
                        <Input
                            id="csvFile"
                            type="file"
                            accept=".csv"
                            className="col-span-3"
                            onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                            disabled={isCsvProcessing}
                        />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => {setIsCsvImportDialogOpen(false); setSelectedFile(null);}} disabled={isCsvProcessing}>Cancel</Button>
                        <Button type="button" onClick={handleProcessCsvUpload} disabled={!selectedFile || isCsvProcessing || !canAddOrImport()}>
                        {isCsvProcessing ? (
                            <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                            </>
                        ) : (
                            "Upload and Process"
                        )}
                        </Button>
                    </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Dialog open={isMemberDialogOpen} onOpenChange={(open) => { setIsMemberDialogOpen(open); if (!open) setEditingMember(null); }}>
                    <DialogTrigger asChild>
                       <Button 
                        onClick={() => { setEditingMember(null); setIsMemberDialogOpen(true); }} 
                        size="icon" 
                        aria-label="Add New Member"
                        disabled={!canAddOrImport() || (currentUserRole === 'superadmin' && selectedFilterMohallahId === 'all' && mohallahs.length === 0 && !isLoadingMohallahs)}
                      >
                        <PlusCircle className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>{editingMember ? "Edit Member" : "Add New Member"}</DialogTitle>
                        <DialogDescription>
                          {editingMember ? "Update details." : `Add to Mohallah: ${getMohallahNameById(memberForm.getValues("mohallahId")) || "selected"}.`}
                        </DialogDescription>
                      </DialogHeader>
                      <Form {...memberForm}>
                        <form onSubmit={memberForm.handleSubmit(handleMemberFormSubmit)} className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                          <FormField control={memberForm.control} name="name" render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-x-4">
                              <FormLabel htmlFor="name" className="text-right">Name</FormLabel>
                              <FormControl><Input id="name" {...field} className="col-span-3" /></FormControl>
                              <FormMessage className="col-start-2 col-span-3 text-xs" />
                            </FormItem>
                          )} />
                          <FormField control={memberForm.control} name="itsId" render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-x-4">
                              <FormLabel htmlFor="itsId" className="text-right">ITS ID</FormLabel>
                              <FormControl><Input id="itsId" {...field} className="col-span-3" /></FormControl>
                              <FormMessage className="col-start-2 col-span-3 text-xs" />
                            </FormItem>
                          )} />
                          <FormField control={memberForm.control} name="bgkId" render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-x-4">
                              <FormLabel htmlFor="bgkId" className="text-right">BGK ID</FormLabel>
                              <FormControl><Input id="bgkId" {...field} className="col-span-3" placeholder="Optional" /></FormControl>
                              <FormMessage className="col-start-2 col-span-3 text-xs" />
                            </FormItem>
                          )} />
                          <FormField control={memberForm.control} name="team" render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-x-4">
                              <FormLabel htmlFor="team" className="text-right">Team</FormLabel>
                              <FormControl><Input id="team" {...field} className="col-span-3" placeholder="Optional" /></FormControl>
                              <FormMessage className="col-start-2 col-span-3 text-xs" />
                            </FormItem>
                          )} />
                          <FormField control={memberForm.control} name="phoneNumber" render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-x-4">
                              <FormLabel htmlFor="phoneNumber" className="text-right">Phone</FormLabel>
                              <FormControl><Input id="phoneNumber" {...field} className="col-span-3" placeholder="Optional" /></FormControl>
                              <FormMessage className="col-start-2 col-span-3 text-xs" />
                            </FormItem>
                          )} />
                          <FormField control={memberForm.control} name="designation" render={({ field }) => (
                              <FormItem className="grid grid-cols-4 items-center gap-x-4">
                                <FormLabel htmlFor="designation" className="text-right">Designation</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || "Member"}>
                                  <FormControl><SelectTrigger id="designation" className="col-span-3"><SelectValue placeholder="Select designation" /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    <SelectItem value="Member">Member</SelectItem>
                                    <SelectItem value="Vice Captain">Vice Captain</SelectItem>
                                    <SelectItem value="Captain">Captain</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage className="col-start-2 col-span-3 text-xs" />
                              </FormItem>
                            )} />
                          <FormField control={memberForm.control} name="role" render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-x-4">
                              <FormLabel htmlFor="role" className="text-right">Role</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger id="role" className="col-span-3"><SelectValue placeholder="Select role" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="user">User</SelectItem>
                                  <SelectItem value="attendance-marker">Attendance Marker</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="superadmin">Super Admin</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage className="col-start-2 col-span-3 text-xs" />
                              {watchedRole && (
                                  <FormDescription className="col-start-2 col-span-3 text-xs mt-1">
                                      {roleDescriptions[watchedRole]}
                                  </FormDescription>
                              )}
                            </FormItem>
                          )} />
                          <FormField control={memberForm.control} name="mohallahId" render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-x-4">
                              <FormLabel htmlFor="mohallahId" className="text-right">Mohallah</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                                disabled={isLoadingMohallahs || mohallahs.length === 0 || !!editingMember || currentUserRole === 'admin'}
                              >
                                <FormControl><SelectTrigger id="mohallahId" className="col-span-3"><SelectValue placeholder="Select Mohallah" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {isLoadingMohallahs ? <SelectItem value="loading" disabled>Loading...</SelectItem> :
                                  mohallahs.length === 0 ? <SelectItem value="no-mohallah" disabled>No Mohallahs available</SelectItem> :
                                  mohallahs.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              {(!!editingMember || currentUserRole === 'admin') && <FormDescription className="col-start-2 col-span-3 text-xs">Mohallah cannot be changed for existing members or by admins.</FormDescription>}
                              <FormMessage className="col-start-2 col-span-3 text-xs" />
                            </FormItem>
                          )} />

                          {watchedRole && watchedRole !== 'user' && (
                            <FormField
                              control={memberForm.control}
                              name="pageRights"
                              render={({ field }) => (
                                <FormItem className="grid grid-cols-1 items-start gap-x-4 pt-2">
                                  <FormLabel className="text-left col-span-4 font-semibold mb-1">Page Access Rights</FormLabel>
                                  <FormDescription className="col-span-4 text-xs mb-2">
                                    Select specific pages this member can access. If none are selected, access is based on the default permissions for their role.
                                  </FormDescription>
                                  <div className="col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 p-2 border rounded-md max-h-48 overflow-y-auto">
                                    {AVAILABLE_PAGE_RIGHTS.map((pageRight) => (
                                      <FormField
                                        key={pageRight.id}
                                        control={memberForm.control}
                                        name="pageRights"
                                        render={({ field: pageRightField }) => (
                                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                            <FormControl>
                                              <Checkbox
                                                checked={pageRightField.value?.includes(pageRight.path)}
                                                onCheckedChange={(checked) => {
                                                  return checked
                                                    ? pageRightField.onChange([...(pageRightField.value || []), pageRight.path])
                                                    : pageRightField.onChange(
                                                      (pageRightField.value || []).filter(
                                                          (value) => value !== pageRight.path
                                                        )
                                                      );
                                                }}
                                              />
                                            </FormControl>
                                            <div className="space-y-1 leading-none">
                                              <FormLabel className="font-normal text-sm">
                                                {pageRight.label}
                                              </FormLabel>
                                              {pageRight.description && (
                                                <FormDescription className="text-xs">
                                                  {pageRight.description}
                                                </FormDescription>
                                              )}
                                            </div>
                                          </FormItem>
                                        )}
                                      />
                                    ))}
                                  </div>
                                  <FormMessage className="col-span-4 text-xs" />
                                </FormItem>
                              )}
                            />
                          )}

                          <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => setIsMemberDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={memberForm.formState.isSubmitting || !canAddOrImport() || (mohallahs.length === 0 && !isLoadingMohallahs && !memberForm.getValues("mohallahId"))}>
                              {memberForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              {editingMember ? "Save Changes" : "Add Member"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
             )}
          </div>
          <Separator className="mb-4" />
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-grow">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search members by name, ITS, Mohallah..."
                className="pl-8 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {currentUserRole === 'superadmin' && (
              <div className="w-full sm:w-auto sm:min-w-[200px]">
                <Select
                    value={selectedFilterMohallahId}
                    onValueChange={(value) => {
                        setSelectedFilterMohallahId(value);
                    }}
                    disabled={isLoadingMohallahs}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by Mohallah" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Mohallahs</SelectItem>
                    {isLoadingMohallahs && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                    {mohallahs.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {fetchError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <ShadAlertTitle>Data Fetch Error</ShadAlertTitle>
              <ShadAlertDescription>{fetchError}</ShadAlertDescription>
            </Alert>
          )}
        </CardHeader>
      </Card>

      <Card className="shadow-lg flex flex-col">
        <CardContent className="pt-6 flex-1 overflow-auto">
          {isLoadingMembers ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading members...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px] px-2">
                    <Checkbox
                      checked={selectedMemberIds.length === currentMembersToDisplay.length && currentMembersToDisplay.length > 0}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all members on current page"
                      disabled={currentMembersToDisplay.length === 0}
                    />
                  </TableHead>
                  <TableHead className="w-[60px] sm:w-[80px]">Avatar</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>ITS ID</TableHead>
                  <TableHead>Mohallah</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Role</TableHead>
                  {canManageMembers && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentMembersToDisplay.length > 0 ? currentMembersToDisplay.map((member) => (
                  <TableRow key={member.id} data-state={selectedMemberIds.includes(member.id) ? "selected" : undefined}>
                    <TableCell className="px-2">
                       <Checkbox
                        checked={selectedMemberIds.includes(member.id)}
                        onCheckedChange={(checked) => handleSelectMember(member.id, checked)}
                        aria-label={`Select member ${member.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                        <AvatarImage src={member.avatarUrl || `https://placehold.co/40x40.png?text=${member.name.substring(0,2).toUpperCase()}`} alt={member.name} data-ai-hint="avatar person"/>
                        <AvatarFallback>{member.name.substring(0,2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell>{member.itsId}</TableCell>
                    <TableCell>{getMohallahNameById(member.mohallahId)}</TableCell>
                    <TableCell>{member.team || "N/A"}</TableCell>
                    <TableCell>{member.designation || "N/A"}</TableCell>
                    <TableCell>{member.role.charAt(0).toUpperCase() + member.role.slice(1).replace(/-/g, ' ')}</TableCell>
                    {canManageMembers && (
                        <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEditMember(member)} className="mr-1 sm:mr-2" aria-label="Edit Member">
                            <Edit className="h-4 w-4" />
                        </Button>
                        { (member.role !== 'superadmin' || currentUserRole === 'superadmin') && (
                            <AlertDialog>
                                <AlertTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" aria-label="Delete Member" disabled={member.role === 'superadmin' && currentUserRole !== 'superadmin'}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                                </AlertTrigger>
                                <AlertContent>
                                <AlertHeader>
                                    <AlertTitle>Are you sure?</AlertTitle>
                                    <AlertDesc>
                                    This action cannot be undone. This will permanently delete "{member.name}".
                                    </AlertDesc>
                                </AlertHeader>
                                <AlertFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteMember(member)} className="bg-destructive hover:bg-destructive/90">
                                    Delete
                                    </AlertDialogAction>
                                </AlertFooter>
                                </AlertContent>
                            </AlertDialog>
                        )}
                        </TableCell>
                    )}
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={canManageMembers ? 9 : 8} className="text-center h-24">
                      No members found { (searchTerm || (currentUserRole === 'superadmin' && selectedFilterMohallahId !=='all') || (currentUserRole === 'admin' && currentUserMohallahId) && !fetchError ) && "matching criteria"}.
                      {(fetchError && currentUserRole === 'superadmin' && selectedFilterMohallahId === 'all' ) && "Select a specific Mohallah."}
                      {(currentUserRole === 'admin' && !currentUserMohallahId && !isLoadingMembers) && "Admin Mohallah not set."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
         <CardFooter className="flex flex-col sm:flex-row justify-between items-center pt-4 gap-2">
            <p className="text-xs text-muted-foreground">
              Showing {currentMembersToDisplay.length > 0 ? ((currentPage - 1) * ITEMS_PER_PAGE) + 1 : 0} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredMembers.length)} of {filteredMembers.length} members
            </p>
            {totalPages > 1 && (
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
        </CardFooter>
      </Card>

      <Dialog open={isCsvImportDialogOpen} onOpenChange={(open) => { setIsCsvImportDialogOpen(open); if(!open) setSelectedFile(null); }}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Import Members via CSV</DialogTitle>
            <DialogDescription>
              Select CSV file. Columns: `name`, `itsId`, `bgkId`, `team`, `phoneNumber`, `role`, `mohallahName`, `designation`, `pageRights` (semicolon-separated paths). MohallahName must exist. Admins can only import to their assigned Mohallah.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <FormLabel htmlFor="csvFile" className="text-right">
                CSV File
              </FormLabel>
              <Input
                id="csvFile"
                type="file"
                accept=".csv"
                className="col-span-3"
                onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                disabled={isCsvProcessing}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => {setIsCsvImportDialogOpen(false); setSelectedFile(null);}} disabled={isCsvProcessing}>Cancel</Button>
            <Button type="button" onClick={handleProcessCsvUpload} disabled={!selectedFile || isCsvProcessing || !canAddOrImport()}>
              {isCsvProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Upload and Process"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

    
