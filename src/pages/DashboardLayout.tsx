import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { useSpotifyPlayer } from '@/hooks/useSpotifyPlayer';
import { getStoredAccessToken } from '@/auth/spotifyAuth';
import { PlaybackBar } from '@/components/PlaybackBar';
import { NowPlayingExpanded } from '@/components/NowPlayingExpanded';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';

interface ContextInfo {
  name: string;
  type: 'artist' | 'playlist';
}

export default function DashboardLayout() {
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
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full bg-background overflow-hidden">
        <Sidebar />
        
        <SidebarInset className="flex-1">
          <div className="relative h-full flex flex-col">
            <main className="flex-1 overflow-y-auto">
              <Outlet context={{ deviceId, setCurrentContext }} />
            </main>
            
            {/* Playback Bar - stays in right area only */}
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
          </div>
        </SidebarInset>

        {/* Expanded Now Playing - full screen overlay */}
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
    </SidebarProvider>
  );
}
