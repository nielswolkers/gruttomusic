import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Users, X, UserPlus, Play, Pause, Clock, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format, startOfDay, endOfDay } from "date-fns";

interface StudyGroup {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  members?: GroupMember[];
}

interface GroupMember {
  id: string;
  user_id: string;
  status: string;
  profile?: {
    username: string;
    full_name: string;
    display_name: string | null;
  };
  isStudying?: boolean;
  todayStudyTime?: number;
}

interface Profile {
  user_id: string;
  username: string;
  full_name: string;
  display_name: string | null;
}

interface StudySession {
  id: string;
  user_id: string;
  started_at: string;
  is_active: boolean;
  duration_minutes?: number;
}

export default function Studie() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Selected group for detail view
  const [selectedGroup, setSelectedGroup] = useState<StudyGroup | null>(null);

  // Study timer state
  const [isStudying, setIsStudying] = useState(false);
  const [studyStartTime, setStudyStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [activeSessions, setActiveSessions] = useState<Map<string, StudySession>>(new Map());
  const [todayStudyTimes, setTodayStudyTimes] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (user) {
      loadGroups();
      checkActiveSession();
      loadActiveSessions();

      // Subscribe to study session changes
      const channel = supabase
        .channel('study-sessions-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'study_sessions',
          },
          () => {
            loadActiveSessions();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  // Timer update effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isStudying && studyStartTime) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - studyStartTime.getTime()) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isStudying, studyStartTime]);

  // Reload active sessions when groups change
  useEffect(() => {
    if (groups.length > 0) {
      loadActiveSessions();
    }
  }, [groups]);

  const checkActiveSession = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("study_sessions")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (data) {
      setIsStudying(true);
      setStudyStartTime(new Date(data.started_at));
      setCurrentSessionId(data.id);
      setElapsedTime(Math.floor((Date.now() - new Date(data.started_at).getTime()) / 1000));
    }
  };

  const loadActiveSessions = async () => {
    if (!user) return;

    // Get all group members' user IDs
    const groupMemberIds = new Set<string>();
    groups.forEach(group => {
      group.members?.forEach(member => {
        if (member.status === 'accepted') {
          groupMemberIds.add(member.user_id);
        }
      });
    });

    if (groupMemberIds.size === 0) return;

    const memberIdsArray = Array.from(groupMemberIds);

    // Load active sessions
    const { data: activeSess } = await supabase
      .from("study_sessions")
      .select("*")
      .in("user_id", memberIdsArray)
      .eq("is_active", true);

    const sessionsMap = new Map<string, StudySession>();
    activeSess?.forEach(session => {
      sessionsMap.set(session.user_id, session);
    });
    setActiveSessions(sessionsMap);

    // Load today's completed study time for each member
    const today = new Date();
    const dayStart = startOfDay(today).toISOString();
    const dayEnd = endOfDay(today).toISOString();

    const { data: todaySessions } = await supabase
      .from("study_sessions")
      .select("user_id, duration_minutes, started_at, is_active")
      .in("user_id", memberIdsArray)
      .gte("started_at", dayStart)
      .lte("started_at", dayEnd);

    const timesMap = new Map<string, number>();
    todaySessions?.forEach(session => {
      const current = timesMap.get(session.user_id) || 0;
      const duration = session.duration_minutes || 0;
      timesMap.set(session.user_id, current + duration);
    });
    setTodayStudyTimes(timesMap);
  };

  const startStudySession = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("study_sessions")
        .insert({
          user_id: user.id,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setIsStudying(true);
      setStudyStartTime(new Date(data.started_at));
      setCurrentSessionId(data.id);
      setElapsedTime(0);
      toast.success("Studiesessie gestart");
    } catch (error) {
      console.error("Failed to start session:", error);
      toast.error("Kon studiesessie niet starten");
    }
  };

  const stopStudySession = async () => {
    if (!user || !currentSessionId) return;

    try {
      const durationMinutes = Math.floor(elapsedTime / 60);

      await supabase
        .from("study_sessions")
        .update({
          is_active: false,
          ended_at: new Date().toISOString(),
          duration_minutes: durationMinutes,
        })
        .eq("id", currentSessionId);

      setIsStudying(false);
      setStudyStartTime(null);
      setCurrentSessionId(null);
      setElapsedTime(0);
      toast.success(`Studiesessie beëindigd (${formatTime(elapsedTime)})`);
    } catch (error) {
      console.error("Failed to stop session:", error);
      toast.error("Kon studiesessie niet stoppen");
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}u ${mins}m`;
    }
    return `${mins}m`;
  };

  const loadGroups = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Load groups where user is owner
      const { data: ownedGroups, error: ownedError } = await supabase
        .from("study_groups")
        .select("*")
        .eq("owner_id", user.id);

      if (ownedError) {
        console.error("Error loading owned groups:", ownedError);
      }

      // Load groups where user is accepted member
      const { data: memberGroups, error: memberError } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id)
        .eq("status", "accepted");

      if (memberError) {
        console.error("Error loading member groups:", memberError);
      }

      const memberGroupIds = memberGroups?.map(m => m.group_id) || [];
      
      let joinedGroups: StudyGroup[] = [];
      if (memberGroupIds.length > 0) {
        const { data } = await supabase
          .from("study_groups")
          .select("*")
          .in("id", memberGroupIds);
        joinedGroups = data || [];
      }

      // Combine and deduplicate
      const allGroups = [...(ownedGroups || []), ...joinedGroups];
      const uniqueGroups = allGroups.filter((group, index, self) => 
        index === self.findIndex(g => g.id === group.id)
      );

      // Load members for each group
      const groupsWithMembers: StudyGroup[] = [];
      for (const group of uniqueGroups) {
        const { data: members } = await supabase
          .from("group_members")
          .select("id, user_id, status")
          .eq("group_id", group.id);

        let enrichedMembers: GroupMember[] = [];
        if (members && members.length > 0) {
          const userIds = members.map(m => m.user_id);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, username, full_name, display_name")
            .in("user_id", userIds);

          enrichedMembers = members.map(m => ({
            ...m,
            profile: profiles?.find(p => p.user_id === m.user_id)
          }));
        }
        
        groupsWithMembers.push({
          ...group,
          members: enrichedMembers
        });
      }

      setGroups(groupsWithMembers);
    } catch (error) {
      console.error("Failed to load groups:", error);
      toast.error("Kon groepen niet laden");
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, username, full_name, display_name")
        .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
        .neq("user_id", user?.id)
        .limit(10);

      if (error) throw error;

      // Filter out already selected users
      const filtered = (data || []).filter(
        profile => !selectedUsers.some(u => u.user_id === profile.user_id)
      );
      setSearchResults(filtered);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const addUser = (profile: Profile) => {
    setSelectedUsers(prev => [...prev, profile]);
    setSearchResults(prev => prev.filter(p => p.user_id !== profile.user_id));
    setSearchQuery("");
  };

  const removeUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(u => u.user_id !== userId));
  };

  const createGroup = async () => {
    if (!user || !newGroupName.trim()) return;

    setIsCreating(true);
    try {
      // Create the group
      const { data: group, error: groupError } = await supabase
        .from("study_groups")
        .insert({
          name: newGroupName.trim(),
          owner_id: user.id,
        })
        .select()
        .single();

      if (groupError) {
        console.error("Group creation error:", groupError);
        throw groupError;
      }

      if (!group) {
        throw new Error("No group data returned");
      }

      // Add selected users as pending members and send notifications
      if (selectedUsers.length > 0) {
        // Insert group members
        const membersToInsert = selectedUsers.map(u => ({
          group_id: group.id,
          user_id: u.user_id,
          invited_by: user.id,
          status: "pending",
        }));

        const { error: membersError } = await supabase
          .from("group_members")
          .insert(membersToInsert);

        if (membersError) {
          console.error("Members insertion error:", membersError);
        }

        // Send notifications to invited users
        const notifications = selectedUsers.map(u => ({
          recipient_id: u.user_id,
          sender_id: user.id,
          type: "group_invite",
          message: `Je bent uitgenodigd voor de studiegroep "${newGroupName.trim()}"`,
        }));

        const { error: notifError } = await supabase.from("notifications").insert(notifications);
        if (notifError) {
          console.error("Notifications error:", notifError);
        }
      }

      toast.success("Groep aangemaakt!");
      setNewGroupName("");
      setSelectedUsers([]);
      setCreateDialogOpen(false);
      loadGroups();
    } catch (error: any) {
      console.error("Failed to create group:", error);
      toast.error(`Kon groep niet aanmaken: ${error.message || 'Onbekende fout'}`);
    } finally {
      setIsCreating(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (!user) return null;

  // Group detail view
  if (selectedGroup) {
    const acceptedMembers = selectedGroup.members?.filter(m => m.status === 'accepted') || [];
    const pendingMembers = selectedGroup.members?.filter(m => m.status === 'pending') || [];

    return (
      <div className="w-full">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedGroup(null)}
            className="rounded-full"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-4xl font-bold text-foreground">{selectedGroup.name}</h1>
            <p className="text-muted-foreground">
              {acceptedMembers.length + 1} leden
            </p>
          </div>
        </div>

        {/* Study Timer Card */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isStudying ? 'bg-primary/10' : 'bg-muted'}`}>
                  <Clock className={`w-8 h-8 ${isStudying ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Studietimer</h2>
                  <p className="text-muted-foreground">
                    {isStudying ? 'Je bent aan het studeren' : 'Start een studiesessie'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-4xl font-mono font-bold tabular-nums">
                    {formatTime(elapsedTime)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isStudying ? 'Huidige sessie' : 'Verstreken tijd'}
                  </p>
                </div>
                
                <Button
                  size="lg"
                  onClick={isStudying ? stopStudySession : startStudySession}
                  className={`rounded-full w-14 h-14 p-0 ${isStudying ? 'bg-destructive hover:bg-destructive/90' : ''}`}
                >
                  {isStudying ? (
                    <Pause className="w-6 h-6" />
                  ) : (
                    <Play className="w-6 h-6 ml-1" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Group Members */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Groepsleden</h2>
          
          {/* Owner */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Avatar className="w-12 h-12">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    JIJ
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`font-medium ${isStudying ? 'text-green-600' : ''}`}>
                      Jij (Beheerder)
                    </p>
                    {isStudying && (
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    )}
                  </div>
                  {isStudying && (
                    <p className="text-sm text-green-600">
                      Aan het studeren • {formatTime(elapsedTime)} vandaag
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Accepted Members */}
          {acceptedMembers.map((member) => {
            const memberIsStudying = activeSessions.has(member.user_id);
            const activeSession = activeSessions.get(member.user_id);
            const todayTime = todayStudyTimes.get(member.user_id) || 0;
            const currentSessionTime = activeSession 
              ? Math.floor((Date.now() - new Date(activeSession.started_at).getTime()) / 60000)
              : 0;
            const totalTodayMinutes = todayTime + currentSessionTime;
            const displayName = member.profile?.display_name || member.profile?.full_name || "Onbekend";

            return (
              <Card key={member.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className={`font-semibold ${memberIsStudying ? 'bg-green-100 text-green-700' : 'bg-muted'}`}>
                        {getInitials(displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium ${memberIsStudying ? 'text-green-600' : ''}`}>
                          {displayName}
                        </p>
                        {memberIsStudying && (
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">@{member.profile?.username}</p>
                      {memberIsStudying && (
                        <p className="text-sm text-green-600 mt-1">
                          Aan het studeren • {formatMinutes(totalTodayMinutes)} vandaag
                        </p>
                      )}
                      {!memberIsStudying && totalTodayMinutes > 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatMinutes(totalTodayMinutes)} gestudeerd vandaag
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Pending Members */}
          {pendingMembers.length > 0 && (
            <>
              <h3 className="text-lg font-medium text-muted-foreground mt-6">Uitgenodigd</h3>
              {pendingMembers.map((member) => {
                const displayName = member.profile?.display_name || member.profile?.full_name || "Onbekend";
                return (
                  <Card key={member.id} className="opacity-60">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="w-12 h-12">
                          <AvatarFallback className="bg-yellow-100 text-yellow-700 font-semibold">
                            {getInitials(displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium">{displayName}</p>
                          <p className="text-sm text-yellow-600">Wacht op reactie</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold text-foreground">Studie</h1>
        
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full gap-2">
              <Plus className="w-4 h-4" />
              Nieuwe groep
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nieuwe studiegroep</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Groepsnaam</Label>
                <Input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Bijv. Wiskunde studiegroep"
                />
              </div>

              <div className="space-y-2">
                <Label>Leden uitnodigen</Label>
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Zoek op gebruikersnaam of naam..."
                />
                
                {/* Search Results */}
                {searchResults.length > 0 && (
                  <ScrollArea className="max-h-32 border rounded-lg">
                    <div className="p-2 space-y-1">
                      {searchResults.map((profile) => (
                        <button
                          key={profile.user_id}
                          onClick={() => addUser(profile)}
                          className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted text-left"
                        >
                          <UserPlus className="w-4 h-4 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">
                              {profile.display_name || profile.full_name}
                            </p>
                            <p className="text-xs text-muted-foreground">@{profile.username}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}

                {/* Selected Users */}
                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {selectedUsers.map((profile) => (
                      <div
                        key={profile.user_id}
                        className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-sm"
                      >
                        <span>{profile.display_name || profile.full_name}</span>
                        <button
                          onClick={() => removeUser(profile.user_id)}
                          className="p-0.5 rounded-full hover:bg-primary/20"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setCreateDialogOpen(false);
                    setNewGroupName("");
                    setSelectedUsers([]);
                  }}
                >
                  Annuleren
                </Button>
                <Button
                  className="flex-1"
                  onClick={createGroup}
                  disabled={!newGroupName.trim() || isCreating}
                >
                  {isCreating ? "Aanmaken..." : "Aanmaken"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Study Timer Card */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isStudying ? 'bg-primary/10' : 'bg-muted'}`}>
                <Clock className={`w-8 h-8 ${isStudying ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Studietimer</h2>
                <p className="text-muted-foreground">
                  {isStudying ? 'Je bent aan het studeren' : 'Start een studiesessie'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-4xl font-mono font-bold tabular-nums">
                  {formatTime(elapsedTime)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isStudying ? 'Huidige sessie' : 'Verstreken tijd'}
                </p>
              </div>
              
              <Button
                size="lg"
                onClick={isStudying ? stopStudySession : startStudySession}
                className={`rounded-full w-14 h-14 p-0 ${isStudying ? 'bg-destructive hover:bg-destructive/90' : ''}`}
              >
                {isStudying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6 ml-1" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">Nog geen studiegroepen</p>
          <Button onClick={() => setCreateDialogOpen(true)} className="rounded-full gap-2">
            <Plus className="w-4 h-4" />
            Maak je eerste groep
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <Card 
              key={group.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedGroup(group)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{group.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {(group.members?.filter(m => m.status === "accepted").length || 0) + 1} leden
                      </p>
                    </div>
                  </div>
                  {group.owner_id === user.id && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                      Beheerder
                    </span>
                  )}
                </div>

                {group.members && group.members.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Leden</p>
                    <div className="flex flex-wrap gap-1">
                      {group.members.slice(0, 5).map((member) => {
                        const memberIsStudying = activeSessions.has(member.user_id);
                        return (
                          <span
                            key={member.id}
                            className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                              member.status === "pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : memberIsStudying
                                ? "bg-green-100 text-green-800"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {memberIsStudying && (
                              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            )}
                            {member.profile?.display_name || member.profile?.full_name || "Onbekend"}
                            {member.status === "pending" && " (wachtend)"}
                          </span>
                        );
                      })}
                      {group.members.length > 5 && (
                        <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                          +{group.members.length - 5} meer
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
