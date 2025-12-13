import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStoredAccessToken, redirectToSpotifyAuth, logout, refreshAccessToken } from '@/auth/spotifyAuth';
import { getUserProfile } from '@/api/spotifyApi';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';

export default function Settings() {
  const navigate = useNavigate();
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyUser, setSpotifyUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSpotifyConnection = async () => {
      // First check localStorage
      let token = getStoredAccessToken();
      
      if (token) {
        try {
          const profile = await getUserProfile(token);
          setSpotifyUser(profile);
          setSpotifyConnected(true);
          setLoading(false);
          return;
        } catch (error) {
          console.error('Failed to fetch Spotify profile from localStorage token:', error);
        }
      }

      // If no valid localStorage token, check database
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: spotifyConnection, error } = await supabase
          .from('spotify_connections')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (spotifyConnection && !error) {
          // Try to restore tokens from database
          if (spotifyConnection.spotify_refresh_token) {
            try {
              // Set refresh token in localStorage first
              localStorage.setItem('refresh_token', spotifyConnection.spotify_refresh_token);
              
              // Try to get a new access token
              const newToken = await refreshAccessToken();
              
              if (newToken) {
                const profile = await getUserProfile(newToken);
                setSpotifyUser(profile);
                setSpotifyConnected(true);
                
                // Update token in database
                await supabase
                  .from('spotify_connections')
                  .update({ 
                    spotify_token: newToken,
                    updated_at: new Date().toISOString()
                  })
                  .eq('user_id', user.id);
              }
            } catch (refreshError) {
              console.error('Failed to refresh token:', refreshError);
              // Connection exists but tokens are invalid
              setSpotifyUser({
                display_name: spotifyConnection.spotify_display_name,
                email: spotifyConnection.spotify_email,
              });
              setSpotifyConnected(false);
            }
          }
        }
      }
      
      setLoading(false);
    };

    checkSpotifyConnection();
  }, []);

  const handleSpotifyLogin = async () => {
    try {
      await redirectToSpotifyAuth();
    } catch (error) {
      console.error('Failed to redirect to Spotify:', error);
      toast({
        title: 'Error',
        description: 'Failed to connect to Spotify',
        variant: 'destructive',
      });
    }
  };

  const handleSpotifyLogout = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Remove from database
      await supabase
        .from('spotify_connections')
        .delete()
        .eq('user_id', user.id);
    }
    
    // Clear localStorage
    logout();
    setSpotifyConnected(false);
    setSpotifyUser(null);
    toast({
      title: 'Ontkoppeld',
      description: 'Spotify is succesvol ontkoppeld van je account',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto p-6">
          <h1 className="text-4xl font-bold text-foreground mb-8">Instellingen</h1>
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
        <h1 className="text-4xl font-bold text-foreground">Instellingen</h1>

        {/* Spotify Integration Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              Spotify Integratie
            </CardTitle>
            <CardDescription>
              Verbind je Spotify account om gepersonaliseerde muziekaanbevelingen te krijgen en muziek af te spelen
            </CardDescription>
          </CardHeader>
          <CardContent>
            {spotifyConnected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-accent rounded-lg">
                  {spotifyUser?.images?.[0]?.url && (
                    <img 
                      src={spotifyUser.images[0].url} 
                      alt="Profile" 
                      className="w-16 h-16 rounded-full"
                    />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{spotifyUser?.display_name || 'Spotify User'}</p>
                    <p className="text-sm text-muted-foreground">{spotifyUser?.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {spotifyUser?.product === 'premium' ? 'Premium Account' : 'Free Account'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-primary">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">Verbonden</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => navigate('/dashboard')} variant="default">
                    Ga naar Dashboard
                  </Button>
                  <Button onClick={handleSpotifyLogout} variant="outline">
                    Ontkoppel Spotify
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Je hebt nog geen Spotify account verbonden. Verbind je account om toegang te krijgen tot:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                  <li>Gepersonaliseerde muziekaanbevelingen</li>
                  <li>Muziek afspelen direct in de app</li>
                  <li>Je top artiesten en playlists</li>
                  <li>Studiemuziek aanbevelingen</li>
                </ul>
                <Button onClick={handleSpotifyLogin} className="mt-4">
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                  </svg>
                  Verbind met Spotify
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Other Settings Cards */}
        <Card>
          <CardHeader>
            <CardTitle>Account Instellingen</CardTitle>
            <CardDescription>Beheer je account en voorkeuren</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Meer instellingen komen binnenkort...</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
