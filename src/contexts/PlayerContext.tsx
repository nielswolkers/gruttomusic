import { createContext, useContext, useState, ReactNode } from 'react';
import { useSpotifyPlayer } from '@/hooks/useSpotifyPlayer';
import { getStoredAccessToken } from '@/auth/spotifyAuth';

interface ContextInfo {
  name: string;
  type: 'artist' | 'playlist';
}

interface PlayerContextType {
  currentTrack: Spotify.Track | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  volume: number;
  shuffleEnabled: boolean;
  repeatMode: number;
  deviceId: string | null;
  isExpanded: boolean;
  currentContext: ContextInfo | null;
  togglePlay: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setPlayerVolume: (volume: number) => void;
  seek: (position: number) => void;
  setIsExpanded: (expanded: boolean) => void;
  setCurrentContext: (context: ContextInfo | null) => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const accessToken = getStoredAccessToken();
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentContext, setCurrentContext] = useState<ContextInfo | null>(null);

  const {
    currentTrack,
    isPlaying,
    position,
    duration,
    volume,
    shuffleEnabled,
    repeatMode,
    deviceId,
    togglePlay,
    nextTrack,
    previousTrack,
    toggleShuffle,
    toggleRepeat,
    setVolume: setPlayerVolume,
    seek,
  } = useSpotifyPlayer(accessToken);

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        position,
        duration,
        volume,
        shuffleEnabled,
        repeatMode,
        deviceId,
        isExpanded,
        currentContext,
        togglePlay,
        nextTrack,
        previousTrack,
        toggleShuffle,
        toggleRepeat,
        setPlayerVolume,
        seek,
        setIsExpanded,
        setCurrentContext,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}
