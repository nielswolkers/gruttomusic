import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAccessToken } from '@/auth/spotifyAuth';
import { getUserProfile } from '@/api/spotifyApi';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export default function Callback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const error = params.get('error');

      if (error) {
        toast({
          title: 'Authentication Failed',
          description: error,
          variant: 'destructive',
        });
        navigate('/instellingen');
        return;
      }

      if (!code) {
        navigate('/dashboard');
        return;
      }

      try {
        const tokenData = await getAccessToken(code);
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Get Spotify profile
          const spotifyProfile = await getUserProfile(tokenData.access_token);
          
          // Save Spotify connection to database
          const { error: upsertError } = await supabase
            .from('spotify_connections')
            .upsert({
              user_id: user.id,
              spotify_token: tokenData.access_token,
              spotify_refresh_token: tokenData.refresh_token,
              spotify_user_id: spotifyProfile.id,
              spotify_display_name: spotifyProfile.display_name,
              spotify_email: spotifyProfile.email,
              connected_at: new Date().toISOString(),
            }, {
              onConflict: 'user_id'
            });

          if (upsertError) {
            console.error('Error saving Spotify connection:', upsertError);
          }
        }
        
        toast({
          title: 'Verbonden met Spotify',
          description: 'Je Spotify account is succesvol gekoppeld!',
        });
        navigate('/dashboard');
      } catch (error) {
        console.error('Error getting access token:', error);
        toast({
          title: 'Authenticatie Fout',
          description: 'Verbinding met Spotify mislukt. Probeer opnieuw.',
          variant: 'destructive',
        });
        navigate('/instellingen');
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4"></div>
        <p className="text-muted-foreground">Verbinden met Spotify...</p>
      </div>
    </div>
  );
}
