import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAccessToken } from '@/auth/spotifyAuth';
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
        navigate('/');
        return;
      }

      if (!code) {
        navigate('/');
        return;
      }

      try {
        await getAccessToken(code);
        toast({
          title: 'Login Successful',
          description: 'Welcome to Grutto Player!',
        });
        navigate('/player');
      } catch (error) {
        console.error('Error getting access token:', error);
        toast({
          title: 'Authentication Error',
          description: 'Failed to complete login. Please try again.',
          variant: 'destructive',
        });
        navigate('/');
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4"></div>
        <p className="text-muted-foreground">Inloggen...</p>
      </div>
    </div>
  );
}
