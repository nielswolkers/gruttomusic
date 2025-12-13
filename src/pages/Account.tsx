import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { User, Mail, LogOut, Trash2 } from "lucide-react";
import { getStoredAccessToken, logout as spotifyLogout, refreshAccessToken } from "@/auth/spotifyAuth";
import { getUserProfile } from "@/api/spotifyApi";

const Account = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string; username: string; display_name: string | null } | null>(null);
  const [formData, setFormData] = useState({ full_name: "", username: "" });
  
  // Spotify state
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyUser, setSpotifyUser] = useState<any>(null);

  useEffect(() => {
    if (user) {
      loadProfile();
      checkSpotifyConnection();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
      if (error) throw error;
      setProfile(data);
      setFormData({ full_name: data.full_name || "", username: data.username || "" });
    } catch (error) {
      console.error("Failed to load profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkSpotifyConnection = async () => {
    if (!user) return;
    
    let token = getStoredAccessToken();
    
    if (token) {
      try {
        const spotifyProfile = await getUserProfile(token);
        setSpotifyUser(spotifyProfile);
        setSpotifyConnected(true);
        return;
      } catch (error) {
        console.error('Failed to fetch Spotify profile:', error);
      }
    }

    // Check database for saved connection
    const { data: spotifyConnection } = await supabase
      .from('spotify_connections')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (spotifyConnection?.spotify_refresh_token) {
      try {
        localStorage.setItem('refresh_token', spotifyConnection.spotify_refresh_token);
        const newToken = await refreshAccessToken();
        
        if (newToken) {
          const spotifyProfile = await getUserProfile(newToken);
          setSpotifyUser(spotifyProfile);
          setSpotifyConnected(true);
          
          await supabase
            .from('spotify_connections')
            .update({ spotify_token: newToken, updated_at: new Date().toISOString() })
            .eq('user_id', user.id);
        }
      } catch (refreshError) {
        console.error('Failed to refresh token:', refreshError);
        setSpotifyUser({
          display_name: spotifyConnection.spotify_display_name,
          email: spotifyConnection.spotify_email,
        });
        setSpotifyConnected(false);
      }
    }
  };

  const handleSave = async () => {
    if (!user || !formData.username.trim() || !formData.full_name.trim()) {
      toast.error("Vul alle verplichte velden in");
      return;
    }

    setSaving(true);
    try {
      const { data: existingUser } = await supabase.from('profiles').select('user_id').eq('username', formData.username).neq('user_id', user.id).maybeSingle();
      if (existingUser) {
        toast.error("Deze gebruikersnaam is al in gebruik");
        setSaving(false);
        return;
      }

      const { error } = await supabase.from('profiles').update({
        full_name: formData.full_name.trim(),
        username: formData.username.trim(),
      }).eq('user_id', user.id);

      if (error) throw error;
      toast.success("Profiel bijgewerkt");
      setIsEditing(false);
      loadProfile();
    } catch (error) {
      toast.error("Kon profiel niet bijwerken");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleSpotifyDisconnect = async () => {
    if (!user) return;
    
    await supabase.from('spotify_connections').delete().eq('user_id', user.id);
    spotifyLogout();
    setSpotifyConnected(false);
    setSpotifyUser(null);
    toast.success("Spotify ontkoppeld");
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      // Delete user's files from storage and database
      const { data: userFiles } = await supabase.from('files').select('storage_url').eq('owner_id', user.id);
      if (userFiles && userFiles.length > 0) {
        await supabase.storage.from('user-files').remove(userFiles.map(f => f.storage_url));
        await supabase.from('files').delete().eq('owner_id', user.id);
      }

      // Delete folders, notifications, file shares, spotify connection, profile
      await supabase.from('folders').delete().eq('owner_id', user.id);
      await supabase.from('notifications').delete().eq('recipient_id', user.id);
      await supabase.from('file_shares').delete().eq('shared_by_user_id', user.id);
      await supabase.from('spotify_connections').delete().eq('user_id', user.id);
      await supabase.from('profiles').delete().eq('user_id', user.id);

      await signOut();
      toast.success("Account verwijderd");
      navigate("/auth");
    } catch (error) {
      console.error("Delete account error:", error);
      toast.error("Kon account niet verwijderen");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="w-full max-w-2xl space-y-6">
      <h1 className="text-4xl font-bold text-foreground">Account</h1>

      {/* Profile Card */}
      <Card className="rounded-2xl border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold">Profiel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isEditing ? (
            <>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Naam</p>
                  <p className="font-medium">{profile?.full_name}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">E-mail</p>
                  <p className="font-medium">{user?.email}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-medium">@</span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gebruikersnaam</p>
                  <p className="font-medium">@{profile?.username}</p>
                </div>
              </div>

              <Button variant="outline" onClick={() => setIsEditing(true)} className="rounded-full">
                Bewerken
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="full_name">Volledige naam</Label>
                <Input 
                  id="full_name" 
                  value={formData.full_name} 
                  onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))} 
                  placeholder="Jan de Vries" 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Gebruikersnaam</Label>
                <Input 
                  id="username" 
                  value={formData.username} 
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/\s/g, '') }))} 
                  placeholder="jandevries" 
                />
                <p className="text-xs text-muted-foreground">Anderen kunnen je vinden met deze gebruikersnaam</p>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving} className="rounded-full">
                  {saving ? "Opslaan..." : "Opslaan"}
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)} className="rounded-full">
                  Annuleren
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Integrations Card */}
      <Card className="rounded-2xl border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold">Integraties</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#1DB954]/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#1DB954]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
              </div>
              <div>
                <p className="font-medium">Spotify</p>
                <p className="text-sm text-muted-foreground">
                  {spotifyConnected ? spotifyUser?.display_name || 'Verbonden' : 'Niet verbonden'}
                </p>
              </div>
            </div>
            
            {spotifyConnected ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-primary">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="text-sm">Actief</span>
                </div>
                <Button variant="outline" size="sm" onClick={handleSpotifyDisconnect} className="rounded-full">
                  Ontkoppelen
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => navigate('/instellingen')} className="rounded-full">
                Verbinden
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Account Actions Card */}
      <Card className="rounded-2xl border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold">Acties</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" onClick={handleSignOut} className="w-full justify-start rounded-xl h-12">
            <LogOut className="w-4 h-4 mr-3" />
            Uitloggen
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full justify-start rounded-xl h-12 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10">
                <Trash2 className="w-4 h-4 mr-3" />
                Account verwijderen
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
                <AlertDialogDescription>
                  Dit verwijdert je account permanent, inclusief al je bestanden, mappen en instellingen. Deze actie kan niet ongedaan worden gemaakt.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuleren</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAccount} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {deleting ? "Verwijderen..." : "Account Verwijderen"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
};

export default Account;