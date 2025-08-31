

"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import type { Mohallah, User, UserRole, UserDesignation, PageRightConfig } from "@/types";
import { PlusCircle, Search, Edit, Trash2, FileUp, Loader2, Users as UsersIcon, Download, AlertTriangle, ChevronLeft, ChevronRight, BellDot, ShieldAlert } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
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
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { allNavItems } from "@/components/dashboard/sidebar-nav";

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
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [mohallahs, setMohallahs] = useState<Mohallah[]>([]);
  const [isLoadingMohallahs, setIsLoadingMohallahs] = useState(true);
  const [members, setMembers] = useState<User[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [isMemberSheetOpen, setIsMemberSheetOpen] = useState(false);
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
    const role = typeof window !== "undefined" ? localStorage.getItem('userRole') as UserRole : null;
    const pageRightsRaw = typeof window !== "undefined" ? localStorage.getItem('userPageRights') : '[]';
    const pageRights = JSON.parse(pageRightsRaw || '[]');
    const navItem = allNavItems.find(item => item.href === '/dashboard/manage-members');
    
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
    if (typeof window !== "undefined") {
      const role = localStorage.getItem('userRole') as UserRole | null;
      const mohallahId = localStorage.getItem('userMohallahId');
      setCurrentUserRole(role);
      setCurrentUserMohallahId(mohallahId);
      if (role === 'admin' && mohallahId) {
        setSelectedFilterMohallahId(mohallahId);
      }
    }
  }, [isAuthorized]);

  useEffect(() => {
    if (!isAuthorized) return;
    setIsLoadingMohallahs(true);
    const unsubscribeMohallahs = getMohallahs((fetchedMohallahs) => {
      setMohallahs(fetchedMohallahs);
      setIsLoadingMohallahs(false);
    });
    return () => unsubscribeMohallahs();
  }, [isAuthorized]);

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
            toast({ title: "Error", description: "Failed to fetch members from the system.", variant: "destructive" });
            setFetchError("Failed to fetch members. Please try again.");
            setMembers([]);
        }
    } finally {
        setIsLoadingMembers(false);
    }
  }, [toast, currentUserRole]);

  useEffect(() => {
    if (!isAuthorized) return;
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
      setMembers([]); 
      setIsLoadingMembers(false);
    }
  }, [currentUserRole, currentUserMohallahId, selectedFilterMohallahId, fetchAndSetMembers, isAuthorized]);


  useEffect(() => {
    if (!isAuthorized) return;
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
  }, [editingMember, memberForm, isMemberSheetOpen, mohallahs, selectedFilterMohallahId, currentUserRole, currentUserMohallahId, isAuthorized]);

  const handleMemberFormSubmit = async (values: MemberFormValues) => {
    const targetMohallahId = values.mohallahId;
    console.log("Attempting to save member. Payload:", values, "Target Mohallah ID for path:", targetMohallahId);

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
      setIsMemberSheetOpen(false);
      setEditingMember(null);
    } catch (error) {
      console.error("Error saving member to system:", error);
      toast({ title: "System Error", description: `Could not save member data. ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
    }
  };

  const handleEditMember = (member: User) => {
    setEditingMember(member);
    setIsMemberSheetOpen(true);
  };

  const handleDeleteMember = async (member: User) => {
    if (!member.mohallahId) {
      toast({ title: "Error", description: "Cannot delete member: Mohallah ID is missing.", variant: "destructive" });
      return;
    }
    try {
      await deleteUser(member.id, member.mohallahId);
      toast({ title: "Member Deleted", description: `"${member.name}" has been deleted.`});
      setSelectedMemberIds(prev => prev.filter(id => id !== member.id)); 
      if (currentUserRole === 'admin' && currentUserMohallahId) {
        fetchAndSetMembers(currentUserMohallahId);
      } else if (currentUserRole === 'superadmin') {
        fetchAndSetMembers(selectedFilterMohallahId === 'all' ? undefined : selectedFilterMohallahId);
      }
    } catch (error) {
      console.error("Error deleting member:", error);
      toast({ title: "System Error", description: "Could not delete member.", variant: "destructive" });
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
        console.warn(`Could not find member with ID ${memberId} or missing mohallahId for bulk delete.`);
        failedCount++; 
      }
    }

    toast({
      title: "Bulk Delete Complete",
      description: `Successfully deleted ${deletedCount} member(s). Failed to delete ${failedCount} member(s).`,
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
        transformHeader: header => header.trim(),
        complete: async (results) => {
          let successfullyAddedCount = 0;
          let skippedCount = 0;
          let errorCount = 0;
          const failedRecords: { data: any, reason: string }[] = [];

          const dataRows = results.data as any[];

          for (const row of dataRows) {
            // Trim all values in the row
            const trimmedRow: {[key: string]: any} = {};
            for (const key in row) {
              const value = (row as any)[key];
              trimmedRow[key] = typeof value === 'string' ? value.trim() : value;
            }
            
            if (Object.keys(trimmedRow).length === 0 || Object.values(trimmedRow).every(val => val === "" || val === null)) {
                continue; 
            }

            const { name, itsId, mohallahName, role } = trimmedRow;

            if (!name || !itsId || !mohallahName || !role) {
              failedRecords.push({ data: row, reason: `Missing required fields. Found: name='${name}', itsId='${itsId}', mohallahName='${mohallahName}', role='${role}'.` });
              skippedCount++;
              continue;
            }

            const mohallah = mohallahs.find(m => m.name.toLowerCase() === mohallahName.toLowerCase());
            if (!mohallah) {
              failedRecords.push({ data: row, reason: `Mohallah "${mohallahName}" not found.` });
              skippedCount++;
              continue;
            }
            const mohallahId = mohallah.id;

            if (currentUserRole === 'admin' && mohallahId !== currentUserMohallahId) {
                failedRecords.push({ data: row, reason: `Admins can only import to their assigned Mohallah. Row skipped for Mohallah "${mohallahName}".` });
                skippedCount++;
                continue;
            }

            try {
              if (!itsId || typeof itsId !== 'string') {
                  failedRecords.push({ data: row, reason: `Invalid or missing ITS ID.` });
                  skippedCount++;
                  continue;
              }
              const existingUser = await getUserByItsOrBgkId(itsId);
              if (existingUser) {
                failedRecords.push({ data: row, reason: `User with ITS ID ${itsId} already exists.` });
                skippedCount++;
                continue;
              }
            } catch (err) {
               console.error(`Error checking for duplicate user with ITS ID ${itsId}:`, err);
               failedRecords.push({ data: row, reason: `Error checking duplicate for ITS ID ${itsId}.` });
               errorCount++; 
               continue;
            }

            const memberPayload: Omit<User, 'id' | 'avatarUrl'> & { avatarUrl?: string } = {
              name: trimmedRow.name,
              itsId: trimmedRow.itsId,
              bgkId: trimmedRow.bgkId || undefined, 
              team: trimmedRow.team || undefined,
              phoneNumber: trimmedRow.phoneNumber || undefined,
              role: trimmedRow.role as UserRole,
              mohallahId: mohallahId, 
              designation: (trimmedRow.designation as UserDesignation) || "Member", 
              pageRights: trimmedRow.pageRights ? trimmedRow.pageRights.split(';').map((s: string) => s.trim()).filter(Boolean) : [],
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

          const totalProcessed = successfullyAddedCount + skippedCount + errorCount;
           if (errorCount > 0 || skippedCount > 0) {
            toast({
                title: "CSV Import Processed with Issues",
                description: `${successfullyAddedCount} added. ${skippedCount} skipped. ${errorCount} failed. Check console for details.`,
                variant: "destructive",
                duration: 10000,
            });
          } else if (totalProcessed === 0 && dataRows.length > 0) {
             toast({
                title: "CSV Import Complete",
                description: "All rows were skipped. This may be due to existing users or invalid data.",
                variant: "default",
                duration: 10000,
            });
          } else {
            toast({
                title: "CSV Import Success",
                description: `Successfully processed CSV file. ${successfullyAddedCount} users added.`,
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
                            (m.bgkId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
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

  const handleSelectAllOnPage = (checked: boolean | string) => {
    if (checked) {
      setSelectedMemberIds(prev => [...new Set([...prev, ...currentMembersToDisplay.map(member => member.id)])]);
    } else {
      const pageIds = currentMembersToDisplay.map(member => member.id);
      setSelectedMemberIds(prev => prev.filter(id => !pageIds.includes(id)));
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
    <div className="flex flex-col h-full gap-6">
    <TooltipProvider>
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
                          <Button variant="destructive" size="sm" aria-label={`Delete ${selectedMemberIds.length} selected members`}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete ({selectedMemberIds.length})
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
                  <Button variant="outline" onClick={downloadSampleCsv} size="sm">
                      <Download className="mr-2 h-4 w-4" /> CSV
                  </Button>
                  <Dialog open={isCsvImportDialogOpen} onOpenChange={(open) => { setIsCsvImportDialogOpen(open); if(!open) setSelectedFile(null); }}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" aria-label="Import Members via CSV" disabled={!canAddOrImport()}>
                            <FileUp className="mr-2 h-4 w-4" /> Import
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
                        <Label htmlFor="csvFile" className="text-right">
                            CSV File
                        </Label>
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
                  <Sheet open={isMemberSheetOpen} onOpenChange={(open) => { setIsMemberSheetOpen(open); if (!open) setEditingMember(null); }}>
                    <SheetTrigger asChild>
                       <Button 
                        onClick={() => { setEditingMember(null); setIsMemberSheetOpen(true); }} 
                        size="sm"
                        aria-label="Add New Member"
                        disabled={!canAddOrImport() || (currentUserRole === 'superadmin' && selectedFilterMohallahId === 'all' && mohallahs.length === 0 && !isLoadingMohallahs)}
                      >
                        <PlusCircle className="mr-2 h-4 w-4" /> Add
                      </Button>
                    </SheetTrigger>
                    <SheetContent className="sm:max-w-lg overflow-y-auto">
                      <SheetHeader>
                        <SheetTitle>{editingMember ? "Edit Member" : "Add New Member"}</SheetTitle>
                        <SheetDescription>
                          {editingMember ? "Update details." : `Add to Mohallah: ${getMohallahNameById(memberForm.getValues("mohallahId")) || "selected"}.`}
                        </SheetDescription>
                      </SheetHeader>
                      <Form {...memberForm}>
                        <form onSubmit={memberForm.handleSubmit(handleMemberFormSubmit)} className="space-y-4 py-4">
                          <FormField control={memberForm.control} name="name" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name</FormLabel>
                              <FormControl><Input {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                           <FormField control={memberForm.control} name="itsId" render={({ field }) => (
                            <FormItem>
                              <FormLabel>ITS ID</FormLabel>
                              <FormControl><Input {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                           <FormField control={memberForm.control} name="bgkId" render={({ field }) => (
                            <FormItem>
                              <FormLabel>BGK ID</FormLabel>
                              <FormControl><Input placeholder="Optional" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={memberForm.control} name="team" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Team</FormLabel>
                              <FormControl><Input placeholder="Optional" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={memberForm.control} name="phoneNumber" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone Number</FormLabel>
                              <FormControl><Input placeholder="Optional" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={memberForm.control} name="designation" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Designation</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || "Member"}>
                                  <FormControl><SelectTrigger><SelectValue placeholder="Select designation" /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    <SelectItem value="Member">Member</SelectItem>
                                    <SelectItem value="Vice Captain">Vice Captain</SelectItem>
                                    <SelectItem value="Captain">Captain</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )} />
                          <FormField control={memberForm.control} name="role" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Role</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="user">User</SelectItem>
                                  <SelectItem value="attendance-marker">Attendance Marker</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="superadmin">Super Admin</SelectItem>
                                </SelectContent>
                              </Select>
                               {watchedRole && (
                                  <FormDescription className="text-xs">
                                      {roleDescriptions[watchedRole]}
                                  </FormDescription>
                              )}
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={memberForm.control} name="mohallahId" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Mohallah</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                                disabled={isLoadingMohallahs || mohallahs.length === 0 || !!editingMember || currentUserRole === 'admin'}
                              >
                                <FormControl><SelectTrigger><SelectValue placeholder="Select Mohallah" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {isLoadingMohallahs ? <SelectItem value="loading" disabled>Loading...</SelectItem> :
                                  mohallahs.length === 0 ? <SelectItem value="no-mohallah" disabled>No Mohallahs available</SelectItem> :
                                  mohallahs.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              {(!!editingMember || currentUserRole === 'admin') && <FormDescription className="text-xs">Mohallah cannot be changed for existing members or by admins.</FormDescription>}
                              <FormMessage />
                            </FormItem>
                          )} />

                          {watchedRole && watchedRole !== 'user' && (
                            <FormField
                              control={memberForm.control}
                              name="pageRights"
                              render={({ field }) => (
                                <FormItem className="pt-2">
                                  <FormLabel className="font-semibold">Page Access Rights</FormLabel>
                                  <FormDescription className="text-xs mb-2">
                                    Select specific pages this member can access.
                                  </FormDescription>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 p-2 border rounded-md max-h-48 overflow-y-auto">
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
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}

                          <SheetFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => setIsMemberSheetOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={memberForm.formState.isSubmitting || !canAddOrImport() || (mohallahs.length === 0 && !isLoadingMohallahs && !memberForm.getValues("mohallahId"))}>
                              {memberForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              {editingMember ? "Save Changes" : "Add Member"}
                            </Button>
                          </SheetFooter>
                        </form>
                      </Form>
                    </SheetContent>
                  </Sheet>
                </div>
             )}
          </div>
          <Separator className="mb-4" />
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-grow">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search members by name, ITS, BGK ID, Mohallah..."
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

      <Card className="shadow-lg flex flex-col flex-1 min-h-0">
        <CardContent className="pt-6 flex-1 overflow-y-auto">
          {isLoadingMembers ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading members...</p>
            </div>
          ) : (
            <>
              {/* Mobile View: List of Cards */}
              <div className="md:hidden space-y-4">
                {currentMembersToDisplay.length > 0 ? currentMembersToDisplay.map((member) => (
                  <Card key={member.id} className="w-full" data-state={selectedMemberIds.includes(member.id) ? "selected" : undefined}>
                    <CardContent className="p-4 flex flex-col gap-4">
                      <div className="flex items-center gap-4">
                         <Checkbox
                           id={`mobile-select-${member.id}`}
                           checked={selectedMemberIds.includes(member.id)}
                           onCheckedChange={(checked) => handleSelectMember(member.id, checked)}
                           aria-label={`Select member ${member.name}`}
                           className="shrink-0"
                         />
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={member.avatarUrl || `https://placehold.co/48x48.png?text=${member.name.substring(0,2).toUpperCase()}`} alt={member.name} data-ai-hint="avatar person"/>
                          <AvatarFallback>{member.name.substring(0,2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-grow">
                            <div className="flex items-center gap-2">
                                <p className="font-semibold">{member.name}</p>
                                {member.fcmTokens && member.fcmTokens.length > 0 && (
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <BellDot className="h-4 w-4 text-green-500" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Ready to receive Push Notifications</p>
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                            </div>
                          <p className="text-sm text-muted-foreground">ITS: {member.itsId}</p>
                          <p className="text-sm text-muted-foreground">BGK ID: {member.bgkId || "N/A"}</p>
                          <p className="text-sm text-muted-foreground">{member.designation || "N/A"}</p>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1 pl-16">
                          <p><strong>Mohallah:</strong> {getMohallahNameById(member.mohallahId)}</p>
                          <p><strong>Team:</strong> {member.team || "N/A"}</p>
                          <p><strong>Role:</strong> {member.role.charAt(0).toUpperCase() + member.role.slice(1).replace(/-/g, ' ')}</p>
                      </div>
                      {canManageMembers && (
                        <div className="flex justify-end gap-2 pt-2 border-t mt-2">
                           <Button variant="ghost" size="sm" onClick={() => handleEditMember(member)} className="flex-1" aria-label="Edit Member" disabled={currentUserRole === 'attendance-marker'}>
                              <Edit className="mr-2 h-4 w-4" /> Edit
                          </Button>
                          { (currentUserRole === 'admin' || currentUserRole === 'superadmin') && (member.role !== 'superadmin' || currentUserRole === 'superadmin') && ( 
                              <AlertDialog>
                                  <AlertTrigger asChild>
                                    <Button variant="ghost" size="sm" className="flex-1 text-destructive hover:text-destructive" aria-label="Delete Member" disabled={member.role === 'superadmin' && currentUserRole !== 'superadmin'}>
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                    </Button>
                                  </AlertTrigger>
                                  <AlertContent>
                                    <AlertHeader>
                                        <AlertTitle>Are you sure?</AlertTitle>
                                        <AlertDesc>This action cannot be undone. This will permanently delete "{member.name}".</AlertDesc>
                                    </AlertHeader>
                                    <AlertFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteMember(member)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                    </AlertFooter>
                                  </AlertContent>
                              </AlertDialog>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )) : (
                  <div className="text-center py-10">
                    <p className="text-muted-foreground">No members found.</p>
                  </div>
                )}
              </div>

              {/* Desktop View: Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px] px-2">
                        <Checkbox
                          checked={selectedMemberIds.length > 0 && currentMembersToDisplay.length > 0 && currentMembersToDisplay.every(m => selectedMemberIds.includes(m.id))}
                          onCheckedChange={handleSelectAllOnPage}
                          aria-label="Select all members on current page"
                          disabled={currentMembersToDisplay.length === 0}
                        />
                      </TableHead>
                      <TableHead className="w-[60px] sm:w-[80px]">Avatar</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>ITS ID</TableHead>
                      <TableHead>BGK ID</TableHead>
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
                        <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                                <span>{member.name}</span>
                                {member.fcmTokens && member.fcmTokens.length > 0 && (
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <BellDot className="h-4 w-4 text-green-500" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Ready for Push Notifications</p>
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                            </div>
                        </TableCell>
                        <TableCell>{member.itsId}</TableCell>
                        <TableCell>{member.bgkId || "N/A"}</TableCell>
                        <TableCell>{getMohallahNameById(member.mohallahId)}</TableCell>
                        <TableCell>{member.team || "N/A"}</TableCell>
                        <TableCell>{member.designation || "N/A"}</TableCell>
                        <TableCell>{member.role.charAt(0).toUpperCase() + member.role.slice(1).replace(/-/g, ' ')}</TableCell>
                        {canManageMembers && (
                            <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => handleEditMember(member)} className="mr-1 sm:mr-2" aria-label="Edit Member" disabled={currentUserRole === 'attendance-marker'}>
                                <Edit className="h-4 w-4" />
                            </Button>
                            { (currentUserRole === 'admin' || currentUserRole === 'superadmin') && (member.role !== 'superadmin' || currentUserRole === 'superadmin') && ( 
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
                        <TableCell colSpan={canManageMembers ? 10 : 9} className="text-center h-24">
                          No members found { (searchTerm || (currentUserRole === 'superadmin' && selectedFilterMohallahId !=='all') || (currentUserRole === 'admin' && currentUserMohallahId) && !fetchError ) && "matching criteria"}.
                          {(fetchError && currentUserRole === 'superadmin' && selectedFilterMohallahId === 'all' ) && "Select a specific Mohallah."}
                          {(currentUserRole === 'admin' && !currentUserMohallahId && !isLoadingMembers) && "Admin Mohallah not set."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
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
      </TooltipProvider>

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
              <Label htmlFor="csvFile" className="text-right">
                CSV File
              </Label>
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

