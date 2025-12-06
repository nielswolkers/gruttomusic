import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { LogOut, User, Save } from 'lucide-react';

interface Profile {
  full_name: string;
  username: string;
}

export default function Account() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [originalUsername, setOriginalUsername] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
      } else if (data) {
        setProfile(data);
        setFullName(data.full_name);
        setUsername(data.username);
        setOriginalUsername(data.username);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [user]);

  const checkUsernameAvailable = async (newUsername: string): Promise<boolean> => {
    if (newUsername === originalUsername) return true;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', newUsername)
      .single();
    
    if (error && error.code === 'PGRST116') {
      return true;
    }
    return false;
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      if (!fullName.trim()) {
        throw new Error('Naam mag niet leeg zijn.');
      }
      if (!username.trim() || username.length < 3) {
        throw new Error('Gebruikersnaam moet minimaal 3 karakters zijn.');
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        throw new Error('Gebruikersnaam mag alleen letters, cijfers en underscores bevatten.');
      }

      const isAvailable = await checkUsernameAvailable(username.toLowerCase());
      if (!isAvailable) {
        throw new Error('Deze gebruikersnaam is al in gebruik.');
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          username: username.trim().toLowerCase(),
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setOriginalUsername(username.toLowerCase());
      toast({ title: 'Opgeslagen', description: 'Je profiel is bijgewerkt.' });
    } catch (error: any) {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto p-6">
          <h1 className="text-4xl font-bold text-foreground mb-8">Account</h1>
          <div className="animate-pulse">
            <div className="h-48 bg-muted rounded-2xl"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <h1 className="text-4xl font-bold text-foreground mb-8">Account</h1>

        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <User className="w-6 h-6" />
              Profiel
            </CardTitle>
            <CardDescription>
              Beheer je account gegevens
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                E-mailadres
              </label>
              <Input
                type="email"
                value={user?.email || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground mt-1">
                E-mailadres kan niet worden gewijzigd
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Volledige naam
              </label>
              <Input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Je volledige naam"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Gebruikersnaam
              </label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="je_gebruikersnaam"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Alleen letters, cijfers en underscores
              </p>
            </div>
            <Button onClick={handleSave} disabled={saving} className="mt-4">
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Opslaan...' : 'Wijzigingen opslaan'}
            </Button>
          </CardContent>
        </Card>

        {/* Logout Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <LogOut className="w-6 h-6" />
              Uitloggen
            </CardTitle>
            <CardDescription>
              Log uit van je account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleLogout} variant="destructive">
              <LogOut className="w-4 h-4 mr-2" />
              Uitloggen
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
