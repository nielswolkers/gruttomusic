import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStoredAccessToken, logout } from '@/auth/spotifyAuth';
import { getTopArtists, getUserPlaylists, getArtistTopTracks, playTrack, playContext, getUserProfile } from '@/api/spotifyApi';
import { useSpotifyPlayer } from '@/hooks/useSpotifyPlayer';
import { PlaybackBar } from '@/components/PlaybackBar';
import { NowPlayingExpanded } from '@/components/NowPlayingExpanded';
import { Skeleton } from '@/components/ui/skeleton';
import { Play } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { SpotifyArtist } from '@/api/spotifyApi';

interface ContextInfo {
  name: string;
  type: 'artist' | 'playlist';
}

interface RecommendationItem {
  id: string;
  name: string;
  image: string;
  genre: string;
  type: 'artist' | 'playlist';
  uri: string;
}

export default function Player() {
  const navigate = useNavigate();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [items, setItems] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentContext, setCurrentContext] = useState<ContextInfo | null>(null);

  const {
    player,
    deviceId,
    currentTrack,
    isPlaying,
    isReady,
    position,
    duration,
    volume,
    shuffleEnabled,
    repeatMode,
    togglePlay,
    nextTrack,
    previousTrack,
    toggleShuffle,
    toggleRepeat,
    setVolume: setPlayerVolume,
    seek,
  } = useSpotifyPlayer(accessToken);

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) {
      navigate('/');
      return;
    }
    setAccessToken(token);
  }, [navigate]);

  useEffect(() => {
    if (!accessToken) return;

    const fetchData = async () => {
      try {
        const [profile, topArtists, playlists] = await Promise.all([
          getUserProfile(accessToken),
          getTopArtists(accessToken, 3),
          getUserPlaylists(accessToken, 3),
        ]);

        setUserName(profile.display_name || 'User');

        const combined: RecommendationItem[] = [
          ...topArtists.map(artist => ({
            id: artist.id,
            name: artist.name,
            image: artist.images[0]?.url || '',
            genre: artist.genres[0] || 'Artist',
            type: 'artist' as const,
            uri: artist.uri,
          })),
          ...playlists.map((playlist: any) => ({
            id: playlist.id,
            name: playlist.name,
            image: playlist.images[0]?.url || '',
            genre: 'Playlist',
            type: 'playlist' as const,
            uri: playlist.uri,
          }))
        ];

        setItems(combined.slice(0, 6));
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load your music. Please try logging in again.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [accessToken]);

  const handleItemClick = async (item: RecommendationItem) => {
    if (!accessToken || !deviceId) {
      toast({
        title: 'Player Not Ready',
        description: 'Please wait for the player to initialize',
      });
      return;
    }

    try {
      if (item.type === 'artist') {
        const tracks = await getArtistTopTracks(item.id, accessToken);
        if (tracks.length > 0) {
          const uris = tracks.map(t => t.uri);
          await playContext({ uris }, accessToken, deviceId);
        }
      } else {
        await playContext({ context_uri: item.uri }, accessToken, deviceId);
      }

      setCurrentContext({ name: item.name, type: item.type });

      // REMOVED: "Now Playing" notification per user request
    } catch (error) {
      console.error('Error playing:', error);
      toast({
        title: 'Playback Error',
        description: 'Failed to play. Make sure Spotify is active.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white pb-32" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif' }}>
        <header className="px-6 pt-12 pb-8 bg-gradient-to-b from-[#f5f5f7] to-white">
          <Skeleton className="h-12 w-48 mb-2" />
          <Skeleton className="h-6 w-36" />
        </header>

        <main className="px-6 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="w-full aspect-square rounded-3xl" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#1d1d1f] pb-32" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif' }}>
      {/* Header */}
      <header className="px-6 pt-12 pb-8 bg-gradient-to-b from-[#f5f5f7] to-white">
        <h1 className="text-5xl font-bold text-[#1d1d1f] mb-1">Aanbevolen studiemuziek</h1>
        <p className="text-lg text-[#6e6e73]">Door de Grutto-Community</p>
      </header>

      {/* Horizontal Scrolling Row with 6 items */}
      <main className="mt-8">
        {!isReady && (
          <div className="mx-6 mb-6 p-4 bg-[#f5f5f7] rounded-2xl">
            <p className="text-sm text-[#6e6e73]">
              Initialiseren van speler... Dit kan even duren.
            </p>
          </div>
        )}

        <div className="overflow-x-auto scrollbar-hide px-6">
          <div className="flex gap-6 pb-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="group cursor-pointer flex-shrink-0 w-48"
                onClick={() => handleItemClick(item)}
              >
                <div className="relative aspect-square rounded-3xl overflow-hidden bg-gradient-to-br from-[#3e8b68] to-[#2a5f4a] shadow-lg hover:shadow-xl transition-all duration-300">
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
                    <button className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-300">
                      <Play className="w-7 h-7 text-black ml-1" fill="black" />
                    </button>
                  </div>
                </div>
                <h3 className="mt-3 font-semibold text-sm text-[#1d1d1f] truncate">{item.name}</h3>
                <p className="text-xs text-[#6e6e73] mt-0.5 truncate">{item.genre}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Compact Playback Bar */}
      {currentTrack && !isExpanded && (
        <PlaybackBar
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          position={position}
          duration={duration}
          onTogglePlay={togglePlay}
          onNext={nextTrack}
          onPrevious={previousTrack}
          onSeek={seek}
          onExpand={() => setIsExpanded(true)}
        />
      )}

      {/* Expanded Now Playing */}
      {currentTrack && isExpanded && (
        <NowPlayingExpanded
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          position={position}
          duration={duration}
          volume={volume}
          shuffleEnabled={shuffleEnabled}
          repeatMode={repeatMode}
          contextInfo={currentContext}
          onTogglePlay={togglePlay}
          onNext={nextTrack}
          onPrevious={previousTrack}
          onSeek={seek}
          onVolumeChange={setPlayerVolume}
          onToggleShuffle={toggleShuffle}
          onToggleRepeat={toggleRepeat}
          onCollapse={() => setIsExpanded(false)}
        />
      )}
    </div>
  );
}
