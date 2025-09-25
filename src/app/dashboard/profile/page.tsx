
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Form as UIForm, FormControl, FormMessage, FormItem, FormField, FormLabel } from "@/components/ui/form";
import type { AttendanceRecord, User, Mohallah, Miqaat, UserDesignation, FormResponse, Form, SystemLog } from "@/types";
import { Edit3, Mail, Phone, ShieldCheck, Users, MapPin, CalendarClock, UserCog, FileText, Check, X, CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight, Loader2, Lock } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { getUserByItsOrBgkId, getUsers, updateUser } from "@/lib/firebase/userService";
import { getMohallahs } from "@/lib/firebase/mohallahService";
import { getMiqaats } from "@/lib/firebase/miqaatService";
import { getFormResponsesForUser, getForms } from "@/lib/firebase/formService";
import { getLoginLogsForUser } from "@/lib/firebase/logService";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import type { Unsubscribe } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FunkyLoader } from "@/components/ui/funky-loader";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const GROUP_LEADER_DESIGNATION: UserDesignation = "Group Leader";
const ASST_GROUP_LEADER_DESIGNATION: UserDesignation = "Asst.Grp Leader";

interface FormHistoryStatus extends Form {
  submissionStatus: 'Filled' | 'Not Filled';
  submittedAt?: string;
}

const ITEMS_PER_PAGE = 10;

const profileFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phoneNumber: z.string().optional().or(z.literal("")),
  password: z.string().optional(),
}).refine(data => {
    // If password is provided (and not just an empty string), it must be at least 6 characters
    if (data.password && data.password.length > 0 && data.password.length < 6) {
        return false;
    }
    return true;
}, {
    message: "Password must be at least 6 characters.",
    path: ["password"],
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;


export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [mohallahs, setMohallahs] = useState<Mohallah[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [formHistory, setFormHistory] = useState<FormHistoryStatus[]>([]);
  const [loginHistory, setLoginHistory] = useState<SystemLog[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  
  const [isLoadingFormHistory, setIsLoadingFormHistory] = useState(false);
  const [formHistoryError, setFormHistoryError] = useState<string | null>(null);
  
  const [isLoadingLoginHistory, setIsLoadingLoginHistory] = useState(false);
  const [loginHistoryError, setLoginHistoryError] = useState<string | null>(null);

  const [attendancePage, setAttendancePage] = useState(1);
  const [formsPage, setFormsPage] = useState(1);
  const [loginPage, setLoginPage] = useState(1);

  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);

  const router = useRouter();
  const { toast } = useToast();

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
      phoneNumber: user?.phoneNumber || "",
      password: "",
    },
  });

  const fetchProfileData = useCallback(async () => {
    setIsLoading(true);
    let isMounted = true;
    let unsubscribeMohallahs: Unsubscribe | null = null;
    let unsubscribeMiqaats: Unsubscribe | null = null;

    if (typeof window !== "undefined") {
      const storedItsId = localStorage.getItem('userItsId');
      if (!storedItsId) {
        if (isMounted) router.push('/');
        setIsLoading(false);
        return;
      }

      try {
        const [fetchedUser, allSystemUsers] = await Promise.all([
          getUserByItsOrBgkId(storedItsId),
          getUsers(),
        ]);

        if (!isMounted) return;
        setUser(fetchedUser);
        setAllUsers(allSystemUsers);
        
        if (fetchedUser) {
            profileForm.reset({
                name: fetchedUser.name,
                email: fetchedUser.email || "",
                phoneNumber: fetchedUser.phoneNumber || "",
                password: "", // Always start with empty password field
            });
        }


        if (fetchedUser) {
          // Fetch Attendance History
          setIsLoadingHistory(true);
          setHistoryError(null);

          unsubscribeMohallahs = getMohallahs((fetchedMohallahs) => {
            if (isMounted) setMohallahs(fetchedMohallahs);
          });

          unsubscribeMiqaats = getMiqaats(async (allMiqaats) => {
            try {
                if (!isMounted) return;
                
                const userMap = new Map(allSystemUsers.map(u => [u.itsId, u.name]));
                const attendedRecords: AttendanceRecord[] = [];
                 const attendedMiqaatSessionKeys = new Set<string>();

                allMiqaats.forEach(miqaat => {
                    (miqaat.attendance || []).forEach(entry => {
                        if (entry.userItsId === fetchedUser.itsId) {
                            attendedRecords.push({
                                id: `${miqaat.id}-${entry.userItsId}-${entry.sessionId || 'main'}`,
                                miqaatId: miqaat.id,
                                miqaatName: miqaat.name,
                                miqaatType: miqaat.type,
                                userItsId: entry.userItsId,
                                userName: entry.userName,
                                markedAt: entry.markedAt,
                                markedByName: userMap.get(entry.markedByItsId) || entry.markedByItsId,
                                status: entry.status || 'present',
                                uniformCompliance: entry.uniformCompliance,
                            });
                             attendedMiqaatSessionKeys.add(`${miqaat.id}-${entry.sessionId || 'main'}`);
                        }
                    });

                    (miqaat.safarList || []).forEach(entry => {
                        if (entry.userItsId === fetchedUser.itsId) {
                             attendedRecords.push({
                                id: `safar-${miqaat.id}-${entry.userItsId}-${entry.sessionId || 'main'}`,
                                miqaatId: miqaat.id,
                                miqaatName: miqaat.name,
                                miqaatType: miqaat.type,
                                userItsId: entry.userItsId,
                                userName: entry.userName,
                                markedAt: entry.markedAt,
                                markedByName: userMap.get(entry.markedByItsId) || entry.markedByItsId,
                                status: 'safar',
                            });
                            attendedMiqaatSessionKeys.add(`${miqaat.id}-${entry.sessionId || 'main'}`);
                        }
                    });
                });

                const eligibleMiqaats = allMiqaats.filter(miqaat => {
                    const now = new Date();
                    const miqaatEndTime = new Date(miqaat.endTime);
                    if (now < miqaatEndTime) return false;

                    const isForEveryone = !miqaat.mohallahIds?.length && !miqaat.teams?.length && !miqaat.eligibleItsIds?.length;
                    if (isForEveryone) return true;

                    const eligibleById = !!miqaat.eligibleItsIds?.includes(fetchedUser.itsId);
                    const eligibleByTeam = !!fetchedUser.team && !!miqaat.teams?.includes(fetchedUser.team);
                    const eligibleByMohallah = !!fetchedUser.mohallahId && !!miqaat.mohallahIds?.includes(fetchedUser.mohallahId);
                    return eligibleById || eligibleByTeam || eligibleByMohallah;
                });

                const absentRecords: AttendanceRecord[] = [];
                eligibleMiqaats.forEach(miqaat => {
                    const sessions = (miqaat.sessions && miqaat.sessions.length > 0) ? miqaat.sessions : [{ id: 'main', startTime: miqaat.startTime, name: 'Main Session', day: 1, endTime: miqaat.endTime }];
                    sessions.forEach(session => {
                        const sessionKey = `${miqaat.id}-${session.id}`;
                        if (!attendedMiqaatSessionKeys.has(sessionKey)) {
                            absentRecords.push({
                                id: `absent-${sessionKey}-${fetchedUser.itsId}`,
                                miqaatId: miqaat.id,
                                miqaatName: miqaat.name,
                                miqaatType: miqaat.type,
                                userItsId: fetchedUser.itsId,
                                userName: fetchedUser.name,
                                markedAt: session.startTime,
                                status: 'absent' as const,
                            });
                        }
                    });
                });


                const combinedHistory = [...attendedRecords, ...absentRecords];
                combinedHistory.sort((a, b) => new Date(b.markedAt).getTime() - new Date(a.markedAt).getTime());

                if (isMounted) {
                    setAttendanceHistory(combinedHistory);
                }
            } catch (historyFetchError: any) {
                console.error("Failed to fetch or process attendance history:", historyFetchError);
                if (isMounted) {
                    setHistoryError("Could not load attendance history.");
                }
            } finally {
                if (isMounted) setIsLoadingHistory(false);
            }
          });

          // Fetch Form History
            setIsLoadingFormHistory(true);
            setFormHistoryError(null);
            try {
                const [allForms, userResponses] = await Promise.all([
                    getForms(),
                    getFormResponsesForUser(fetchedUser.itsId)
                ]);

                if (!isMounted) return;

                const userResponseMap = new Map(userResponses.map(res => [res.formId, res]));

                const processedFormHistory: FormHistoryStatus[] = allForms
                    .filter(form => {
                        const isForEveryone = !form.mohallahIds?.length && !form.teams?.length && !form.eligibleItsIds?.length;
                        if (isForEveryone) return true;
                        const eligibleById = !!form.eligibleItsIds?.includes(fetchedUser.itsId);
                        const eligibleByTeam = !!fetchedUser.team && !!form.teams?.includes(fetchedUser.team);
                        const eligibleByMohallah = !!fetchedUser.mohallahId && !!form.mohallahIds?.includes(fetchedUser.mohallahId);
                        return eligibleById || eligibleByTeam || eligibleByMohallah;
                    })
                    .map(form => {
                        const userResponse = userResponseMap.get(form.id);
                        return {
                            ...form,
                            submissionStatus: userResponse ? 'Filled' : 'Not Filled',
                            submittedAt: userResponse?.submittedAt
                        };
                    });

                setFormHistory(processedFormHistory.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

            } catch (formError: any) {
                console.error("Failed to fetch form history:", formError);
                if (formError instanceof Error && formError.message.includes("index")) {
                    setFormHistoryError("Could not load form submission history. A database index is required. Please contact support.");
                } else {
                    setFormHistoryError("Could not load form submission history.");
                }
            } finally {
                if (isMounted) setIsLoadingFormHistory(false);
            }
            
            // Fetch Login History
            setIsLoadingLoginHistory(true);
            setLoginHistoryError(null);
            try {
                const fetchedLoginLogs = await getLoginLogsForUser(fetchedUser.itsId);
                if (isMounted) {
                    setLoginHistory(fetchedLoginLogs);
                }
            } catch (loginError: any) {
                 console.error("Failed to fetch login history:", loginError);
                 if (loginError instanceof Error && loginError.message.includes("index")) {
                    setLoginHistoryError("Could not load login history due to a database configuration issue.");
                 } else {
                    setLoginHistoryError("Could not load login history.");
                 }
            } finally {
                if (isMounted) setIsLoadingLoginHistory(false);
            }


        } else {
            if (isMounted) {
              setIsLoadingHistory(false);
              setIsLoadingFormHistory(false);
              setIsLoadingLoginHistory(false);
            }
        }
      } catch (error) {
        console.error("Failed to fetch profile data:", error);
        if (isMounted) {
            setUser(null);
            setHistoryError("Could not load user profile.");
            setFormHistoryError("Could not load user profile.");
            setLoginHistoryError("Could not load user profile.");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    } else {
       if (isMounted) setIsLoading(false);
    }
    
    return () => {
      isMounted = false;
      if (unsubscribeMohallahs) unsubscribeMohallahs();
      if (unsubscribeMiqaats) unsubscribeMiqaats();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  const teamLeaders = useMemo(() => {
    if (!user?.team || allUsers.length === 0) {
        return { groupLeader: null, asstGroupLeader: null, viceCaptain: null, captain: null };
    }

    const myTeam = user.team;

    const groupLeader = allUsers.find(
        u => u.team === myTeam && u.designation === GROUP_LEADER_DESIGNATION
    ) || null;
    
    const asstGroupLeader = allUsers.find(
        u => u.team === myTeam && u.designation === ASST_GROUP_LEADER_DESIGNATION
    ) || null;

    const viceCaptain = allUsers.find(
        u => u.designation === "Vice Captain" && u.managedTeams?.includes(myTeam)
    ) || null;
    
    const captain = allUsers.find(u => u.designation === "Captain") || null;

    return { groupLeader, asstGroupLeader, viceCaptain, captain };
  }, [user, allUsers]);

  const getMohallahName = (mohallahId?: string) => {
    if (!mohallahId || mohallahs.length === 0) return "N/A";
    const mohallah = mohallahs.find(m => m.id === mohallahId);
    return mohallah ? mohallah.name : "Unknown Mohallah";
  };
  
    const handleProfileUpdate = async (values: ProfileFormValues) => {
        if (!user || !user.id || !user.mohallahId) {
            toast({ title: "Error", description: "User session is invalid. Please log in again.", variant: "destructive" });
            return;
        }

        try {
            const payload: Partial<User> = {
                name: values.name,
                email: values.email,
                phoneNumber: values.phoneNumber,
            };

            // Only include password if it's not empty
            if (values.password && values.password.trim() !== "") {
                payload.password = values.password;
            }

            await updateUser(user.id, user.mohallahId, payload);
            toast({ title: "Profile Updated", description: "Your details have been successfully updated." });
            
            // Re-fetch user data to update the UI
            const updatedUser = await getUserByItsOrBgkId(user.itsId);
            setUser(updatedUser);
             if (updatedUser) {
                localStorage.setItem('userName', updatedUser.name);
             }
            
            setIsEditSheetOpen(false);

        } catch (error) {
            console.error("Error updating profile:", error);
            toast({ title: "Update Failed", description: "Could not save your changes. Please try again.", variant: "destructive" });
        }
    };
    // Pagination logic for Attendance History
    const attendanceTotalPages = Math.ceil(attendanceHistory.length / ITEMS_PER_PAGE);
    const currentAttendanceData = useMemo(() => {
        const startIndex = (attendancePage - 1) * ITEMS_PER_PAGE;
        return attendanceHistory.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [attendanceHistory, attendancePage]);

    // Pagination logic for Forms History
    const formsTotalPages = Math.ceil(formHistory.length / ITEMS_PER_PAGE);
    const currentFormsData = useMemo(() => {
        const startIndex = (formsPage - 1) * ITEMS_PER_PAGE;
        return formHistory.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [formHistory, formsPage]);

    // Pagination logic for Login History
    const loginTotalPages = Math.ceil(loginHistory.length / ITEMS_PER_PAGE);
    const currentLoginData = useMemo(() => {
        const startIndex = (loginPage - 1) * ITEMS_PER_PAGE;
        return loginHistory.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [loginHistory, loginPage]);

  if (isLoading && !user) {
    return (
      <div className="flex items-center justify-center h-full py-10">
        <FunkyLoader size="lg">Loading profile...</FunkyLoader>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full py-10">
        <p className="text-destructive">Could not load user profile. Please try logging in again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden shadow-xl">
        <div className="bg-muted/30 p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
          <Avatar className="h-24 w-24 md:h-32 md:w-32 border-4 border-background shadow-md">
            <AvatarImage src={user.avatarUrl || `https://placehold.co/100x100.png?text=${user.name.substring(0,2).toUpperCase()}`} alt={user.name} data-ai-hint="avatar profile"/>
            <AvatarFallback>{user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-grow text-center md:text-left w-full">
            <div className="flex flex-row items-center justify-center md:justify-between mb-1">
              <h3 className="text-2xl font-bold text-foreground">{user.name}</h3>
                <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="ml-4 shrink-0">
                        <Edit3 className="h-4 w-4 md:mr-2" />
                        <span className="hidden md:inline">Edit Profile</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                        <SheetTitle>Edit Your Profile</SheetTitle>
                        <SheetDescription>
                            Update your personal information here. Click save when you're done.
                        </SheetDescription>
                    </SheetHeader>
                    <UIForm {...profileForm}>
                        <form onSubmit={profileForm.handleSubmit(handleProfileUpdate)} className="space-y-4 py-4">
                             <FormField
                                control={profileForm.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Full Name</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={profileForm.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email Address</FormLabel>
                                        <FormControl><Input type="email" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={profileForm.control}
                                name="phoneNumber"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Phone Number</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {(user.role === 'admin' || user.role === 'superadmin') && (
                               <FormField
                                control={profileForm.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>New Password</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    type="password"
                                                    placeholder="Leave blank to keep unchanged"
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

                             <SheetFooter className="pt-4">
                                <Button type="button" variant="outline" onClick={() => setIsEditSheetOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={profileForm.formState.isSubmitting}>
                                    {profileForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Changes
                                </Button>
                            </SheetFooter>
                        </form>
                    </UIForm>
                  </SheetContent>
                </Sheet>
            </div>
            <p className="text-accent">ITS: {user.itsId} {user.bgkId && `/ BGK: ${user.bgkId}`}</p>
            <p className="text-sm text-muted-foreground mt-1">{user.designation || "Member"}</p>
            <div className="mt-2 flex items-center justify-center md:justify-start gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>{user.role.charAt(0).toUpperCase() + user.role.slice(1).replace(/-/g, ' ')}</span>
            </div>
          </div>
        </div>
        <Separator className="my-0"/>
        <Tabs defaultValue="details" className="w-full">
           <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
            <TabsTrigger value="details" className="relative rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-4 font-semibold text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none">Details</TabsTrigger>
            <TabsTrigger value="attendance_history" className="relative rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-4 font-semibold text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none">Attendance ({!isLoadingHistory && !historyError ? attendanceHistory.length : '...'})</TabsTrigger>
            <TabsTrigger value="forms" className="relative rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-4 font-semibold text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none">Forms ({!isLoadingFormHistory && !formHistoryError ? formHistory.length : '...'})</TabsTrigger>
            <TabsTrigger value="login_history" className="relative rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-4 font-semibold text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none">Logins ({!isLoadingLoginHistory && !loginHistoryError ? loginHistory.length : '...'})</TabsTrigger>
          </TabsList>
          <TabsContent value="details">
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
                <div>
                  <h3 className="font-semibold text-foreground mb-3">Contact Information</h3>
                  <ul className="space-y-3 text-sm text-muted-foreground">
                    <li className="flex items-center gap-3"><Mail className="h-4 w-4 text-primary" /> {user.email || "No email provided"}</li>
                    <li className="flex items-center gap-3"><Phone className="h-4 w-4 text-primary" /> {user.phoneNumber || "Not Provided"}</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-3">Affiliations</h3>
                  <ul className="space-y-3 text-sm text-muted-foreground">
                    <li className="flex items-center gap-3"><Users className="h-4 w-4 text-primary" /> Team: {user.team || "N/A"}</li>
                    <li className="flex items-center gap-3"><MapPin className="h-4 w-4 text-primary" /> Mohallah: {getMohallahName(user.mohallahId)}</li>
                  </ul>
                </div>
                 <div className="md:col-span-2">
                    <h3 className="font-semibold text-foreground mb-3">Team Leadership</h3>
                    <ul className="space-y-3 text-sm text-muted-foreground">
                        <li className="flex items-center gap-3">
                            <UserCog className="h-4 w-4 text-primary" />
                            <span className="w-32 shrink-0">Group Leader:</span>
                            <span className="font-medium text-foreground">{teamLeaders.groupLeader?.name || 'N/A'}</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <UserCog className="h-4 w-4 text-primary" />
                            <span className="w-32 shrink-0">Asst. Group Leader:</span>
                            <span className="font-medium text-foreground">{teamLeaders.asstGroupLeader?.name || 'N/A'}</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <UserCog className="h-4 w-4 text-primary" />
                            <span className="w-32 shrink-0">Vice Captain:</span>
                             <span className="font-medium text-foreground">{teamLeaders.viceCaptain?.name || 'N/A'}</span>
                        </li>
                        <li className="flex items-center gap-3">
                           <UserCog className="h-4 w-4 text-primary" />
                            <span className="w-32 shrink-0">Captain:</span>
                             <span className="font-medium text-foreground">{teamLeaders.captain?.name || 'N/A'}</span>
                        </li>
                    </ul>
                </div>
              </div>
            </CardContent>
          </TabsContent>
          <TabsContent value="attendance_history">
            <CardContent className="p-6">
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-10">
                  <FunkyLoader>Loading attendance history...</FunkyLoader>
                </div>
              ) : historyError ? (
                 <div className="text-center py-10">
                  <CalendarClock className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-lg text-destructive">{historyError}</p>
                </div>
              ) : attendanceHistory.length > 0 ? (
                <>
                {/* Mobile Accordion View */}
                <div className="md:hidden">
                  <Accordion type="single" collapsible className="w-full">
                    {currentAttendanceData.map((record) => (
                      <AccordionItem value={record.id} key={record.id}>
                        <AccordionTrigger>
                          <div className="flex-grow text-left">
                            <div className="flex items-center gap-2">
                                <p className="font-semibold text-card-foreground">{record.miqaatName}</p>
                                <Badge variant={record.miqaatType === 'local' ? 'outline' : 'secondary'}>{record.miqaatType}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{format(new Date(record.markedAt), "PP")}</p>
                          </div>
                          <span className={cn("px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap",
                              record.status === 'present' || record.status === 'early' ? 'bg-green-100 text-green-800' :
                              record.status === 'absent' ? 'bg-red-100 text-red-800' :
                              record.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                              record.status === 'safar' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                          )}>
                              {record.status}
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-2 pt-2">
                          <div className="px-2 text-sm text-muted-foreground">
                            <p><strong>Marked At:</strong> {format(new Date(record.markedAt), "p")}</p>
                            <p><strong>Marked By:</strong> {record.markedByName || 'Self/System'}</p>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Miqaat Name</TableHead>
                        <TableHead>Date Marked</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Marked By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentAttendanceData.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium flex items-center gap-2">
                            {record.miqaatName}
                            <Badge variant={record.miqaatType === 'local' ? 'outline' : 'secondary'}>{record.miqaatType}</Badge>
                          </TableCell>
                          <TableCell>{format(new Date(record.markedAt), "PP p")}</TableCell>
                           <TableCell>
                                <span className={cn("px-2 py-0.5 text-xs font-semibold rounded-full",
                                    record.status === 'present' || record.status === 'early' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                    record.status === 'absent' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                    record.status === 'late' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                    record.status === 'safar' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                )}>
                                    {record.status ? record.status.charAt(0).toUpperCase() + record.status.slice(1) : 'Present'}
                                </span>
                           </TableCell>
                          <TableCell className="text-right">
                            {record.markedByName || "Self/System"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                 <CardFooter className="flex flex-col sm:flex-row justify-between items-center pt-4 gap-2">
                    <p className="text-xs text-muted-foreground">
                        Showing {currentAttendanceData.length > 0 ? ((attendancePage - 1) * ITEMS_PER_PAGE) + 1 : 0} - {Math.min(attendancePage * ITEMS_PER_PAGE, attendanceHistory.length)} of {attendanceHistory.length} records
                    </p>
                    {attendanceTotalPages > 1 && (
                    <div className="flex items-center space-x-2">
                        <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAttendancePage(prev => Math.max(prev - 1, 1))}
                        disabled={attendancePage === 1}
                        >
                        <ChevronLeft className="h-4 w-4" /> Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                        Page {attendancePage} of {attendanceTotalPages}
                        </span>
                        <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAttendancePage(prev => Math.min(prev + 1, attendanceTotalPages))}
                        disabled={attendancePage === attendanceTotalPages}
                        >
                        Next <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                    )}
                </CardFooter>
                </>
              ) : (
                <div className="text-center py-10">
                  <CalendarClock className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-lg text-muted-foreground">No attendance history found.</p>
                  <p className="text-sm text-muted-foreground">Your attendance records will appear here once you are marked present for Miqaats.</p>
                </div>
              )}
            </CardContent>
          </TabsContent>
           <TabsContent value="forms">
             <CardContent className="p-6">
                {isLoadingFormHistory ? (
                  <div className="flex items-center justify-center py-10">
                    <FunkyLoader>Loading form history...</FunkyLoader>
                  </div>
                ) : formHistoryError ? (
                  <div className="text-center py-10">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-4 text-lg text-destructive">{formHistoryError}</p>
                  </div>
                ) : formHistory.length > 0 ? (
                  <>
                  {/* Mobile Accordion View */}
                  <div className="md:hidden">
                    <Accordion type="single" collapsible className="w-full">
                      {currentFormsData.map((form) => (
                        <AccordionItem value={form.id} key={form.id}>
                          <AccordionTrigger>
                            <div className="flex-grow text-left">
                              <p className="font-semibold text-card-foreground">{form.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {form.submissionStatus === 'Filled' && form.submittedAt 
                                    ? `Filled: ${format(new Date(form.submittedAt), "PP")}`
                                    : `Created: ${format(new Date(form.createdAt), "PP")}`
                                }
                              </p>
                            </div>
                            <span className={cn("flex items-center gap-1.5 text-xs font-semibold", form.submissionStatus === 'Filled' ? 'text-green-600' : 'text-red-600')}>
                                {form.submissionStatus === 'Filled' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                {form.submissionStatus}
                            </span>
                          </AccordionTrigger>
                           <AccordionContent>
                           </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Form Title</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentFormsData.map((form) => (
                          <TableRow key={form.id}>
                            <TableCell className="font-medium">
                                {form.title}
                                <p className="text-xs text-muted-foreground line-clamp-1">{form.description}</p>
                            </TableCell>
                            <TableCell>
                                {form.submissionStatus === 'Filled' && form.submittedAt
                                ? `Filled: ${format(new Date(form.submittedAt), "PPp")}`
                                : `Created: ${format(new Date(form.createdAt), "PPp")}`
                                }
                            </TableCell>
                            <TableCell>
                               <span className={cn("flex items-center gap-1.5 px-2 py-1 text-xs font-semibold rounded-full w-fit", form.submissionStatus === 'Filled' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')}>
                                  {form.submissionStatus === 'Filled' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                  {form.submissionStatus}
                               </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                   <CardFooter className="flex flex-col sm:flex-row justify-between items-center pt-4 gap-2">
                        <p className="text-xs text-muted-foreground">
                            Showing {currentFormsData.length > 0 ? ((formsPage - 1) * ITEMS_PER_PAGE) + 1 : 0} - {Math.min(formsPage * ITEMS_PER_PAGE, formHistory.length)} of {formHistory.length} forms
                        </p>
                        {formsTotalPages > 1 && (
                        <div className="flex items-center space-x-2">
                            <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setFormsPage(prev => Math.max(prev - 1, 1))}
                            disabled={formsPage === 1}
                            >
                            <ChevronLeft className="h-4 w-4" /> Previous
                            </Button>
                            <span className="text-sm text-muted-foreground">
                            Page {formsPage} of {formsTotalPages}
                            </span>
                            <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setFormsPage(prev => Math.min(prev + 1, formsTotalPages))}
                            disabled={formsPage === formsTotalPages}
                            >
                            Next <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                        )}
                    </CardFooter>
                  </>
                ) : (
                  <div className="text-center py-10">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-4 text-lg text-muted-foreground">No Forms Found</p>
                    <p className="text-sm text-muted-foreground">Your assigned forms will appear here.</p>
                  </div>
                )}
             </CardContent>
           </TabsContent>
            <TabsContent value="login_history">
             <CardContent className="p-6">
                {isLoadingLoginHistory ? (
                  <div className="flex items-center justify-center py-10">
                    <FunkyLoader>Loading login history...</FunkyLoader>
                  </div>
                ) : loginHistoryError ? (
                  <div className="text-center py-10">
                    <Clock className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-4 text-lg text-destructive">{loginHistoryError}</p>
                  </div>
                ) : loginHistory.length > 0 ? (
                 <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Event</TableHead>
                          <TableHead className="text-right">Date & Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentLoginData.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="font-medium">{log.message}</TableCell>
                            <TableCell className="text-right">{format(new Date(log.timestamp), "PP p")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <CardFooter className="flex flex-col sm:flex-row justify-between items-center pt-4 gap-2">
                        <p className="text-xs text-muted-foreground">
                            Showing {currentLoginData.length > 0 ? ((loginPage - 1) * ITEMS_PER_PAGE) + 1 : 0} - {Math.min(loginPage * ITEMS_PER_PAGE, loginHistory.length)} of {loginHistory.length} logs
                        </p>
                        {loginTotalPages > 1 && (
                        <div className="flex items-center space-x-2">
                            <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLoginPage(prev => Math.max(prev - 1, 1))}
                            disabled={loginPage === 1}
                            >
                            <ChevronLeft className="h-4 w-4" /> Previous
                            </Button>
                            <span className="text-sm text-muted-foreground">
                            Page {loginPage} of {loginTotalPages}
                            </span>
                            <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLoginPage(prev => Math.min(prev + 1, loginTotalPages))}
                            disabled={loginPage === loginTotalPages}
                            >
                            Next <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                        )}
                    </CardFooter>
                 </>
                ) : (
                  <div className="text-center py-10">
                    <Clock className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-4 text-lg text-muted-foreground">No Login History</p>
                    <p className="text-sm text-muted-foreground">This user's login events will appear here.</p>
                  </div>
                )}
             </CardContent>
           </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
