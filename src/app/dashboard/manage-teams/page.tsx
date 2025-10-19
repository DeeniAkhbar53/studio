
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { User, UserRole, UserDesignation } from '@/types';
import { getUsers, updateUser } from '@/lib/firebase/userService';
import { createTeam, renameTeam, deleteTeam } from '@/lib/firebase/teamService';
import { Plus, Trash2, Edit, Loader2, Users as UsersIcon, ShieldAlert, GripVertical, UserPlus, Move } from 'lucide-react';
import { FunkyLoader } from '@/components/ui/funky-loader';
import { allNavItems } from '@/components/dashboard/sidebar-nav';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';


const MemberCard: React.FC<{ member: User; onMoveMember: (memberId: string, newTeam: string | null) => void; teams: string[] }> = ({ member, onMoveMember, teams }) => {
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [targetTeam, setTargetTeam] = useState<string | null>(null);

  const handleMoveConfirm = () => {
    onMoveMember(member.id, targetTeam);
    setIsMoveDialogOpen(false);
  };
  
  return (
    <>
      <Card className="p-3 mb-2 flex justify-between items-center bg-card shadow-sm hover:shadow-md transition-shadow duration-200">
        <div>
          <p className="font-semibold text-sm">{member.name}</p>
          <p className="text-xs text-muted-foreground">{member.itsId}</p>
        </div>
        <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0">
              <Move className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Move {member.name}</DialogTitle>
              <DialogDescription>Select the new team for this member.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Select onValueChange={setTargetTeam} defaultValue={member.team || "unassigned"}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {teams.map(team => (
                    <SelectItem key={team} value={team}>{team}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsMoveDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleMoveConfirm} disabled={!targetTeam}>Confirm Move</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    </>
  );
};


export default function ManageTeamsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");

  const [isRenameTeamOpen, setIsRenameTeamOpen] = useState(false);
  const [teamToRename, setTeamToRename] = useState<string | null>(null);
  const [renamedTeamName, setRenamedTeamName] = useState("");
  

  useEffect(() => {
    const role = localStorage.getItem('userRole') as UserRole | null;
    const designation = localStorage.getItem('userDesignation') as UserDesignation | null;

    const navItem = allNavItems.find(item => item.href === '/dashboard/manage-teams');
    const hasRoleAccess = navItem?.allowedRoles?.includes(role || 'user');
    const hasDesignationAccess = designation === 'Captain';
    
    if (hasRoleAccess || hasDesignationAccess) {
      setIsAuthorized(true);
    } else {
      setIsAuthorized(false);
      setTimeout(() => router.replace('/dashboard'), 2000);
    }
  }, [router]);

  useEffect(() => {
    if (!isAuthorized) {
        setIsLoading(false);
        return;
    }
    const fetchUserData = async () => {
        setIsLoading(true);
        try {
            const allUsers = await getUsers();
            setUsers(allUsers);
            const itsId = localStorage.getItem('userItsId');
            if (itsId) {
                const currentUserData = allUsers.find(u => u.itsId === itsId);
                setCurrentUser(currentUserData || null);
            }
        } catch (error) {
            console.error("Failed to fetch users:", error);
            toast({ title: "Error", description: "Could not load user data.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };
    fetchUserData();
  }, [isAuthorized, toast]);

  const { teams, unassignedMembers } = useMemo(() => {
    const teamMap: { [key: string]: User[] } = {};
    const unassigned: User[] = [];
    
    // Filter users based on current user's mohallah if they are not superadmin
    const visibleUsers = (currentUser?.role === 'superadmin')
      ? users
      : users.filter(u => u.mohallahId === currentUser?.mohallahId);

    visibleUsers.forEach(user => {
      if (user.team) {
        if (!teamMap[user.team]) {
          teamMap[user.team] = [];
        }
        teamMap[user.team].push(user);
      } else {
        unassigned.push(user);
      }
    });
    return { teams: teamMap, unassignedMembers: unassigned };
  }, [users, currentUser]);
  
  const teamNames = Object.keys(teams).sort();

  const handleCreateTeam = async () => {
    if (!newTeamName.trim() || !currentUser?.mohallahId) {
      toast({ title: "Invalid Name", description: "Please provide a valid team name.", variant: "destructive" });
      return;
    }
    if (teamNames.includes(newTeamName.trim())) {
        toast({ title: "Duplicate Name", description: "A team with this name already exists.", variant: "destructive" });
        return;
    }
    try {
        await createTeam(newTeamName.trim(), currentUser.mohallahId);
        toast({ title: "Team Created", description: `Team "${newTeamName.trim()}" has been added.` });
        setIsCreateTeamOpen(false);
        setNewTeamName("");
    } catch (error) {
        console.error("Error creating team:", error);
        toast({ title: "Error", description: "Could not create team.", variant: "destructive" });
    }
  };

  const handleRenameTeam = async () => {
    if (!teamToRename || !renamedTeamName.trim() || !currentUser?.mohallahId) return;
     if (teamNames.includes(renamedTeamName.trim())) {
        toast({ title: "Duplicate Name", description: "A team with this name already exists.", variant: "destructive" });
        return;
    }
    try {
        await renameTeam(teamToRename, renamedTeamName.trim(), currentUser.mohallahId);
        // Refetch users to update UI
        const updatedUsers = await getUsers();
        setUsers(updatedUsers);
        toast({ title: "Team Renamed", description: `Team "${teamToRename}" is now "${renamedTeamName.trim()}".` });
        setIsRenameTeamOpen(false);
        setTeamToRename(null);
    } catch (error) {
        console.error("Error renaming team:", error);
        toast({ title: "Error", description: "Could not rename team.", variant: "destructive" });
    }
  };
  
  const handleDeleteTeam = async (teamName: string) => {
    if(!currentUser?.mohallahId) return;
    if (teams[teamName] && teams[teamName].length > 0) {
      toast({ title: "Cannot Delete", description: "Team must be empty before it can be deleted.", variant: "destructive" });
      return;
    }
    try {
        await deleteTeam(teamName, currentUser.mohallahId);
        // This is a bit of a hack, but it forces a re-render. A better way would be a state management library.
        // A dummy user update will trigger re-fetch in real scenario, but here we manually update.
        setUsers(prev => [...prev]);
        toast({ title: "Team Deleted", description: `Team "${teamName}" has been deleted.` });
    } catch (error) {
        console.error("Error deleting team:", error);
        toast({ title: "Error", description: "Could not delete team.", variant: "destructive" });
    }
  };

  const handleMoveMember = async (memberId: string, newTeam: string | null) => {
    const member = users.find(u => u.id === memberId);
    if (!member || !member.mohallahId) return;

    try {
        const payload = { team: newTeam === "unassigned" ? "" : newTeam };
        await updateUser(memberId, member.mohallahId, payload);
        
        // Optimistically update UI
        setUsers(prevUsers => prevUsers.map(u => u.id === memberId ? { ...u, team: newTeam === "unassigned" ? undefined : newTeam } : u));
        
        toast({ title: "Member Moved", description: `${member.name} has been moved to ${newTeam === "unassigned" ? "Unassigned" : newTeam}.`});
    } catch (error) {
        console.error("Error moving member:", error);
        toast({ title: "Error", description: "Could not move member.", variant: "destructive" });
    }
  };

  if (isAuthorized === null || isLoading) {
    return <div className="flex h-full w-full items-center justify-center"><FunkyLoader size="lg">Loading Team Data...</FunkyLoader></div>;
  }
  
  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
        <p className="text-muted-foreground mt-2">You do not have permission to view this page.</p>
        <p className="text-sm text-muted-foreground mt-1">Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
      <div className="space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center"><UsersIcon className="mr-2 h-5 w-5 text-primary" />Manage Teams</CardTitle>
                <CardDescription className="mt-1">Create, rename, and organize members into teams.</CardDescription>
              </div>
              <Dialog open={isCreateTeamOpen} onOpenChange={setIsCreateTeamOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><UserPlus className="mr-2 h-4 w-4" />Create New Team</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Team</DialogTitle>
                    <DialogDescription>Enter a name for the new team.</DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Input placeholder="Team Name" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateTeamOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateTeam} disabled={!newTeamName.trim()}>Create</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
        </Card>
        
        <Accordion type="single" collapsible className="w-full space-y-4" defaultValue="unassigned">
            <Card>
                 <AccordionItem value="unassigned" className="border-b-0">
                    <AccordionTrigger className="p-4 hover:no-underline">
                        <CardTitle className="text-base">Unassigned ({unassignedMembers.length})</CardTitle>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                        <ScrollArea className="h-96 pr-3">
                        {unassignedMembers.map(member => (
                            <MemberCard key={member.id} member={member} onMoveMember={handleMoveMember} teams={teamNames} />
                        ))}
                        </ScrollArea>
                    </AccordionContent>
                </AccordionItem>
            </Card>

            {teamNames.map(teamName => (
                 <Card key={teamName}>
                    <AccordionItem value={teamName} className="border-b-0">
                        <AccordionTrigger className="p-4 hover:no-underline">
                             <div className="flex items-center justify-between w-full pr-2">
                                <CardTitle className="text-base">{teamName} ({teams[teamName].length})</CardTitle>
                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    <Dialog open={isRenameTeamOpen && teamToRename === teamName} onOpenChange={(isOpen) => {
                                        if (!isOpen) setTeamToRename(null);
                                        setIsRenameTeamOpen(isOpen);
                                    }}>
                                        <DialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => {
                                                e.stopPropagation();
                                                setTeamToRename(teamName);
                                                setRenamedTeamName(teamName);
                                                setIsRenameTeamOpen(true);
                                            }}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Rename Team</DialogTitle>
                                            </DialogHeader>
                                            <Input value={renamedTeamName} onChange={(e) => setRenamedTeamName(e.target.value)} />
                                            <DialogFooter>
                                                <Button variant="outline" onClick={() => setIsRenameTeamOpen(false)}>Cancel</Button>
                                                <Button onClick={handleRenameTeam}>Save</Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                    <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => e.stopPropagation()}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will delete the team "{teamName}". This action is only possible if the team has no members.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDeleteTeam(teamName)}>Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                            <ScrollArea className="h-96 pr-3">
                                {teams[teamName].map(member => (
                                    <MemberCard key={member.id} member={member} onMoveMember={handleMoveMember} teams={teamNames} />
                                ))}
                            </ScrollArea>
                        </AccordionContent>
                    </AccordionItem>
                </Card>
            ))}
        </Accordion>
      </div>
  );
}
