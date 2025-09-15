

"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AttendanceRecord, User, Mohallah, Miqaat, UserDesignation, FormResponse, Form } from "@/types";
import { Edit3, Mail, Phone, ShieldCheck, Users, MapPin, Loader2, CalendarClock, UserCog, FileText, Check, X } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { getUserByItsOrBgkId, getUsers } from "@/lib/firebase/userService";
import { getMohallahs } from "@/lib/firebase/mohallahService";
import { getMiqaats } from "@/lib/firebase/miqaatService";
import { getFormResponsesForUser, getForms } from "@/lib/firebase/formService";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import type { Unsubscribe } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const GROUP_LEADER_DESIGNATION: UserDesignation = "Group Leader";
const ASST_GROUP_LEADER_DESIGNATION: UserDesignation = "Asst.Grp Leader";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [mohallahs, setMohallahs] = useState<Mohallah[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [formHistory, setFormHistory] = useState<FormResponse[]>([]);
  const [allForms, setAllForms] = useState<Form[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  
  const [isLoadingFormHistory, setIsLoadingFormHistory] = useState(false);
  const [formHistoryError, setFormHistoryError] = useState<string | null>(null);

  const router = useRouter();

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
        const [fetchedUser, allSystemUsers, fetchedForms] = await Promise.all([
          getUserByItsOrBgkId(storedItsId),
          getUsers(),
          getForms(), // Fetch all forms to map response data later
        ]);

        if (!isMounted) return;
        setUser(fetchedUser);
        setAllUsers(allSystemUsers);
        setAllForms(fetchedForms);

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
                
                const attendedRecords: AttendanceRecord[] = [];
                const attendedMiqaatIds = new Set<string>();

                allMiqaats.forEach(miqaat => {
                    const regularEntry = miqaat.attendance?.find(a => a.userItsId === fetchedUser.itsId);
                    if (regularEntry) {
                        attendedRecords.push({
                            id: `${miqaat.id}-${regularEntry.userItsId}`,
                            miqaatId: miqaat.id,
                            miqaatName: miqaat.name,
                            userItsId: regularEntry.userItsId,
                            userName: regularEntry.userName,
                            markedAt: regularEntry.markedAt,
                            markedByItsId: regularEntry.markedByItsId,
                            status: regularEntry.status || 'present',
                            uniformCompliance: regularEntry.uniformCompliance,
                        });
                        attendedMiqaatIds.add(miqaat.id);
                    }

                    const safarEntry = miqaat.safarList?.find(s => s.userItsId === fetchedUser.itsId);
                    if (safarEntry) {
                         attendedRecords.push({
                            id: `safar-${miqaat.id}-${safarEntry.userItsId}`,
                            miqaatId: miqaat.id,
                            miqaatName: miqaat.name,
                            userItsId: safarEntry.userItsId,
                            userName: safarEntry.userName,
                            markedAt: safarEntry.markedAt,
                            markedByItsId: safarEntry.markedByItsId,
                            status: 'safar',
                        });
                        attendedMiqaatIds.add(miqaat.id);
                    }
                });

                const eligibleMiqaats = allMiqaats.filter(miqaat => {
                    const now = new Date();
                    const miqaatEndTime = new Date(miqaat.endTime);
                    if (now < miqaatEndTime) return false;

                    const isForEveryone = (!miqaat.mohallahIds || miqaat.mohallahIds.length === 0) && (!miqaat.teams || miqaat.teams.length === 0);
                    const isInMohallah = fetchedUser.mohallahId && miqaat.mohallahIds?.includes(fetchedUser.mohallahId);
                    const isInTeam = fetchedUser.team && miqaat.teams?.includes(fetchedUser.team);
                    return isForEveryone || isInMohallah || isInTeam;
                });

                const absentRecords = eligibleMiqaats
                    .filter(miqaat => !attendedMiqaatIds.has(miqaat.id))
                    .map(miqaat => ({
                        id: `absent-${miqaat.id}-${fetchedUser.itsId}`,
                        miqaatId: miqaat.id,
                        miqaatName: miqaat.name,
                        userItsId: fetchedUser.itsId,
                        userName: fetchedUser.name,
                        markedAt: miqaat.startTime,
                        status: 'absent' as const,
                    }));

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
            const responses = await getFormResponsesForUser(fetchedUser.itsId);
            if (isMounted) {
              setFormHistory(responses.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()));
            }
          } catch(formError: any) {
             console.error("Failed to fetch form history:", formError);
             if (formError instanceof Error && formError.message.includes("index")) {
                setFormHistoryError("Could not load form submission history. A database index is required. Please contact support.");
             } else {
                setFormHistoryError("Could not load form submission history.");
             }
          } finally {
            if (isMounted) setIsLoadingFormHistory(false);
          }

        } else {
            if (isMounted) {
              setIsLoadingHistory(false);
              setIsLoadingFormHistory(false);
            }
        }
      } catch (error) {
        console.error("Failed to fetch profile data:", error);
        if (isMounted) {
            setUser(null);
            setHistoryError("Could not load user profile.");
            setFormHistoryError("Could not load user profile.");
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
  
  const getFormTitle = (formId: string): string => {
    const form = allForms.find(f => f.id === formId);
    return form ? form.title : "Unknown Form";
  };

  if (isLoading && !user) {
    return (
      <div className="flex items-center justify-center h-full py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading profile...</p>
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
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-1">
              <h3 className="text-2xl font-bold text-foreground">{user.name}</h3>
              <Button variant="outline" size="sm" className="self-center md:self-auto md:ml-4 mt-4 md:mt-0" disabled>
                <Edit3 className="mr-2 h-4 w-4" />
                Edit Profile (Soon)
              </Button>
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
          <TabsList className="grid w-full grid-cols-1 md:grid-cols-3 rounded-none border-b">
            <TabsTrigger value="details">Profile Details</TabsTrigger>
            <TabsTrigger value="attendance_history">Attendance ({!isLoadingHistory && !historyError ? attendanceHistory.length : '...'})</TabsTrigger>
            <TabsTrigger value="form_history">Forms ({!isLoadingFormHistory && !formHistoryError ? formHistory.length : '...'})</TabsTrigger>
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
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="ml-2 text-muted-foreground">Loading attendance history...</p>
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
                    {attendanceHistory.map((record) => (
                      <AccordionItem value={record.id} key={record.id}>
                        <AccordionTrigger>
                          <div className="flex-grow text-left">
                            <p className="font-semibold text-card-foreground">{record.miqaatName}</p>
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
                            <p><strong>Marked By:</strong> {record.markedByItsId || 'N/A'}</p>
                            {record.uniformCompliance && (
                              <>
                                <p><strong>Feta/Paghri:</strong> {record.uniformCompliance.fetaPaghri}</p>
                                <p><strong>Koti:</strong> {record.uniformCompliance.koti}</p>
                              </>
                            )}
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
                        <TableHead className="text-right">Marked By (ITS)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceHistory.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">{record.miqaatName}</TableCell>
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
                            {record.markedByItsId || "Self/System"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
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
           <TabsContent value="form_history">
             <CardContent className="p-6">
                {isLoadingFormHistory ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <p className="ml-2 text-muted-foreground">Loading form history...</p>
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
                      {formHistory.map((response) => (
                        <AccordionItem value={response.id} key={response.id}>
                          <AccordionTrigger>
                            <div className="flex-grow text-left">
                              <p className="font-semibold text-card-foreground">{getFormTitle(response.formId)}</p>
                              <p className="text-xs text-muted-foreground">{format(new Date(response.submittedAt), "PPp")}</p>
                            </div>
                             <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/forms/${response.formId}`); }}>View</Button>
                          </AccordionTrigger>
                           <AccordionContent className="space-y-2 pt-2">
                             <div className="px-2 text-sm text-muted-foreground">
                                <p><strong>Form ID:</strong> {response.formId}</p>
                                <p><strong>Response ID:</strong> {response.id}</p>
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
                          <TableHead>Form Title</TableHead>
                          <TableHead>Date Submitted</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {formHistory.map((response) => (
                          <TableRow key={response.id}>
                            <TableCell className="font-medium">{getFormTitle(response.formId)}</TableCell>
                            <TableCell>{format(new Date(response.submittedAt), "PP p")}</TableCell>
                            <TableCell className="text-right">
                               <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/forms/${response.formId}`)}>View Submission</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  </>
                ) : (
                  <div className="text-center py-10">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-4 text-lg text-muted-foreground">No forms found.</p>
                    <p className="text-sm text-muted-foreground">Your submitted forms will appear here.</p>
                  </div>
                )}
             </CardContent>
           </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
