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

interface FolderShareDialogProps {
  folderId: string;
  folderName: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
}

export const FolderShareDialog = ({ folderId, folderName, open, onClose, onSuccess }: FolderShareDialogProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Profile[]>([]);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSearchResults([]);
      setSelectedUsers([]);
    }
  }, [open]);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchUsers();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const searchUsers = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const currentUserId = session.session?.user.id;

      const query = searchQuery.toLowerCase();

      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .neq('id', currentUserId!)
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(10);

      if (error) throw error;

      setSearchResults(
        (data || []).filter(
          profile => !selectedUsers.some(u => u.id === profile.id)
        )
      );
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const addUser = (profile: Profile) => {
    setSelectedUsers(prev => [...prev, profile]);
    setSearchQuery("");
    setSearchResults([]);
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

      const { data: files, error: filesError } = await supabase
        .from('files')
        .select('id, filename')
        .eq('folder_id', folderId);

      if (filesError) throw filesError;

      const shareInserts: any[] = [];
      const notificationInserts: any[] = [];

      for (const user of selectedUsers) {
        for (const file of files || []) {
          shareInserts.push({
            file_id: file.id,
            shared_with_user_id: user.id,
            shared_by_user_id: currentUserId!,
          });

          notificationInserts.push({
            recipient_id: user.id,
            sender_id: currentUserId!,
            type: 'file_share',
            file_id: file.id,
            message: `heeft "${file.filename}" met je gedeeld (map: ${folderName})`,
          });
        }
      }

      if (shareInserts.length > 0) {
        const { error: shareError } = await supabase
          .from('file_shares')
          .insert(shareInserts);

        if (shareError) throw shareError;
      }

      if (notificationInserts.length > 0) {
        const { error: notifError } = await supabase
          .from('notifications')
          .insert(notificationInserts);

        if (notifError) console.error('Notification error:', notifError);
      }

      toast.success(`Map gedeeld met ${selectedUsers.length} gebruiker(s)`);
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Kon map niet delen');
      console.error(error);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Map delen</DialogTitle>
          <DialogDescription>
            Deel "{folderName}" met andere gebruikers. Alle bestanden in deze map worden gedeeld.
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
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <Button
              onClick={handleShare}
              disabled={isSharing || selectedUsers.length === 0}
            >
              <Share2 className="w-4 h-4 mr-2" />
              {isSharing ? 'Delen...' : 'Delen'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
