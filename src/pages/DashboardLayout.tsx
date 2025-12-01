import { useState, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { useSpotifyPlayer } from '@/hooks/useSpotifyPlayer';
import { getStoredAccessToken } from '@/auth/spotifyAuth';
import { PlaybackBar } from '@/components/PlaybackBar';
import { NowPlayingExpanded } from '@/components/NowPlayingExpanded';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { ImperativePanelHandle } from 'react-resizable-panels';

interface ContextInfo {
  name: string;
  type: 'artist' | 'playlist';
}

export default function DashboardLayout() {
  const accessToken = getStoredAccessToken();
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentContext, setCurrentContext] = useState<ContextInfo | null>(null);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);
  const [sidebarSize, setSidebarSize] = useState(15);

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
        <ResizablePanel 
          ref={sidebarPanelRef}
          defaultSize={15} 
          minSize={5} 
          maxSize={15}
          onResize={(size) => setSidebarSize(size)}
        >
          <div
            onMouseEnter={() => {
              setSidebarHovered(true);
              if (sidebarSize < 12 && sidebarPanelRef.current) {
                sidebarPanelRef.current.resize(15);
              }
            }}
            onMouseLeave={() => {
              setSidebarHovered(false);
              if (sidebarSize >= 15 && sidebarPanelRef.current) {
                sidebarPanelRef.current.resize(sidebarSize);
              }
            }}
            className="h-full"
          >
            <Sidebar collapsed={sidebarSize < 12} />
          </div>
        </ResizablePanel>
        
        <ResizableHandle />
        
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
