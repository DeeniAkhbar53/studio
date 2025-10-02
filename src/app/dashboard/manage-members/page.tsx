
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import type { Mohallah, User, UserRole, UserDesignation, PageRightConfig } from "@/types";
import { PlusCircle, Search, Edit, Trash2, FileUp, Loader2, Users as UsersIcon, Download, AlertTriangle, ChevronLeft, ChevronRight, BellDot, ShieldAlert, Lock, Mail } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Form, FormField, FormControl, FormMessage, FormItem, FormLabel, FormDescription } from "@/components/ui/form";
import { getUsers, addUser, updateUser, deleteUser, getUserByItsOrBgkId, UserDataForAdd } from "@/lib/firebase/userService";
import { getMohallahs } from "@/lib/firebase/mohallahService";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent as AlertContent, AlertDialogDescription as AlertDesc, AlertDialogFooter as AlertFooter, AlertDialogHeader as AlertHeader, AlertDialogTitle as AlertTitle, AlertDialogTrigger as AlertTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle as ShadAlertTitle, AlertDescription as ShadAlertDescription } from "@/components/ui/alert";
import Papa from 'papaparse';
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { allNavItems } from "@/components/dashboard/sidebar-nav";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FunkyLoader } from "@/components/ui/funky-loader";
import { cn } from "@/lib/utils";

const memberSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  itsId: z.string().min(8, "ITS ID must be 8 characters").max(8, "ITS ID must be 8 characters"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  bgkId: z.string().optional().or(z.literal("")),
  password: z.string().optional(),
  team: z.string().optional().or(z.literal("")),
  managedTeams: z.array(z.string()).optional().default([]),
  phoneNumber: z.string().optional().or(z.literal("")),
  role: z.enum(["user", "admin", "superadmin", "attendance-marker"]),
  mohallahId: z.string().min(1, "Mohallah must be selected"),
  designation: z.enum(["Captain", "Vice Captain", "Member", "Asst.Grp Leader", "Group Leader", "J.Member", "Major", "Idara Admin", "Senior Assistant Commander", "Assistant Commander", "Commander"]).optional().or(z.literal("")),
  pageRights: z.array(z.string()).optional().default([]),
}).refine(data => {
    if ((data.role === 'admin' || data.role === 'superadmin') && (!data.password || data.password.length < 6)) {
        return false;
    }
    return true;
}, {
    message: "Password must be at least 6 characters for Admins and Super Admins.",
    path: ["password"],
});

type MemberFormValues = z.infer<typeof memberSchema>;

const roleDescriptions: Record<UserRole, string> = {
    user: "Regular user with basic access. Can scan their own attendance and view profile/notifications.",
    "attendance-marker": "Can mark attendance for members and view reports. Specific page access can be customized.",
    admin: "Can manage users, Miqaats, Mohallahs, and generate reports within their assigned Mohallah. Requires password to log in. Specific page access can be customized.",
    superadmin: "Full access to all system features and settings, across all Mohallahs. Requires password to log in. Specific page access can be customized.",
};

const ALL_ROLES: { value: UserRole, label: string }[] = [
    { value: 'user', label: 'User' },
    { value: 'attendance-marker', label: 'Attendance Marker' },
    { value: 'admin', label: 'Admin' },
    { value: 'superadmin', label: 'Super Admin' },
];

const ALL_DESIGNATIONS: UserDesignation[] = ["Member", "J.Member", "Asst.Grp Leader", "Group Leader", "Vice Captain", "Captain", "Major", "Commander", "Assistant Commander", "Senior Assistant Commander", "Idara Admin"];
const TEAM_LEAD_DESIGNATIONS: UserDesignation[] = ["Captain", "Vice Captain", "Group Leader", "Asst.Grp Leader", "Major", "Commander", "Assistant Commander", "Senior Assistant Commander"];
const TOP_LEVEL_LEADERS: UserDesignation[] = ["Major", "Captain", "Commander", "Senior Assistant Commander"];
const MID_LEVEL_LEADERS: UserDesignation[] = ["Vice Captain"];
const GROUP_LEVEL_LEADERS: UserDesignation[] = ["Group Leader", "Asst.Grp Leader", "Assistant Commander"];


const AVAILABLE_PAGE_RIGHTS: PageRightConfig[] = [
  { id: 'mark-attendance', label: 'Mark Attendance', path: '/dashboard/mark-attendance', description: 'Allows user to mark attendance for others.' },
  { id: 'miqaat-management', label: 'Manage Miqaats', path: '/dashboard/miqaat-management', description: 'Create, edit, delete Miqaats.' },
  { id: 'manage-mohallahs', label: 'Manage Mohallahs', path: '/dashboard/manage-mohallahs', description: 'Create, edit, delete Mohallahs.' },
  { id: 'manage-members', label: 'Manage Members', path: '/dashboard/manage-members', description: 'Add, edit, delete members and assign roles/rights.' },
  { id: 'forms', label: 'Manage Forms / Surveys', path: '/dashboard/forms', description: 'Create, edit, delete forms and view responses.' },
  { id: 'manage-notifications', label: 'Manage Notifications', path: '/dashboard/manage-notifications', description: 'Create and delete system-wide notifications.' },
  { id: 'reports', label: 'View Reports', path: '/dashboard/reports', description: 'Generate and view various attendance reports.' },
];

