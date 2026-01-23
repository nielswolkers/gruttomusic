import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserInviteSearchProps {
  invitees: string[];
  onInviteesChange: (invitees: string[]) => void;
}

interface Profile {
  user_id: string;
  username: string;
  full_name: string;
  display_name: string | null;
}

export function UserInviteSearch({ invitees, onInviteesChange }: UserInviteSearchProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("user_id, username, full_name, display_name")
          .or(`username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
          .neq("user_id", user?.id)
          .limit(5);

        if (error) throw error;
        
        // Filter out already invited users
        const filtered = (data || []).filter(
          (p) => !invitees.includes(p.user_id)
        );
        setSearchResults(filtered);
        setShowResults(true);
      } catch (error) {
        console.error("Failed to search users:", error);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, user?.id, invitees]);

  const addInvitee = (profile: Profile) => {
    onInviteesChange([...invitees, profile.user_id]);
    setSearchQuery("");
    setShowResults(false);
  };

  const removeInvitee = (userId: string) => {
    onInviteesChange(invitees.filter((id) => id !== userId));
  };

  const [inviteeProfiles, setInviteeProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    const loadInviteeProfiles = async () => {
      if (invitees.length === 0) {
        setInviteeProfiles([]);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, full_name, display_name")
        .in("user_id", invitees);

      setInviteeProfiles(data || []);
    };

    loadInviteeProfiles();
  }, [invitees]);

  return (
    <div className="space-y-2" ref={searchRef}>
      {/* Invited users */}
      {inviteeProfiles.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {inviteeProfiles.map((profile) => (
            <span
              key={profile.user_id}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs"
            >
              {profile.full_name || profile.username}
              <button
                onClick={() => removeInvitee(profile.user_id)}
                className="hover:bg-primary/20 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => searchResults.length > 0 && setShowResults(true)}
          className="h-9 text-sm pl-8"
          placeholder="Zoek gebruikersnaam..."
        />

        {/* Results dropdown */}
        {showResults && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg overflow-hidden">
            {loading ? (
              <div className="p-3 text-center text-sm text-muted-foreground">
                Zoeken...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-3 text-center text-sm text-muted-foreground">
                Geen gebruikers gevonden
              </div>
            ) : (
              searchResults.map((profile) => (
                <button
                  key={profile.user_id}
                  onClick={() => addInvitee(profile)}
                  className="w-full px-3 py-2 text-left hover:bg-muted transition-colors flex flex-col"
                >
                  <span className="font-medium text-sm">{profile.full_name}</span>
                  <span className="text-xs text-muted-foreground">@{profile.username}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}