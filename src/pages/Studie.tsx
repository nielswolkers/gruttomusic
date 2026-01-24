import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Users, X, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

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
}

interface Profile {
  user_id: string;
  username: string;
  full_name: string;
  display_name: string | null;
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

  useEffect(() => {
    if (user) {
      loadGroups();
    }
  }, [user]);

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
          // Don't throw here, group was created successfully
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

  if (!user) return null;

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
            <Card key={group.id} className="hover:shadow-md transition-shadow">
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
                      {group.members.slice(0, 5).map((member) => (
                        <span
                          key={member.id}
                          className={`text-xs px-2 py-1 rounded-full ${
                            member.status === "pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {member.profile?.display_name || member.profile?.full_name || "Onbekend"}
                          {member.status === "pending" && " (wachtend)"}
                        </span>
                      ))}
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
