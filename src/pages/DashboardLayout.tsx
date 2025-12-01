import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { useSpotifyPlayer } from '@/hooks/useSpotifyPlayer';
import { getStoredAccessToken } from '@/auth/spotifyAuth';
import { PlaybackBar } from '@/components/PlaybackBar';
import { NowPlayingExpanded } from '@/components/NowPlayingExpanded';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';

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
    <div className="flex h-screen bg-background overflow-hidden">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
          <Sidebar />
        </ResizablePanel>
        
        <ResizableHandle withHandle />
        
        <ResizablePanel defaultSize={80}>
          <div className="relative h-full flex flex-col">
            <main className="flex-1 overflow-y-auto">
              <Outlet context={{ deviceId, setCurrentContext }} />
            </main>
            
            {/* Playback Bar - stays in right area */}
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

            {/* Expanded Now Playing - full screen */}
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
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
