import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import gruttoLogo from '@/assets/grutto-logo.png';

export default function Auth() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/dashboard');
      }
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate('/dashboard');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkUsernameAvailable = async (username: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .single();
    
    if (error && error.code === 'PGRST116') {
      return true; // No row found, username is available
    }
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast({ title: 'Welkom terug!', description: 'Je bent succesvol ingelogd.' });
      } else {
        // Validate fields
        if (!fullName.trim()) {
          throw new Error('Vul je volledige naam in.');
        }
        if (!username.trim()) {
          throw new Error('Vul een gebruikersnaam in.');
        }
        if (username.length < 3) {
          throw new Error('Gebruikersnaam moet minimaal 3 karakters zijn.');
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
          throw new Error('Gebruikersnaam mag alleen letters, cijfers en underscores bevatten.');
        }

        // Check if username is available
        const isAvailable = await checkUsernameAvailable(username);
        if (!isAvailable) {
          throw new Error('Deze gebruikersnaam is al in gebruik. Kies een andere.');
        }

        // Sign up
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (signUpError) throw signUpError;

        // Create profile
        if (authData.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              user_id: authData.user.id,
              full_name: fullName.trim(),
              username: username.trim().toLowerCase(),
            });
          
          if (profileError) {
            // If profile creation fails, we should handle it
            console.error('Profile creation error:', profileError);
            if (profileError.code === '23505') {
              throw new Error('Deze gebruikersnaam is al in gebruik.');
            }
            throw profileError;
          }
        }

        toast({ title: 'Account aangemaakt!', description: 'Je bent succesvol geregistreerd.' });
      }
    } catch (error: any) {
      let message = error.message;
      if (error.message?.includes('User already registered')) {
        message = 'Dit e-mailadres is al geregistreerd. Probeer in te loggen.';
      } else if (error.message?.includes('Invalid login credentials')) {
        message = 'Ongeldige inloggegevens. Controleer je e-mail en wachtwoord.';
      }
      toast({ title: 'Fout', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={gruttoLogo} alt="Grutto" className="h-10 w-auto mx-auto mb-4" />
          <CardTitle>{isLogin ? 'Inloggen' : 'Registreren'}</CardTitle>
          <CardDescription>
            {isLogin 
              ? 'Voer je gegevens in om in te loggen'
              : 'Maak een nieuw account aan'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <Input
                    type="text"
                    placeholder="Volledige naam"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Input
                    type="text"
                    placeholder="Gebruikersnaam"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    required
                    minLength={3}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Alleen letters, cijfers en underscores
                  </p>
                </div>
              </>
            )}
            <div>
              <Input
                type="email"
                placeholder="E-mailadres"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Wachtwoord"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Laden...' : isLogin ? 'Inloggen' : 'Registreren'}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isLogin 
                ? 'Nog geen account? Registreer hier'
                : 'Al een account? Log hier in'
              }
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
