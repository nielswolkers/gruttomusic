import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { PlaybackBar } from '@/components/PlaybackBar';
import { NowPlayingExpanded } from '@/components/NowPlayingExpanded';
import { PlayerProvider, usePlayer } from '@/contexts/PlayerContext';

function DashboardContent() {
  const location = useLocation();
  const {
    currentTrack,
    isPlaying,
    position,
    duration,
    volume,
    shuffleEnabled,
    repeatMode,
    currentContext,
    isExpanded,
    togglePlay,
    nextTrack,
    previousTrack,
    seek,
    setPlayerVolume,
    toggleShuffle,
    toggleRepeat,
    setIsExpanded,
  } = usePlayer();

  // Hide playbar on account and meldingen pages
  const hidePlaybar = ['/account', '/meldingen'].includes(location.pathname);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Playback Bar - persists across pages except account/meldingen */}
      {currentTrack && !isExpanded && !hidePlaybar && (
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

export default function DashboardLayout() {
  return (
    <PlayerProvider>
      <DashboardContent />
    </PlayerProvider>
  );
}
