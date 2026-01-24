import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronLeft, User, Mail, Calendar } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

interface UserProfileData {
  user_id: string;
  username: string;
  full_name: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  banner_url: string | null;
  created_at: string;
}

export default function UserProfile() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (username) {
      loadProfile();
    }
  }, [username]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, username, full_name, display_name, avatar_url, bio, banner_url, created_at")
        .eq("username", username)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error("Failed to load profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="w-full text-center py-12">
        <User className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Gebruiker niet gevonden</h2>
        <p className="text-muted-foreground mb-4">@{username} bestaat niet</p>
        <Button variant="outline" onClick={() => navigate(-1)} className="rounded-full">
          Terug
        </Button>
      </div>
    );
  }

  const displayName = profile.display_name || profile.full_name;

  return (
    <div className="w-full">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => navigate(-1)}
        className="rounded-full mb-4"
      >
        <ChevronLeft className="w-5 h-5" />
      </Button>

      {/* Banner */}
      <div className="relative h-48 rounded-2xl overflow-hidden mb-16 bg-gradient-to-br from-primary/20 to-primary/5">
        {profile.banner_url && (
          <img
            src={profile.banner_url}
            alt="Banner"
            className="w-full h-full object-cover"
          />
        )}
        
        {/* Avatar overlapping banner */}
        <div className="absolute -bottom-12 left-8">
          <Avatar className="w-24 h-24 border-4 border-background shadow-lg">
            {profile.avatar_url ? (
              <AvatarImage src={profile.avatar_url} alt={displayName} />
            ) : null}
            <AvatarFallback className="text-2xl bg-primary/10 text-primary">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Profile Info */}
      <div className="px-2">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">{displayName}</h1>
            <p className="text-muted-foreground">@{profile.username}</p>
          </div>
          
          {user?.id === profile.user_id && (
            <Button
              variant="outline"
              onClick={() => navigate("/account")}
              className="rounded-full"
            >
              Bewerken
            </Button>
          )}
        </div>

        {profile.bio && (
          <p className="text-foreground mb-6 whitespace-pre-wrap">
            {profile.bio}
          </p>
        )}

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>
              Lid sinds {format(new Date(profile.created_at), "MMMM yyyy", { locale: nl })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
