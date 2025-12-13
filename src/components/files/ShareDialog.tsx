import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, Share2 } from "lucide-react";
import { toast } from "sonner";

interface ShareDialogProps {
  file: {
    id: string;
    filename: string;
  };
  open: boolean;
  onClose: () => void;
}

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
}

export const ShareDialog = ({ file, open, onClose }: ShareDialogProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Profile[]>([]);
  const [currentShares, setCurrentShares] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<Profile[]>([]);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (open) {
      loadCurrentShares();
      loadRecommendations();
    }
  }, [open, file.id]);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchUsers();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const loadCurrentShares = async () => {
    try {
      const { data, error } = await supabase
        .from('file_shares')
        .select('shared_with_user_id')
        .eq('file_id', file.id);

      if (error) throw error;
      setCurrentShares(data.map(s => s.shared_with_user_id));
    } catch (error: any) {
      console.error("Failed to load shares:", error);
    }
  };

  const loadRecommendations = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const currentUserId = session.session?.user.id;

      const { data, error } = await supabase
        .from('file_shares')
        .select('shared_with_user_id, shared_date')
        .eq('shared_by_user_id', currentUserId!)
        .order('shared_date', { ascending: false })
        .limit(20);

      if (error) throw error;

      const uniqueUserIds = [...new Set(data.map(s => s.shared_with_user_id))].slice(0, 3);

      if (uniqueUserIds.length === 0) {
        setRecommendations([]);
        return;
      }

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, username, display_name, full_name')
        .in('user_id', uniqueUserIds);

      if (profileError) throw profileError;

      const filtered = (profiles || []).filter(p => !currentShares.includes(p.user_id));
      setRecommendations(filtered.map(p => ({ id: p.user_id, username: p.username, display_name: p.display_name || p.full_name })));
    } catch (error: any) {
      console.error("Failed to load recommendations:", error);
    }
  };

  const searchUsers = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const currentUserId = session.session?.user.id;

      const query = searchQuery.toLowerCase();

      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, username, display_name, full_name')
        .neq('user_id', currentUserId!)
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%,full_name.ilike.%${query}%`)
        .limit(10);

      if (error) throw error;

      const filtered = (data || [])
        .filter(profile => !currentShares.includes(profile.user_id) && !selectedUsers.some(u => u.id === profile.user_id))
        .map(p => ({ id: p.user_id, username: p.username, display_name: p.display_name || p.full_name }));

      setSearchResults(filtered);
    } catch (error: any) {
      console.error("Search failed:", error);
    }
  };

  const addUser = (profile: Profile) => {
    setSelectedUsers(prev => [...prev, profile]);
    setSearchQuery("");
    setSearchResults([]);
    setRecommendations(prev => prev.filter(p => p.id !== profile.id));
  };

  const removeUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId));
  };

  const handleShare = async () => {
    if (selectedUsers.length === 0) return;

    setIsSharing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const currentUserId = session.session?.user.id;

      const shareInserts = selectedUsers.map(user => ({
        file_id: file.id,
        shared_with_user_id: user.id,
        shared_by_user_id: currentUserId!,
      }));

      const { error: shareError } = await supabase
        .from('file_shares')
        .insert(shareInserts);

      if (shareError) throw shareError;

      const notificationInserts = selectedUsers.map(user => ({
        recipient_id: user.id,
        sender_id: currentUserId!,
        type: 'file_share',
        file_id: file.id,
        message: `heeft "${file.filename}" met je gedeeld`,
      }));

      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notificationInserts);

      if (notifError) console.error("Notification error:", notifError);

      toast.success(`Bestand gedeeld met ${selectedUsers.length} gebruiker(s)`);
      onClose();
    } catch (error: any) {
      toast.error("Kon bestand niet delen");
      console.error(error);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bestand Delen</DialogTitle>
          <DialogDescription>
            Deel "{file.filename}" met andere gebruikers
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Zoek op naam of gebruikersnaam"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {recommendations.length > 0 && searchResults.length === 0 && searchQuery === "" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Laatst gedeeld met:</p>
              <div className="border rounded-lg">
                {recommendations.map(profile => (
                  <button
                    key={profile.id}
                    onClick={() => addUser(profile)}
                    className="w-full px-4 py-2 text-left hover:bg-accent transition-colors flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium">{profile.display_name || profile.username}</p>
                      <p className="text-sm text-muted-foreground">@{profile.username}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="border rounded-lg max-h-48 overflow-y-auto">
              {searchResults.map(profile => (
                <button
                  key={profile.id}
                  onClick={() => addUser(profile)}
                  className="w-full px-4 py-2 text-left hover:bg-accent transition-colors"
                >
                  <p className="font-medium">{profile.display_name || profile.username}</p>
                  <p className="text-sm text-muted-foreground">@{profile.username}</p>
                </button>
              ))}
            </div>
          )}

          {selectedUsers.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Geselecteerde gebruikers:</p>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map(user => (
                  <Badge key={user.id} variant="secondary" className="pl-3 pr-1">
                    {user.display_name || user.username}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 ml-1"
                      onClick={() => removeUser(user.id)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Annuleren
            </Button>
            <Button
              onClick={handleShare}
              disabled={selectedUsers.length === 0 || isSharing}
              className="flex-1"
            >
              <Share2 className="w-4 h-4 mr-2" />
              {isSharing ? "Delen..." : `Delen met ${selectedUsers.length}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
