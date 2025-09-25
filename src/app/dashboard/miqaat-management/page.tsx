
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { Miqaat, UserRole, Mohallah, User, MiqaatSession, UserDesignation } from "@/types";
import { PlusCircle, Search, Loader2, CalendarDays, ShieldAlert, Users, MoreHorizontal, Edit, Trash2, Barcode, Download, Eye, Shirt, Clock, CheckCircle, XCircle, Copy, HandCoins, ChevronLeft, ChevronRight, GripVertical } from "lucide-react"; 
import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Form, FormField, FormItem, FormControl, FormMessage, FormLabel as ShadFormLabel, FormDescription } from "@/components/ui/form";
import { getMiqaats, addMiqaat, updateMiqaat, deleteMiqaat as fbDeleteMiqaat, MiqaatDataForAdd, MiqaatDataForUpdate } from "@/lib/firebase/miqaatService";
import { getMohallahs } from "@/lib/firebase/mohallahService";
import { getUsers } from "@/lib/firebase/userService"; 
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
import { format, differenceInCalendarDays, addDays } from "date-fns";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { FunkyLoader } from "@/components/ui/funky-loader";


const miqaatSessionSchema = z.object({
  id: z.string(),
  day: z.number(),
  name: z.string().min(1, "Session name is required."),
  startTime: z.string().refine(val => val, { message: "Start time is required."}),
  endTime: z.string().refine(val => val, { message: "End time is required."}),
  reportingTime: z.string().optional(),
});

const formSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  location: z.string().optional(),
  type: z.enum(['local', 'international']).default('local'),
  attendanceType: z.enum(['single', 'multiple']).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  reportingTime: z.string().optional().nullable(),
  sessions: z.array(miqaatSessionSchema).optional(),
  eligibilityType: z.enum(['groups', 'specific_members']).default('groups'),
  mohallahIds: z.array(z.string()).optional().default([]),
  teams: z.array(z.string()).optional().default([]),
  eligibleItsIds: z.array(z.string()).optional().default([]),
  barcodeData: z.string().optional(),
  attendanceRequirements: z.object({
    fetaPaghri: z.boolean().default(false),
    koti: z.boolean().default(false),
    nazrulMaqam: z.boolean().default(false),
  }).default({ fetaPaghri: false, koti: false, nazrulMaqam: false }),
}).superRefine((data, ctx) => {
    if (data.type === 'local') {
        if (!data.startTime) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Start date and time are required for Local Miqaats.", path: ["startTime"] });
        }
        if (!data.endTime) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "End date and time are required for Local Miqaats.", path: ["endTime"] });
        }
    } else if (data.type === 'international') {
        if (!data.startTime) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Start date is required for International Miqaats.", path: ["startTime"] });
        }
        if (!data.endTime) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "End date is required for International Miqaats.", path: ["endTime"] });
        }
    }

    if (data.startTime && data.endTime && new Date(data.startTime) >= new Date(data.endTime)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "End date/time must be after the start date/time.", path: ["endTime"] });
    }
});


type MiqaatFormValues = z.infer<typeof formSchema>;

