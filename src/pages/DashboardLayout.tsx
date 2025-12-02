import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { useSpotifyPlayer } from '@/hooks/useSpotifyPlayer';
import { getStoredAccessToken } from '@/auth/spotifyAuth';
import { PlaybackBar } from '@/components/PlaybackBar';
import { NowPlayingExpanded } from '@/components/NowPlayingExpanded';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ContextInfo {
  name: string;
  type: 'artist' | 'playlist';
}

export default function DashboardLayout() {
  const accessToken = getStoredAccessToken();
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentContext, setCurrentContext] = useState<ContextInfo | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
          defaultSize={20} 
          minSize={sidebarCollapsed ? 5 : 15} 
          maxSize={sidebarCollapsed ? 5 : 30}
          collapsible
          onCollapse={() => setSidebarCollapsed(true)}
          onExpand={() => setSidebarCollapsed(false)}
        >
          <Sidebar collapsed={sidebarCollapsed} />
        </ResizablePanel>
        
        <ResizableHandle>
          <button 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-border hover:bg-muted flex items-center justify-center transition-colors z-10"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </ResizableHandle>
        
        <ResizablePanel defaultSize={80} minSize={50}>
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