const ITEMS_PER_PAGE = 10;

export default function ManageMembersPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [mohallahs, setMohallahs] = useState<Mohallah[]>([]);
  const [isLoadingMohallahs, setIsLoadingMohallahs] = useState(true);
  const [availableTeamsInForm, setAvailableTeamsInForm] = useState<string[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [isMemberSheetOpen, setIsMemberSheetOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<User | null>(null);

  const [isCsvImportDialogOpen, setIsCsvImportDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCsvProcessing, setIsCsvProcessing] = useState(false);
  const { toast } = useToast();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [currentUserDesignation, setCurrentUserDesignation] = useState<UserDesignation | null>(null);
  const [currentUserMohallahId, setCurrentUserMohallahId] = useState<string | null>(null);
  const [currentUserTeam, setCurrentUserTeam] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);


  const [selectedFilterMohallahId, setSelectedFilterMohallahId] = useState<string>("all");
  const [selectedFilterRole, setSelectedFilterRole] = useState<string>("all");
  const [selectedFilterDesignation, setSelectedFilterDesignation] = useState<string>("all");
  const [selectedFilterTeam, setSelectedFilterTeam] = useState<string>("all");

  const [fetchError, setFetchError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isBulkDeleteAlertOpen, setIsBulkDeleteAlertOpen] = useState(false);

  const memberForm = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: { name: "", itsId: "", email: "", bgkId: "", password: "", team: "", phoneNumber: "", role: "user", mohallahId: "", designation: "Member", pageRights: [], managedTeams: [] },
  });

  const watchedRole = memberForm.watch("role");
  const watchedDesignation = memberForm.watch("designation");
  const watchedMohallahInForm = memberForm.watch("mohallahId");

  const isTeamLeadView = useMemo(() => {
    if (!currentUserRole || !currentUserDesignation) return false;
    const isAdminOrSuper = currentUserRole === 'admin' || currentUserRole === 'superadmin';
    return !isAdminOrSuper && TEAM_LEAD_DESIGNATIONS.includes(currentUserDesignation);
  }, [currentUserRole, currentUserDesignation]);
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      const role = localStorage.getItem('userRole') as UserRole | null;
      const designation = localStorage.getItem('userDesignation') as UserDesignation | null;
      const pageRightsRaw = localStorage.getItem('userPageRights') || '[]';
      const pageRights = JSON.parse(pageRightsRaw);

      setCurrentUserRole(role);
      setCurrentUserDesignation(designation);

      const navItem = allNavItems.find(item => item.href === '/dashboard/manage-members');
      if (navItem) {
        const hasRoleAccess = navItem.allowedRoles?.includes(role || 'user');
        const hasPageRight = pageRights.includes(navItem.href);
        const isDesignatedTeamLead = TEAM_LEAD_DESIGNATIONS.includes(designation || 'Member');
        
        if (hasRoleAccess || hasPageRight || isDesignatedTeamLead) {
          setIsAuthorized(true);
        } else {
          setIsAuthorized(false);
          setTimeout(() => router.replace('/dashboard'), 2000);
        }
      } else {
        setIsAuthorized(false);
        setTimeout(() => router.replace('/dashboard'), 2000);
      }
    }
  }, [router]);


  useEffect(() => {
    if (!isAuthorized) return;
    async function loadCurrentUser() {
      if (typeof window !== "undefined") {
        const role = localStorage.getItem('userRole') as UserRole | null;
        const mohallahId = localStorage.getItem('userMohallahId');
        const team = localStorage.getItem('userTeam');
        const name = localStorage.getItem('userName');
        const itsId = localStorage.getItem('userItsId');

        setCurrentUserRole(role);
        setCurrentUserMohallahId(mohallahId);
        setCurrentUserTeam(team);
        setCurrentUserName(name);

        if (itsId) {
            const userDetails = await getUserByItsOrBgkId(itsId);
            setCurrentUser(userDetails);
        }

        if (role === 'admin' && mohallahId) {
          setSelectedFilterMohallahId(mohallahId);
          memberForm.setValue('mohallahId', mohallahId);
        }
      }
    }
    loadCurrentUser();
  }, [isAuthorized, memberForm]);

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
    if (!isAuthorized) {
        setIsLoadingMembers(false);
        return;
    }
    fetchAndSetMembers(); // Fetch all members initially for all roles with access
  }, [isAuthorized, fetchAndSetMembers]);
  
  useEffect(() => {
    if (watchedMohallahInForm && members.length > 0) {
      const teams = new Set(
        members
          .filter(m => m.mohallahId === watchedMohallahInForm && m.team)
          .map(m => m.team!)
      );
      setAvailableTeamsInForm(Array.from(teams).sort());
    } else {
      setAvailableTeamsInForm([]);
    }
  }, [watchedMohallahInForm, members]);


  useEffect(() => {
    if (!isAuthorized) return;
    if (editingMember) {
      memberForm.reset({
        name: editingMember.name,
        itsId: editingMember.itsId,
        email: editingMember.email || "",
        bgkId: editingMember.bgkId || "",
        password: "", // Always clear password on edit for security
        team: editingMember.team || "",
        phoneNumber: editingMember.phoneNumber || "",
        role: editingMember.role,
        mohallahId: editingMember.mohallahId || (mohallahs.length > 0 ? mohallahs[0].id : ""),
        designation: editingMember.designation || "Member",
        pageRights: editingMember.pageRights || [],
        managedTeams: editingMember.managedTeams || [],
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
        name: "", itsId: "", email: "", bgkId: "", password: "", team: "", phoneNumber: "", role: "user",
        mohallahId: defaultMohallahForForm,
        designation: "Member",
        pageRights: [],
        managedTeams: [],
      });
    }
  }, [editingMember, memberForm, isMemberSheetOpen, mohallahs, selectedFilterMohallahId, currentUserRole, currentUserMohallahId, isAuthorized]);

  const handleMemberFormSubmit = async (values: MemberFormValues) => {
    const targetMohallahId = values.mohallahId;
    

    if (!targetMohallahId) {
        toast({ title: "Error", description: "Mohallah ID is missing.", variant: "destructive" });
        return;
    }

    const memberPayload: Omit<User, 'id' | 'avatarUrl'> & { avatarUrl?: string, designation?: UserDesignation, pageRights?: string[], password?: string, managedTeams?: string[] } = {
      name: values.name,
      itsId: values.itsId,
      email: values.email,
      bgkId: values.bgkId,
      team: values.team,
      phoneNumber: values.phoneNumber,
      role: values.role as UserRole,
      mohallahId: targetMohallahId, 
      designation: values.designation as UserDesignation || "Member",
      pageRights: values.role === 'user' ? [] : (values.pageRights || []), 
      managedTeams: values.designation === 'Vice Captain' ? (values.managedTeams || []) : [],
    };

    if (values.password && (values.role === 'admin' || values.role === 'superadmin')) {
        memberPayload.password = values.password;
    }

    try {
      if (editingMember && editingMember.mohallahId) {
        // If password field is empty during an edit, it means "do not change"
        if (!memberPayload.password) {
            delete memberPayload.password;
        }
        const updatePayload = { ...memberPayload };

        if (editingMember.mohallahId !== targetMohallahId) {
            // Mohallah change logic: delete from old, add to new
            await deleteUser(editingMember.id, editingMember.mohallahId);
            await addUser(updatePayload as UserDataForAdd, targetMohallahId);
        } else {
            // Standard update
            await updateUser(editingMember.id, editingMember.mohallahId, updatePayload);
        }
        toast({ title: "Member Updated", description: `"${values.name}" has been updated.` });
      } else {
        await addUser(memberPayload, targetMohallahId);
        toast({ title: "Member Added", description: `"${values.name}" has been added to ${getMohallahNameById(targetMohallahId)}.` });
      }
      fetchAndSetMembers();
      setIsMemberSheetOpen(false);
      setEditingMember(null);
    } catch (error) {
      
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
      fetchAndSetMembers();
    } catch (error) {
      
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
          
          failedCount++;
        }
      } else {
        
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
    fetchAndSetMembers();
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
                let addedCount = 0;
                let updatedCount = 0;
                let skippedCount = 0;
                let errorCount = 0;
                const failedRecords: { data: any, reason: string }[] = [];

                const dataRows = results.data as any[];
                console.log(`CSV Import: Found ${dataRows.length} rows to process.`);

                for (const [index, row] of dataRows.entries()) {
                    const trimmedRow: {[key: string]: any} = {};
                    for (const key in row) {
                        const value = (row as any)[key];
                        trimmedRow[key] = typeof value === 'string' ? value.trim() : value;
                    }

                    if (Object.keys(trimmedRow).length === 0 || Object.values(trimmedRow).every(val => val === "" || val === null)) {
                        console.warn(`CSV Import (Row ${index + 2}): Skipping empty row.`);
                        continue; 
                    }

                    const { name, itsId, mohallahName, role } = trimmedRow;

                    const missingFields = [];
                    if (!name) missingFields.push('name');
                    if (!itsId) missingFields.push('itsId');
                    if (!mohallahName) missingFields.push('mohallahName');
                    if (!role) missingFields.push('role');

                    if (missingFields.length > 0) {
                        const reason = `Missing required fields: ${missingFields.join(', ')}.`;
                        failedRecords.push({ data: row, reason });
                        console.warn(`CSV Import (Row ${index + 2}): Skipping due to missing required fields: ${missingFields.join(', ')}.`, { row });
                        skippedCount++;
                        continue;
                    }

                    const mohallah = mohallahs.find(m => m.name.toLowerCase() === mohallahName.toLowerCase());
                    if (!mohallah) {
                        const reason = `Mohallah "${mohallahName}" not found.`;
                        failedRecords.push({ data: row, reason });
                        console.warn(`CSV Import (Row ${index + 2}): Skipping, Mohallah not found.`, { row, reason });
                        skippedCount++;
                        continue;
                    }
                    const mohallahId = mohallah.id;

                    if (currentUserRole === 'admin' && mohallahId !== currentUserMohallahId) {
                        const reason = `Admins can only import to their assigned Mohallah. Row skipped for Mohallah "${mohallahName}".`;
                        failedRecords.push({ data: row, reason });
                         console.warn(`CSV Import (Row ${index + 2}): Skipping, permission denied for admin.`, { row, reason });
                        skippedCount++;
                        continue;
                    }
                    
                    const memberPayloadFromCsv: Omit<User, 'id' | 'avatarUrl'> & { avatarUrl?: string } = {
                      name: trimmedRow.name,
                      itsId: trimmedRow.itsId,
                      email: trimmedRow.email || undefined,
                      bgkId: trimmedRow.bgkId || undefined, 
                      password: trimmedRow.password || undefined,
                      team: trimmedRow.team || undefined,
                      phoneNumber: trimmedRow.phoneNumber || undefined,
                      role: trimmedRow.role as UserRole,
                      mohallahId: mohallahId, 
                      designation: (trimmedRow.designation as UserDesignation) || "Member", 
                      pageRights: trimmedRow.pageRights ? trimmedRow.pageRights.split(';').map((s: string) => s.trim()).filter(Boolean) : [],
                      managedTeams: trimmedRow.managedTeams ? trimmedRow.managedTeams.split(';').map((s: string) => s.trim()).filter(Boolean) : [],
                    };

                    const validation = memberSchema.safeParse({
                        ...memberPayloadFromCsv,
                        bgkId: memberPayloadFromCsv.bgkId || "", 
                        team: memberPayloadFromCsv.team || "",
                        phoneNumber: memberPayloadFromCsv.phoneNumber || "",
                        email: memberPayloadFromCsv.email || "",
                        password: memberPayloadFromCsv.password || "",
                    });

                    if (!validation.success) {
                        const errorMessages = Object.values(validation.error.flatten().fieldErrors).flat().join(' ');
                        const reason = `Validation failed: ${errorMessages}`;
                        failedRecords.push({ data: row, reason });
                        console.warn(`CSV Import (Row ${index + 2}): Skipping due to validation failure.`, { row, reason: errorMessages, error: validation.error.flatten() });
                        skippedCount++;
                        continue;
                    }
                    
                    const validatedData = validation.data;

                    try {
                        const existingUser = await getUserByItsOrBgkId(validatedData.itsId);

                        if (existingUser && existingUser.id) {
                            // UPDATE existing user
                             const updatePayload: Partial<User> = {
                                name: validatedData.name,
                                email: validatedData.email,
                                bgkId: validatedData.bgkId,
                                team: validatedData.team,
                                phoneNumber: validatedData.phoneNumber,
                                role: validatedData.role,
                                designation: validatedData.designation,
                                pageRights: validatedData.pageRights,
                                managedTeams: validatedData.managedTeams,
                                password: validatedData.password || undefined,
                                mohallahId: validatedData.mohallahId,
                            };
                            
                            // Mohallah change logic
                            if (existingUser.mohallahId !== validatedData.mohallahId) {
                                await deleteUser(existingUser.id, existingUser.mohallahId!);
                                await addUser(updatePayload as UserDataForAdd, validatedData.mohallahId);
                            } else {
                                await updateUser(existingUser.id, existingUser.mohallahId!, updatePayload);
                            }
                            updatedCount++;
                        } else {
                            // ADD new user
                            await addUser(validatedData, mohallahId); 
                            addedCount++;
                        }
                    } catch (dbError: any) {
                        const reason = `DB Error: ${dbError.message}`;
                        failedRecords.push({ data: row, reason });
                        console.error(`CSV Import (Row ${index + 2}): Database error during add/update.`, { row, error: dbError?.message || dbError });
                        errorCount++;
                    }
                }

                setIsCsvProcessing(false);
                setIsCsvImportDialogOpen(false);
                setSelectedFile(null);
                fetchAndSetMembers();

                const totalProcessed = addedCount + updatedCount + skippedCount + errorCount;
                if (errorCount > 0 || skippedCount > 0) {
                    toast({
                        title: "CSV Processed",
                        description: `${addedCount} added, ${updatedCount} updated. ${skippedCount} skipped. ${errorCount} failed. Check console for details.`,
                        variant: "default",
                        duration: 10000,
                    });
                } else if (totalProcessed === 0 && dataRows.length > 0) {
                    toast({
                        title: "CSV Import Complete",
                        description: "All rows were skipped or resulted in no changes.",
                        variant: "default",
                        duration: 10000,
                    });
                } else {
                    toast({
                        title: "CSV Import Success",
                        description: `Successfully processed CSV file. ${addedCount} users added, ${updatedCount} users updated.`,
                    });
                }

                if (failedRecords.length > 0) {
                    console.group("CSV Import - Skipped/Failed Records Details");
                    console.table(failedRecords.map(f => ({ ITS: f.data.itsId, Name: f.data.name, Reason: f.reason })));
                    console.groupEnd();
                }
            },
            error: (error: any) => {
                console.error("CSV PapaParse Error:", error);
                setIsCsvProcessing(false);
                toast({
                    title: "CSV Parsing Error",
                    description: `Could not parse file: ${error.message}.`,
                    variant: "destructive",
                });
            }
        });
    } catch (error) {
        console.error("CSV File Read Error:", error);
        setIsCsvProcessing(false);
        toast({
            title: "File Read Error",
            description: "Could not read the selected file.",
            variant: "destructive",
        });
    }
};

  const handleExport = () => {
    if (filteredMembers.length === 0) {
      toast({
        title: "No Data",
        description: "There are no members to export based on the current filters.",
        variant: "default"
      });
      return;
    }

    const dataToExport = filteredMembers.map(member => ({
      "Name": member.name,
      "ITS ID": member.itsId,
      "BGK ID": member.bgkId || "",
      "Email": member.email || "",
      "Phone Number": member.phoneNumber || "",
      "Mohallah": getMohallahNameById(member.mohallahId) || "",
      "Team": member.team || "",
      "Designation": member.designation || "",
      "Role": member.role,
      "Page Rights": member.pageRights?.join(';') || "",
    }));

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'members_export.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Complete",
      description: `${filteredMembers.length} member records have been downloaded.`
    });
  };

  const getMohallahNameById = (id?: string) => mohallahs.find(m => m.id === id)?.name || "N/A";

  const filteredMembers = useMemo(() => {
    let dataToFilter = [...members];

    // First, apply role-based data scoping
    if (currentUser?.role === 'admin' && currentUser.mohallahId) {
        dataToFilter = dataToFilter.filter(member => member.mohallahId === currentUser.mohallahId);
    } else if (currentUser?.designation && TEAM_LEAD_DESIGNATIONS.includes(currentUser.designation) && currentUser.role !== 'superadmin') {
        // Filter by Mohallah first for all team leads
        dataToFilter = dataToFilter.filter(member => member.mohallahId === currentUser.mohallahId);

        // Then, apply team-based filtering
        if (MID_LEVEL_LEADERS.includes(currentUser.designation) && currentUser.managedTeams && currentUser.managedTeams.length > 0) {
            const managedTeams = new Set(currentUser.managedTeams);
            dataToFilter = dataToFilter.filter(member => member.team && managedTeams.has(member.team));
        } else if (GROUP_LEVEL_LEADERS.includes(currentUser.designation) && currentUser.team) {
            dataToFilter = dataToFilter.filter(member => member.team === currentUser.team);
        }
        // TOP_LEVEL_LEADERS (Captain/Major) within this block will see everyone in their own Mohallah.
    }
    // Superadmin sees everyone, so no initial filter is applied.

    // Then, apply UI filters on the already scoped data
    return dataToFilter.filter(m => {
        const searchTermMatch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                m.itsId.includes(searchTerm) ||
                                (m.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (m.bgkId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (getMohallahNameById(m.mohallahId) || "").toLowerCase().includes(searchTerm.toLowerCase());
        
        const roleMatch = selectedFilterRole === 'all' || m.role === selectedFilterRole;
        const designationMatch = selectedFilterDesignation === 'all' || m.designation === selectedFilterDesignation;
        const mohallahFilterMatch = (currentUserRole !== 'admin' && selectedFilterMohallahId === 'all') || !m.mohallahId || m.mohallahId === selectedFilterMohallahId;
        const teamFilterMatch = selectedFilterTeam === 'all' || !m.team || m.team === selectedFilterTeam;


        return searchTermMatch && roleMatch && designationMatch && mohallahFilterMatch && teamFilterMatch;
    });
}, [members, searchTerm, selectedFilterRole, selectedFilterDesignation, selectedFilterMohallahId, selectedFilterTeam, currentUser, currentUserRole]);


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
  
   const handleSelectAllFiltered = () => {
    const allFilteredIds = filteredMembers.map(member => member.id);
    setSelectedMemberIds(allFilteredIds);
  };


  const handleSelectMember = (memberId: string, checked: boolean | string) => {
    if (checked) {
      setSelectedMemberIds(prev => [...prev, memberId]);
    } else {
      setSelectedMemberIds(prev => prev.filter(id => id !== memberId));
    }
  };

  const canAddOrImport = () => {
    if (isLoadingMohallahs) return false; 
    if (currentUserRole === 'admin') return !!currentUserMohallahId; 
    if (currentUserRole === 'superadmin') return true; 
    return false;
  };
  
  const canSeeTeamFilter = useMemo(() => {
    if (!currentUserDesignation) return false;
    return currentUserDesignation === 'Captain' || currentUserDesignation === 'Vice Captain';
  }, [currentUserDesignation]);

  const teamFilterOptions = useMemo(() => {
    if (!currentUser) return [];
    
    // Get all teams from all mohallahs
    const allTeams = new Set<string>();
    members.forEach(member => {
        if(member.team) allTeams.add(member.team);
    });

    if (currentUser.designation === 'Captain') return Array.from(allTeams).sort();
    if (currentUser.designation === 'Vice Captain') return currentUser.managedTeams || [];
    return [];
}, [currentUser, members]);

  const canManageMembers = currentUserRole === 'admin' || currentUserRole === 'superadmin';
  const displayTitle = useMemo(() => {
    if (currentUserDesignation && TEAM_LEAD_DESIGNATIONS.includes(currentUserDesignation) && !canManageMembers) {
      if (TOP_LEVEL_LEADERS.includes(currentUserDesignation)) return `Members: ${getMohallahNameById(currentUserMohallahId || '')}`;
      if (MID_LEVEL_LEADERS.includes(currentUserDesignation)) return `Team Members`;
      if (GROUP_LEVEL_LEADERS.includes(currentUserDesignation)) return `Team Members: ${currentUserTeam}`;
    }
    if (currentUserRole === 'admin' && currentUserMohallahId) return `Manage Members: ${getMohallahNameById(currentUserMohallahId)}`;
    return "Manage Members";
  }, [currentUserDesignation, canManageMembers, currentUserName, currentUserTeam, currentUserRole, currentUserMohallahId, mohallahs]);


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
    <div className="flex flex-col h-full gap-6">
    <TooltipProvider>
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
            <div className="flex-grow">
              <CardTitle className="flex items-center"><UsersIcon className="mr-2 h-5 w-5 text-primary"/>
                {displayTitle}
              </CardTitle>
              <CardDescription className="mt-1">
                 Add, view, and manage members based on your role.
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
                  <Button variant="outline" onClick={handleExport} size="sm" disabled={filteredMembers.length === 0}>
                      <Download className="mr-2 h-4 w-4" /> Export
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
                        Columns: `name`, `itsId`, `email`, `bgkId`, `password`, `team`, `phoneNumber`, `role`, `mohallahName`, `designation`, `pageRights` (semicolon-separated), `managedTeams` (semicolon-separated).
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
                          <FormField control={memberForm.control} name="email" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl><Input placeholder="Optional" {...field} /></FormControl>
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
                          
                          <FormField control={memberForm.control} name="phoneNumber" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone Number</FormLabel>
                              <FormControl><Input placeholder="Optional" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                           <FormField control={memberForm.control} name="mohallahId" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Mohallah</FormLabel>
                              <Select
                                onValueChange={(value) => {
                                    field.onChange(value);
                                    memberForm.setValue('team', ''); // Reset team when mohallah changes
                                }}
                                value={field.value}
                                disabled={isLoadingMohallahs || mohallahs.length === 0 || !(currentUserRole === 'admin' || currentUserRole === 'superadmin')}
                              >
                                <FormControl><SelectTrigger><SelectValue placeholder="Select Mohallah" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {isLoadingMohallahs ? <SelectItem value="loading" disabled>Loading...</SelectItem> :
                                  mohallahs.length === 0 ? <SelectItem value="no-mohallah" disabled>No Mohallahs available</SelectItem> :
                                  mohallahs.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              {!(currentUserRole === 'admin' || currentUserRole === 'superadmin') && <FormDescription className="text-xs">Mohallah can only be changed by Admins.</FormDescription>}
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={memberForm.control} name="team" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Team</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} disabled={!watchedMohallahInForm || availableTeamsInForm.length === 0}>
                                <FormControl><SelectTrigger><SelectValue placeholder={!watchedMohallahInForm ? "Select a Mohallah first" : (availableTeamsInForm.length === 0 ? "No teams in this Mohallah" : "Select a team")} /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {availableTeamsInForm.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )} />

                          <FormField control={memberForm.control} name="designation" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Designation</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || "Member"}>
                                  <FormControl><SelectTrigger><SelectValue placeholder="Select designation" /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    {ALL_DESIGNATIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )} />

                           {watchedDesignation === 'Vice Captain' && (
                                <FormField
                                control={memberForm.control}
                                name="managedTeams"
                                render={() => (
                                    <FormItem>
                                    <FormLabel>Managed Teams</FormLabel>
                                    <FormDescription>Select the teams this Vice Captain will manage.</FormDescription>
                                    <ScrollArea className="rounded-md border p-3 h-32">
                                    {teamFilterOptions.map((team) => (
                                        <FormField
                                        key={team}
                                        control={memberForm.control}
                                        name="managedTeams"
                                        render={({ field }) => {
                                            return (
                                            <FormItem
                                                key={team}
                                                className="flex flex-row items-start space-x-3 space-y-0"
                                            >
                                                <FormControl>
                                                <Checkbox
                                                    checked={field.value?.includes(team)}
                                                    onCheckedChange={(checked) => {
                                                    return checked
                                                        ? field.onChange([...(field.value || []), team])
                                                        : field.onChange(
                                                            (field.value || []).filter(
                                                            (value) => value !== team
                                                            )
                                                        )
                                                    }}
                                                />
                                                </FormControl>
                                                <FormLabel className="text-sm font-normal">
                                                {team}
                                                </FormLabel>
                                            </FormItem>
                                            )
                                        }}
                                        />
                                    ))}
                                    </ScrollArea>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                            )}

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
                           {(watchedRole === 'admin' || watchedRole === 'superadmin') && (
                            <FormField
                              control={memberForm.control}
                              name="password"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Password</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                      <Input
                                        type="password"
                                        placeholder={editingMember ? "Leave blank to keep unchanged" : "Required for admin roles"}
                                        {...field}
                                        className="pl-9"
                                      />
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                          

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
                              {(memberForm.formState.isSubmitting || isLoadingMohallahs) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
                placeholder="Search members by name, ID, email..."
                className="pl-8 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full sm:w-auto">
                <Select
                    value={selectedFilterRole}
                    onValueChange={(value) => setSelectedFilterRole(value)}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Filter by Role" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        {ALL_ROLES.map(r => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                  <Select
                    value={selectedFilterDesignation}
                    onValueChange={(value) => setSelectedFilterDesignation(value)}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Filter by Designation" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Designations</SelectItem>
                        {ALL_DESIGNATIONS.map(d => (
                            <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {canSeeTeamFilter && (
                    <Select value={selectedFilterTeam} onValueChange={setSelectedFilterTeam}>
                        <SelectTrigger>
                            <SelectValue placeholder="Filter by Team" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Teams</SelectItem>
                            {teamFilterOptions.map(team => (
                                <SelectItem key={team} value={team}>{team}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
                {currentUserRole === 'superadmin' && (
                <Select
                    value={selectedFilterMohallahId}
                    onValueChange={(value) => setSelectedFilterMohallahId(value)}
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
                )}
            </div>
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
              <FunkyLoader>Loading members...</FunkyLoader>
            </div>
          ) : (
            <>
              {/* Mobile View: Accordion */}
                <div className="md:hidden">
                    {canManageMembers && filteredMembers.length > 0 && (
                        <div className="flex items-center gap-4 px-4 py-2 border-b">
                            <Checkbox
                                id="selectAllMobile"
                                checked={currentMembersToDisplay.length > 0 && currentMembersToDisplay.every(m => selectedMemberIds.includes(m.id))}
                                onCheckedChange={(checked) => {
                                    if (checked) {
                                        setSelectedMemberIds(prev => [...new Set([...prev, ...currentMembersToDisplay.map(m => m.id)])]);
                                    } else {
                                        const pageIds = new Set(currentMembersToDisplay.map(m => m.id));
                                        setSelectedMemberIds(prev => prev.filter(id => !pageIds.has(id)));
                                    }
                                }}
                            />
                            <label htmlFor="selectAllMobile" className="text-sm font-medium">
                                Select all on this page ({selectedMemberIds.filter(id => currentMembersToDisplay.some(m => m.id === id)).length} / {currentMembersToDisplay.length})
                            </label>
                             <Button variant="link" size="sm" className="p-0 h-auto" onClick={handleSelectAllFiltered} disabled={filteredMembers.length === 0}>
                                Select all ({filteredMembers.length})?
                            </Button>
                        </div>
                    )}
                    <Accordion type="single" collapsible className="w-full">
                        {currentMembersToDisplay.length > 0 ? currentMembersToDisplay.map((member, index) => (
                        <AccordionItem value={member.id} key={member.id} className="border-b" data-state={selectedMemberIds.includes(member.id) ? "selected" : undefined}>
                            <div className={cn("flex items-center w-full px-4", selectedMemberIds.includes(member.id) && "bg-muted/50")}>
                                {canManageMembers && (
                                    <div className="py-4 pr-4">
                                        <Checkbox
                                            checked={selectedMemberIds.includes(member.id)}
                                            onCheckedChange={(checked) => handleSelectMember(member.id, checked)}
                                            onClick={(e) => e.stopPropagation()}
                                            aria-label={`Select member ${member.name}`}
                                        />
                                    </div>
                                )}
                                <AccordionTrigger className="w-full p-0 py-4 hover:no-underline flex-1 text-left">
                                  <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-4">
                                      <span className="text-sm font-mono text-muted-foreground">{((currentPage - 1) * ITEMS_PER_PAGE) + index + 1}.</span>
                                      <div>
                                          <p className="font-semibold text-card-foreground">{member.name}</p>
                                          <p className="text-xs text-muted-foreground">ITS: {member.itsId}</p>
                                      </div>
                                    </div>
                                  </div>
                                </AccordionTrigger>
                            </div>
                            <AccordionContent className="space-y-4 pt-0">
                                <div className="text-sm text-muted-foreground space-y-1 px-4 pb-4 pt-2">
                                    <p><strong>BGK ID:</strong> {member.bgkId || "N/A"}</p>
                                    <p><strong>Designation:</strong> {member.designation || "N/A"}</p>
                                    <p><strong>Team:</strong> {member.team || "N/A"}</p>
                                    <p><strong>Mohallah:</strong> {getMohallahNameById(member.mohallahId)}</p>
                                    <p><strong>Role:</strong> {member.role.charAt(0).toUpperCase() + member.role.slice(1).replace(/-/g, ' ')}</p>
                                </div>
                                {canManageMembers && (
                                    <div className="flex justify-end gap-2 pt-3 border-t mt-3 px-4">
                                    <Button variant="ghost" size="sm" onClick={()=> handleEditMember(member)} className="flex-1" aria-label="Edit Member" disabled={currentUserRole === 'attendance-marker'}>
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
                            </AccordionContent>
                        </AccordionItem>
                        )) : (
                            <div className="text-center py-10">
                                <p className="text-muted-foreground">No members found.</p>
                            </div>
                        )}
                    </Accordion>
                </div>

              {/* Desktop View: Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {canManageMembers && (
                        <TableHead className="w-[40px] px-2">
                          <Checkbox
                            checked={currentMembersToDisplay.length > 0 && currentMembersToDisplay.every(m => selectedMemberIds.includes(m.id))}
                            onCheckedChange={handleSelectAllOnPage}
                            aria-label="Select all members on current page"
                            disabled={currentMembersToDisplay.length === 0}
                          />
                        </TableHead>
                      )}
                      <TableHead className="w-[50px]">Sr.No.</TableHead>
                      <TableHead className="w-[60px] sm:w-[80px]">Avatar</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>ITS / Email</TableHead>
                      <TableHead>BGK ID</TableHead>
                      <TableHead>Mohallah</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Designation</TableHead>
                      <TableHead>Role</TableHead>
                      {canManageMembers && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentMembersToDisplay.length > 0 ? currentMembersToDisplay.map((member, index) => (
                      <TableRow key={member.id} data-state={canManageMembers ? (selectedMemberIds.includes(member.id) ? "selected" : undefined) : undefined}>
                        {canManageMembers && (
                            <TableCell className="px-2">
                            <Checkbox
                                checked={selectedMemberIds.includes(member.id)}
                                onCheckedChange={(checked) => handleSelectMember(member.id, checked)}
                                aria-label={`Select member ${member.name}`}
                            />
                            </TableCell>
                        )}
                        <TableCell>{((currentPage - 1) * ITEMS_PER_PAGE) + index + 1}</TableCell>
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
                        <TableCell>
                            <div>{member.itsId}</div>
                            <div className="text-xs text-muted-foreground">{member.email || "No Email"}</div>
                        </TableCell>
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
                        <TableCell colSpan={canManageMembers ? 11 : 10} className="text-center h-24">
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
              Select CSV file. Columns: `name`, `itsId`, `email`, `bgkId`, `password`, `team`, `phoneNumber`, `role`, `mohallahName`, `designation`, `pageRights` (semicolon-separated paths). MohallahName must exist. Admins can only import to their assigned Mohallah.
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

    

    
