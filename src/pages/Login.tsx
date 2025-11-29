import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { redirectToSpotifyAuth, getStoredAccessToken } from '@/auth/spotifyAuth';
import gruttoLogo from '@/assets/grutto-logo.png';

export default function Login() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = getStoredAccessToken();
    if (token) {
      navigate('/player');
    }
  }, [navigate]);

  const handleLogin = () => {
    redirectToSpotifyAuth();
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-[#f5f5f7]"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif' }}
    >
      <div className="w-full max-w-md text-center space-y-8 p-8">
        <div className="flex justify-center">
          <img
            src={gruttoLogo}
            alt="Grutto Logo"
            className="h-20 w-auto"
          />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-[#1d1d1f]">Grutto Music</h1>
        </div>

        <div className="space-y-6">
          <button
            onClick={handleLogin}
            className="w-full bg-[#3e8b68] hover:bg-[#2a5f4a] text-white font-semibold py-4 px-8 rounded-3xl text-lg shadow-lg hover:shadow-xl transition-all duration-300"
          >
            Inloggen met Spotify
          </button>

          <p className="text-sm text-[#6e6e73]">
            Voor het afspelen van muziek is een Spotify Premium account vereist
          </p>
        </div>
      </div>
    </div>
  );
}