const ITEMS_PER_PAGE = 10;

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
  const [miqaats, setMiqaats] = useState<Pick<Miqaat, "id" | "name" | "type" | "attendanceType" | "sessions" | "startTime" | "endTime" | "reportingTime" | "mohallahIds" | "teams" | "eligibleItsIds" | "location" | "barcodeData" | "attendance" | "createdAt" | "attendanceRequirements">[]>([]);
  const [isLoadingMiqaats, setIsLoadingMiqaats] = useState(true);
  const [allAvailableMohallahs, setAllAvailableMohallahs] = useState<Mohallah[]>([]);
  const [isLoadingMohallahs, setIsLoadingMohallahs] = useState(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [miqaatTypeFilter, setMiqaatTypeFilter] = useState<'all' | 'local' | 'international'>("all");
  const [memberSearchTerm, setMemberSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMiqaat, setEditingMiqaat] = useState<Pick<Miqaat, "id" | "name" | "type" | "attendanceType" | "sessions"| "startTime" | "endTime" | "reportingTime" | "mohallahIds" | "teams" | "eligibleItsIds" | "location" | "barcodeData" | "attendance" | "createdAt" | "attendanceRequirements"> | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [currentUserMohallahId, setCurrentUserMohallahId] = useState<string | null>(null);
  const { toast } = useToast();
  
  const [showBarcodeDialog, setShowBarcodeDialog] = useState(false);
  const [barcodeMiqaat, setBarcodeMiqaat] = useState<Miqaat | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMiqaatIds, setSelectedMiqaatIds] = useState<string[]>([]);


  const form = useForm<MiqaatFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      location: "",
      type: 'local',
      attendanceType: undefined,
      startTime: "",
      endTime: "",
      reportingTime: null,
      sessions: [],
      eligibilityType: "groups",
      mohallahIds: [],
      teams: [], 
      eligibleItsIds: [],
      barcodeData: "",
      attendanceRequirements: { fetaPaghri: false, koti: false, nazrulMaqam: false },
    },
  });
  
  const { fields: sessionFields, append: appendSession, remove: removeSession, replace: replaceSessions } = useFieldArray({
    control: form.control,
    name: "sessions"
  });

  const eligibilityType = form.watch("eligibilityType");
  const miqaatType = form.watch("type");
  const attendanceType = form.watch("attendanceType");
  const startDate = form.watch("startTime");
  const endDate = form.watch("endTime");

  const internationalMiqaatDays = useMemo(() => {
    if (miqaatType === 'international' && startDate && endDate) {
      try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (start > end || isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
        return differenceInCalendarDays(end, start) + 1;
      } catch (e) {
        return 0;
      }
    }
    return 0;
  }, [miqaatType, startDate, endDate]);

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
    const mohallahId = localStorage.getItem('userMohallahId');
    setCurrentUserRole(role);
    setCurrentUserMohallahId(mohallahId);

    const dataFetchPromises = [
        new Promise<void>(resolve => { setIsLoadingMiqaats(true); const unsub = getMiqaats(data => { setMiqaats(data); setIsLoadingMiqaats(false); resolve(); }); }),
        new Promise<void>(resolve => { setIsLoadingMohallahs(true); const unsub = getMohallahs(data => { setAllAvailableMohallahs(data); setIsLoadingMohallahs(false); resolve(); }); }),
        getUsers().then(users => {
          setAllUsers(users);
        }).catch(err => console.error("Failed to fetch users", err)).finally(() => {
          setIsLoadingUsers(false);
        }),
    ];

    Promise.all(dataFetchPromises);

  }, [isAuthorized]);
  
  // New derived states for form options based on user role
  const formOptions = useMemo(() => {
    if (currentUserRole === 'superadmin') {
      const allTeams = [...new Set(allUsers.map(u => u.team).filter(Boolean))].sort() as string[];
      return {
        mohallahs: allAvailableMohallahs,
        teams: allTeams,
        users: allUsers,
      };
    }
    if (currentUserRole === 'admin' && currentUserMohallahId) {
      const mohallah = allAvailableMohallahs.find(m => m.id === currentUserMohallahId);
      const usersInMohallah = allUsers.filter(u => u.mohallahId === currentUserMohallahId);
      const teamsInMohallah = [...new Set(usersInMohallah.map(u => u.team).filter(Boolean))].sort() as string[];
      return {
        mohallahs: mohallah ? [mohallah] : [],
        teams: teamsInMohallah,
        users: usersInMohallah,
      };
    }
    // Default empty for other roles or if data is not ready
    return { mohallahs: [], teams: [], users: [] };
  }, [currentUserRole, currentUserMohallahId, allAvailableMohallahs, allUsers]);

  // Derived state for specific members list, filtered by selected groups
  const filteredUsersForForm = useMemo(() => {
      let users = formOptions.users;
      
      const formMohallahs = form.watch('mohallahIds') || [];
      const formTeams = form.watch('teams') || [];

      if (formMohallahs.length > 0) {
          users = users.filter(u => u.mohallahId && formMohallahs.includes(u.mohallahId));
      }
      if (formTeams.length > 0) {
          users = users.filter(u => u.team && formTeams.includes(u.team));
      }

      if (!memberSearchTerm) return users;
      
      return users.filter(user => 
        user.name.toLowerCase().includes(memberSearchTerm.toLowerCase()) || 
        user.itsId.includes(memberSearchTerm)
      );
  }, [formOptions.users, memberSearchTerm, form.watch]);


  useEffect(() => {
    if (!isDialogOpen) {
      setEditingMiqaat(null);
    }
    
    if (editingMiqaat && isDialogOpen) {
      const isInternational = editingMiqaat.type === 'international';
      const hasSessions = editingMiqaat.sessions && editingMiqaat.sessions.length > 0;
      
      form.reset({
        name: editingMiqaat.name,
        location: editingMiqaat.location || "",
        type: editingMiqaat.type || 'local',
        attendanceType: editingMiqaat.attendanceType,

        startTime: editingMiqaat.startTime ? toLocalISOString(new Date(editingMiqaat.startTime)) : "",
        endTime: editingMiqaat.endTime ? toLocalISOString(new Date(editingMiqaat.endTime)) : "",
        reportingTime: editingMiqaat.reportingTime || "",
        
        sessions: hasSessions ? editingMiqaat.sessions.map(s => ({ ...s, reportingTime: s.reportingTime || "" })) : [],
        
        eligibilityType: (editingMiqaat.eligibleItsIds && editingMiqaat.eligibleItsIds.length > 0) ? 'specific_members' : 'groups',
        mohallahIds: editingMiqaat.mohallahIds || [],
        teams: editingMiqaat.teams || [], 
        eligibleItsIds: editingMiqaat.eligibleItsIds || [],
        barcodeData: editingMiqaat.barcodeData || "",
        attendanceRequirements: editingMiqaat.attendanceRequirements || { fetaPaghri: false, koti: false, nazrulMaqam: false },
      });
    } else if (!isDialogOpen) {
      form.reset({ name: "", location: "", type: "local", attendanceType: undefined, startTime: "", endTime: "", reportingTime: null, sessions: [], eligibilityType: "groups", mohallahIds: [], teams: [], eligibleItsIds: [], barcodeData: "", attendanceRequirements: { fetaPaghri: false, koti: false, nazrulMaqam: false } });
    }
  }, [editingMiqaat, form, isDialogOpen]);

  useEffect(() => {
    const { type, attendanceType, startTime, endTime } = form.getValues();

    if (type === 'international' && (attendanceType === 'single' || attendanceType === 'multiple') && internationalMiqaatDays > 0) {
      const existingSessions = form.getValues('sessions') || [];
      const newSessions: MiqaatSession[] = Array.from({ length: internationalMiqaatDays }, (_, i) => {
        const dayNumber = i + 1;
        const existingDaySession = existingSessions.find(s => s.day === dayNumber);
        const dayDate = addDays(new Date(startTime!), i);
        
        if (attendanceType === 'single') {
            return existingDaySession || {
                id: `day-${dayNumber}`,
                day: dayNumber,
                name: `Day ${dayNumber}`,
                startTime: dayDate.toISOString(),
                endTime: dayDate.toISOString(),
                reportingTime: ""
            };
        }
        
        // For multiple, we just need to ensure the day exists and can be added to.
        // We will create at least one session if none exist for that day.
        if (existingDaySession) {
            return existingDaySession;
        }
        return {
            id: crypto.randomUUID(),
            day: dayNumber,
            name: `Session 1`,
            startTime: "",
            endTime: "",
            reportingTime: ""
        };
      });
      
       if (attendanceType === 'single') {
            replaceSessions(newSessions);
       } else {
            // For multiple, preserve existing sessions for other days not in range
            const otherDaySessions = existingSessions.filter(s => s.day > internationalMiqaatDays);
            const combined = [...newSessions, ...otherDaySessions];
            // Remove duplicates by ID and ensure we only have what's needed
            const uniqueSessions = Array.from(new Map(combined.map(s => [s.id, s])).values());
            replaceSessions(uniqueSessions);
       }
    }
  }, [miqaatType, attendanceType, startDate, endDate, internationalMiqaatDays, form, replaceSessions]);


  const handleFormSubmit = async (values: MiqaatFormValues) => {
    const isSingleDayInternational = values.type === 'international' && internationalMiqaatDays === 1;

    let finalSessions = values.sessions || [];

    if (values.type === 'local' || isSingleDayInternational) {
        finalSessions = [{
            id: 'main',
            day: 1,
            name: 'Main Session',
            startTime: values.startTime!,
            endTime: values.endTime!,
            reportingTime: values.reportingTime || undefined
        }];
    }
    
    const dataForService: Omit<MiqaatDataForAdd, 'sessions'> & { sessions?: MiqaatSession[] } = {
      name: values.name,
      location: values.location,
      type: values.type,
      attendanceType: values.attendanceType,
      startTime: values.startTime!,
      endTime: values.endTime!,
      reportingTime: values.type === 'local' ? values.reportingTime! : undefined,
      sessions: finalSessions,
      mohallahIds: values.eligibilityType === 'groups' ? (values.mohallahIds || []) : [],
      teams: values.eligibilityType === 'groups' ? (values.teams || []) : [],
      eligibleItsIds: values.eligibilityType === 'specific_members' ? (values.eligibleItsIds || []) : [],
      barcodeData: values.barcodeData,
      attendanceRequirements: values.attendanceRequirements,
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
  
  const handleFormError = (errors: any) => {
      console.error("Form validation failed:", errors);
  };
  
  const openDialogForType = (type: 'local' | 'international') => {
    setEditingMiqaat(null);
    form.reset({
      name: "",
      location: "",
      type: type, // Set the type based on selection
      attendanceType: undefined,
      startTime: "",
      endTime: "",
      reportingTime: null,
      sessions: [],
      eligibilityType: "groups",
      mohallahIds: [],
      teams: [], 
      eligibleItsIds: [],
      barcodeData: "",
      attendanceRequirements: { fetaPaghri: false, koti: false, nazrulMaqam: false },
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (miqaat: Miqaat) => {
    setEditingMiqaat(miqaat);
    setIsDialogOpen(true);
  };
  
  const handleDuplicate = (miqaat: Miqaat) => {
    setEditingMiqaat(null); // Ensure we are in "create" mode
    
    form.reset({
      name: `${miqaat.name} - Copy`,
      location: miqaat.location || "",
      type: miqaat.type,
      attendanceType: miqaat.attendanceType,
      startTime: "", // Reset dates
      endTime: "",
      reportingTime: null,
      sessions: [], // Reset sessions
      eligibilityType: (miqaat.eligibleItsIds && miqaat.eligibleItsIds.length > 0) ? 'specific_members' : 'groups',
      mohallahIds: miqaat.mohallahIds || [],
      teams: miqaat.teams || [],
      eligibleItsIds: miqaat.eligibleItsIds || [],
      attendanceRequirements: miqaat.attendanceRequirements || { fetaPaghri: false, koti: false, nazrulMaqam: false },
      barcodeData: "",
    });
    
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
  
  const handleBulkDelete = async () => {
    if (selectedMiqaatIds.length === 0) return;

    let deletedCount = 0;
    let failedCount = 0;

    for (const miqaatId of selectedMiqaatIds) {
      try {
        await fbDeleteMiqaat(miqaatId);
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete miqaat ${miqaatId}:`, error);
        failedCount++;
      }
    }

    if (failedCount > 0) {
      toast({
        title: "Bulk Delete Partially Failed",
        description: `Deleted ${deletedCount} miqaats, but failed to delete ${failedCount}.`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Bulk Delete Successful",
        description: `Successfully deleted ${deletedCount} miqaat(s).`,
      });
    }
    
    setSelectedMiqaatIds([]);
  };


  const filteredMiqaats = useMemo(() => {
    let roleFilteredMiqaats = miqaats;
    
    if (currentUserRole === 'admin' && currentUserMohallahId) {
        roleFilteredMiqaats = miqaats.filter(m => {
            const isAssignedToMe = m.mohallahIds?.includes(currentUserMohallahId);
            const isPublic = !m.mohallahIds?.length && !m.teams?.length && !m.eligibleItsIds?.length;
            return isAssignedToMe || isPublic;
        });
    }
    
    return roleFilteredMiqaats.filter(m => {
        const typeMatch = miqaatTypeFilter === 'all' || m.type === miqaatTypeFilter;
        const searchTermMatch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (m.location || "").toLowerCase().includes(searchTerm.toLowerCase());
        return typeMatch && searchTermMatch;
    });
  }, [miqaats, searchTerm, miqaatTypeFilter, currentUserRole, currentUserMohallahId]);
  
  const totalPages = Math.ceil(filteredMiqaats.length / ITEMS_PER_PAGE);
  const currentMiqaats = useMemo(() => {
      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
      return filteredMiqaats.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredMiqaats, currentPage]);

  const handlePreviousPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  const handleNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  
  const handleSelectAllOnPage = (checked: boolean | string) => {
    if (checked) {
      setSelectedMiqaatIds(prev => [...new Set([...prev, ...currentMiqaats.map(m => m.id)])]);
    } else {
      const pageIds = currentMiqaats.map(m => m.id);
      setSelectedMiqaatIds(prev => prev.filter(id => !pageIds.includes(id)));
    }
  };
  
  const handleSelectMiqaat = (miqaatId: string, checked: boolean | string) => {
    setSelectedMiqaatIds(prev => checked ? [...prev, miqaatId] : prev.filter(id => id !== miqaatId));
  };


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
              <CardTitle className="flex items-center"><CalendarDays className="mr-2 h-5 w-5 text-primary"/>Manage Miqaats</CardTitle>
              <CardDescription className="mt-1">Create, view, and manage all Miqaats. List updates in realtime.</CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              {selectedMiqaatIds.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete ({selectedMiqaatIds.length})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Bulk Deletion</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete {selectedMiqaatIds.length} selected miqaat(s)? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive hover:bg-destructive/90">
                        Delete Selected
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" className="shrink-0">
                      <PlusCircle className="h-4 w-4 md:mr-2" />
                      <span className="hidden md:inline">Add New Miqaat</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => openDialogForType('local')}>Local Miqaat</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => openDialogForType('international')}>International Miqaat</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DialogContent className="sm:max-w-xl">
                  <DialogHeader>
                    <DialogTitle>{editingMiqaat ? "Edit Miqaat" : "Create New Miqaat"}</DialogTitle>
                    <DialogDescription>
                      {editingMiqaat ? "Update the details of the Miqaat." : `Creating a new ${form.getValues("type")} Miqaat.`}
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleFormSubmit, handleFormError)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                      <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem><ShadFormLabel>Name</ShadFormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                       <FormField control={form.control} name="location" render={({ field }) => (
                        <FormItem><ShadFormLabel>Location</ShadFormLabel><FormControl><Input placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      
                      <FormField
                        control={form.control} name="type"
                        render={({ field }) => (
                          <FormItem className="space-y-3">
                            <ShadFormLabel>Miqaat Type</ShadFormLabel>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                value={field.value}
                                className="flex space-x-4"
                                disabled={!!editingMiqaat}
                              >
                                <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="local" /></FormControl><ShadFormLabel className="font-normal">Local</ShadFormLabel></FormItem>
                                <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="international" /></FormControl><ShadFormLabel className="font-normal">International</ShadFormLabel></FormItem>
                              </RadioGroup>
                            </FormControl>
                          </FormItem>
                      )}/>

                      
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="startTime" render={({ field }) => (
                            <FormItem><ShadFormLabel>{miqaatType === 'local' ? 'Start Time' : 'Start Date'}</ShadFormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="endTime" render={({ field }) => (
                            <FormItem><ShadFormLabel>{miqaatType === 'local' ? 'End Time' : 'End Date'}</ShadFormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                      
                       {miqaatType === 'international' && (
                          <div className="p-4 border rounded-md space-y-4">
                            
                             {internationalMiqaatDays > 1 && (
                               <FormField control={form.control} name="attendanceType" render={({ field }) => (
                                  <FormItem className="space-y-3 pt-2">
                                      <ShadFormLabel className="font-semibold">Attendance Type</ShadFormLabel>
                                      <FormControl>
                                          <RadioGroup onValueChange={field.onChange} value={field.value} className="flex space-x-4">
                                              <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="single" /></FormControl><ShadFormLabel className="font-normal">Single Daily Check-in</ShadFormLabel></FormItem>
                                              <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="multiple" /></FormControl><ShadFormLabel className="font-normal">Multiple Sessions per Day</ShadFormLabel></FormItem>
                                          </RadioGroup>
                                      </FormControl>
                                      <FormMessage />
                                  </FormItem>
                              )}/>
                             )}
                             {internationalMiqaatDays > 0 && (attendanceType === 'single' || attendanceType === 'multiple') && (
                                <div className="space-y-4">
                                  <Label>Daily Sessions ({internationalMiqaatDays} Days)</Label>
                                  <div className="space-y-4 max-h-60 overflow-y-auto p-2 border rounded-md">
                                    {Array.from({ length: internationalMiqaatDays }, (_, i) => {
                                      const dayIndex = i + 1;
                                      const dayDate = format(addDays(new Date(startDate!), i), "MMM dd");
                                      return (
                                         <Card key={dayIndex} className="p-3">
                                            <p className="font-semibold mb-2">Day {dayIndex} - {dayDate}</p>
                                             <>
                                                {sessionFields.filter(f => f.day === dayIndex).map((session, sessionIdx) => {
                                                    const overallIndex = sessionFields.findIndex(f => f.id === session.id);
                                                    return (
                                                      <div key={session.id} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end border-b pb-2 mb-2">
                                                        <FormField control={form.control} name={`sessions.${overallIndex}.name`} render={({ field }) => (<FormItem><ShadFormLabel className="text-xs">Name</ShadFormLabel><FormControl><Input {...field}/></FormControl></FormItem>)}/>
                                                        <FormField control={form.control} name={`sessions.${overallIndex}.startTime`} render={({ field }) => (<FormItem><ShadFormLabel className="text-xs">Start</ShadFormLabel><FormControl><Input type="time" {...field}/></FormControl></FormItem>)}/>
                                                        <FormField control={form.control} name={`sessions.${overallIndex}.endTime`} render={({ field }) => (<FormItem><ShadFormLabel className="text-xs">End</ShadFormLabel><FormControl><Input type="time" {...field}/></FormControl></FormItem>)}/>
                                                        <div className="grid grid-cols-2 gap-1 items-end">
                                                          <FormField control={form.control} name={`sessions.${overallIndex}.reportingTime`} render={({ field }) => (<FormItem><ShadFormLabel className="text-xs">Report</ShadFormLabel><FormControl><Input type="time" {...field} value={field.value || ''}/></FormControl></FormItem>)}/>
                                                          <Button type="button" size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => removeSession(overallIndex)}><Trash2 className="h-4 w-4"/></Button>
                                                        </div>
                                                      </div>
                                                    );
                                                })}
                                                {attendanceType === 'multiple' && (
                                                  <Button type="button" size="sm" variant="outline" onClick={() => appendSession({ id: crypto.randomUUID(), day: dayIndex, name: "", startTime: "", endTime: "", reportingTime: "" })}>
                                                    Add Session for Day {dayIndex}
                                                  </Button>
                                                )}
                                                </>
                                         </Card>
                                      );
                                    })}
                                  </div>
                                </div>
                             )}
                          </div>
                       )}

                       {miqaatType === 'local' && (
                         <FormField control={form.control} name="reportingTime" render={({ field }) => (
                          <FormItem><ShadFormLabel>Reporting Time</ShadFormLabel><FormControl><Input type="time" {...field} value={field.value || ""} /></FormControl><FormDescription className="text-xs">Optional. Leave blank if not applicable.</FormDescription><FormMessage /></FormItem>
                        )} />
                       )}

                      <FormField
                          control={form.control}
                          name="attendanceRequirements"
                          render={() => (
                            <FormItem className="space-y-2 pt-2">
                              <ShadFormLabel className="font-semibold">Attendance Requirements</ShadFormLabel>
                              <div className="flex flex-col sm:flex-row gap-4">
                                  <FormField control={form.control} name="attendanceRequirements.fetaPaghri" render={({ field }) => (
                                      <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><ShadFormLabel className="font-normal text-sm">Feta/Paghri</ShadFormLabel></FormItem>
                                  )}/>
                                  <FormField control={form.control} name="attendanceRequirements.koti" render={({ field }) => (
                                      <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><ShadFormLabel className="font-normal text-sm">Koti</ShadFormLabel></FormItem>
                                  )}/>
                                  <FormField control={form.control} name="attendanceRequirements.nazrulMaqam" render={({ field }) => (
                                      <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><ShadFormLabel className="font-normal text-sm">Nazrul Maqam</ShadFormLabel></FormItem>
                                  )}/>
                              </div>
                              <FormDescription className="text-xs">Select any requirements for attendance marking.</FormDescription>
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
                                  formOptions.mohallahs.map((mohallah) => (
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
                                {isLoadingUsers ? (<p className="text-sm text-muted-foreground">Loading...</p>) : (
                                  formOptions.teams.map((team) => (
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
                                          placeholder="Search by name, ITS..."
                                          value={memberSearchTerm}
                                          onChange={(e) => setMemberSearchTerm(e.target.value)}
                                          className="pl-8 mb-2"
                                      />
                                  </div>
                                  <ScrollArea className="rounded-md border p-3 h-60">
                                  {isLoadingUsers ? (<p className="text-sm text-muted-foreground">Loading Users...</p>) : (
                                      filteredUsersForForm.map((user) => (
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
                                  {filteredUsersForForm.length === 0 && !isLoadingUsers && <p className="text-sm text-muted-foreground text-center py-4">No members found.</p>}
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
                        <Button type="submit" disabled={form.formState.isSubmitting || isLoadingMohallahs || isLoadingUsers}>
                          {(form.formState.isSubmitting || isLoadingMohallahs || isLoadingUsers) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {editingMiqaat ? "Save Changes" : "Create Miqaat"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-grow">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search Miqaats by name or location..."
                className="pl-8 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
             <Select value={miqaatTypeFilter} onValueChange={(value) => setMiqaatTypeFilter(value as 'all' | 'local' | 'international')}>
                <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="local">Local</SelectItem>
                    <SelectItem value="international">International</SelectItem>
                </SelectContent>
            </Select>
          </div>
          {isLoadingMiqaats ? (
            <div className="flex justify-center items-center py-10">
                <FunkyLoader>Loading Miqaats...</FunkyLoader>
            </div>
          ) : currentMiqaats.length > 0 ? (
            <>
              {/* Mobile View: Accordion */}
              <div className="md:hidden">
                <Accordion type="single" collapsible className="w-full">
                  {currentMiqaats.map((miqaat, index) => {
                    const isSpecific = miqaat.eligibleItsIds && miqaat.eligibleItsIds.length > 0;
                    const eligibility = isSpecific ? `${miqaat.eligibleItsIds?.length} members` : "Groups";
                    const isExpired = new Date(miqaat.endTime) < new Date();

                    return (
                      <AccordionItem value={miqaat.id} key={miqaat.id}>
                        <div className={cn("flex items-center w-full pr-4", selectedMiqaatIds.includes(miqaat.id) && "bg-muted/50")}>
                          {(currentUserRole === 'admin' || currentUserRole === 'superadmin') && (
                            <div className="py-4 pl-4">
                                <Checkbox
                                    checked={selectedMiqaatIds.includes(miqaat.id)}
                                    onCheckedChange={(checked) => handleSelectMiqaat(miqaat.id, checked)}
                                    onClick={(e) => e.stopPropagation()}
                                    aria-label={`Select miqaat ${miqaat.name}`}
                                />
                            </div>
                          )}
                          <AccordionTrigger className="w-full pl-4 py-4 hover:no-underline flex-1 text-left">
                             <div className="flex items-center justify-between w-full">
                               <div className="flex items-center gap-4">
                                 <span className="text-sm font-mono text-muted-foreground">{((currentPage - 1) * ITEMS_PER_PAGE) + index + 1}.</span>
                                 <div className="flex-grow text-left">
                                   <p className="font-semibold text-card-foreground">{miqaat.name}</p>
                                   <p className="text-xs text-muted-foreground">{format(new Date(miqaat.startTime), "PP")}</p>
                                 </div>
                               </div>
                                <Badge variant={isExpired ? 'destructive' : 'default'} className="whitespace-nowrap">
                                 {isExpired ? <XCircle className="mr-1 h-3 w-3" /> : <CheckCircle className="mr-1 h-3 w-3" />}
                                 {isExpired ? 'Expired' : 'Active'}
                                </Badge>
                             </div>
                          </AccordionTrigger>
                        </div>
                        <AccordionContent className="space-y-4 pt-0">
                           <div className="grid grid-cols-2 gap-4 text-sm px-4 pb-4 pt-2">
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
                                  <p className="font-medium text-muted-foreground">Requirements</p>
                                  <div className="flex flex-col gap-1">
                                      {miqaat.attendanceRequirements?.fetaPaghri && <Badge variant="secondary" className="text-xs w-fit">Feta/Paghri</Badge>}
                                      {miqaat.attendanceRequirements?.koti && <Badge variant="secondary" className="text-xs w-fit">Koti</Badge>}
                                      {miqaat.attendanceRequirements?.nazrulMaqam && <Badge variant="secondary" className="text-xs w-fit">Nazrul Maqam</Badge>}
                                      {!miqaat.attendanceRequirements?.fetaPaghri && !miqaat.attendanceRequirements?.koti && !miqaat.attendanceRequirements?.nazrulMaqam && <span className="text-xs">N/A</span>}
                                  </div>
                              </div>
                           </div>
                           <Separator/>
                            <div className="flex justify-end gap-2 px-4 pb-2">
                                <Button variant="ghost" size="icon" onClick={() => { setBarcodeMiqaat(miqaat as Miqaat); setShowBarcodeDialog(true); }}>
                                    <Barcode className="h-4 w-4"/>
                                    <span className="sr-only">Barcode</span>
                                </Button>
                                {currentUserRole === 'admin' || currentUserRole === 'superadmin' ? (
                                    <>
                                        <Button variant="ghost" size="icon" onClick={() => handleDuplicate(miqaat as Miqaat)}>
                                            <Copy className="h-4 w-4"/>
                                            <span className="sr-only">Duplicate</span>
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => handleEdit(miqaat as Miqaat)}>
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
                            {(currentUserRole === 'admin' || currentUserRole === 'superadmin') && (
                              <TableHead className="w-[50px] px-2">
                                <Checkbox
                                    onCheckedChange={handleSelectAllOnPage}
                                    checked={currentMiqaats.length > 0 && currentMiqaats.every(m => selectedMiqaatIds.includes(m.id))}
                                    aria-label="Select all on page"
                                />
                              </TableHead>
                            )}
                            <TableHead className="w-[50px]">Sr.No.</TableHead>
                            <TableHead>Miqaat Title</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Dates</TableHead>
                            <TableHead>Eligibility</TableHead>
                            <TableHead>Attendance</TableHead>
                            <TableHead>Requirements</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentMiqaats.map((miqaat, index) => {
                            const isSpecific = miqaat.eligibleItsIds && miqaat.eligibleItsIds.length > 0;
                            const eligibility = isSpecific
                                ? `${miqaat.eligibleItsIds?.length} members`
                                : "Groups";

                            return (
                                <TableRow key={miqaat.id} data-state={selectedMiqaatIds.includes(miqaat.id) ? "selected" : undefined}>
                                    {(currentUserRole === 'admin' || currentUserRole === 'superadmin') && (
                                       <TableCell className="px-2">
                                         <Checkbox
                                          checked={selectedMiqaatIds.includes(miqaat.id)}
                                          onCheckedChange={(checked) => handleSelectMiqaat(miqaat.id, checked)}
                                          aria-label={`Select miqaat ${miqaat.name}`}
                                         />
                                       </TableCell>
                                    )}
                                    <TableCell>{((currentPage - 1) * ITEMS_PER_PAGE) + index + 1}</TableCell>
                                    <TableCell className="font-medium">
                                        {miqaat.name}
                                        <p className="text-sm text-muted-foreground line-clamp-1">{miqaat.location || "No location"}</p>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={miqaat.type === 'local' ? 'outline' : 'secondary'}>{miqaat.type}</Badge>
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
                                          {miqaat.attendanceRequirements?.fetaPaghri && <Badge variant="default" className="text-xs">Feta/Paghri</Badge>}
                                          {miqaat.attendanceRequirements?.koti && <Badge variant="default" className="text-xs">Koti</Badge>}
                                          {miqaat.attendanceRequirements?.nazrulMaqam && <Badge variant="default" className="text-xs">Nazrul Maqam</Badge>}
                                          {!miqaat.attendanceRequirements?.fetaPaghri && !miqaat.attendanceRequirements?.koti && !miqaat.attendanceRequirements?.nazrulMaqam && <Badge variant="secondary" className="text-xs">N/A</Badge>}
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
                                                    <DropdownMenuItem onSelect={() => handleDuplicate(miqaat as Miqaat)}>
                                                        <Copy className="mr-2 h-4 w-4" /> Duplicate
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => handleEdit(miqaat as Miqaat)}>
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
         <CardFooter className="flex flex-col sm:flex-row justify-between items-center pt-4 gap-2">
            <p className="text-xs text-muted-foreground">
                Showing {currentMiqaats.length > 0 ? ((currentPage - 1) * ITEMS_PER_PAGE) + 1 : 0} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredMiqaats.length)} of {filteredMiqaats.length} Miqaats
            </p>
            {totalPages > 1 && (
                <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages}>
                    Next <ChevronRight className="h-4 w-4" />
                </Button>
                </div>
            )}
        </CardFooter>
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

    