import { useState } from 'react';
import { useSpotifyPlayer } from '@/hooks/useSpotifyPlayer';
import { getStoredAccessToken } from '@/auth/spotifyAuth';
import { PlaybackBar } from '@/components/PlaybackBar';
import { NowPlayingExpanded } from '@/components/NowPlayingExpanded';
import { MusicRecommendations } from '@/components/MusicRecommendations';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ContextInfo {
  name: string;
  type: 'artist' | 'playlist';
}

export default function Dashboard() {
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
    <div className="min-h-screen bg-background pb-32">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold text-foreground">Vandaag</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">Vandaag</Button>
            <Button variant="ghost" size="sm">Week</Button>
            <Button variant="ghost" size="sm">Maand</Button>
          </div>
        </div>

        {/* Top Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Aankomende toetsen */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Aankomende toetsen</h3>
              <p className="text-sm text-muted-foreground">Geen aankomende toetsen</p>
            </CardContent>
          </Card>

          {/* Je laatste cijfers */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Je laatste cijfers</h3>
              <p className="text-sm text-muted-foreground">Nog geen cijfers toegevoegd</p>
            </CardContent>
          </Card>
        </div>

        {/* Study Progress Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-foreground">Je studievoortgang vandaag</h3>
                <span className="text-xs font-medium bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                  Achter op schema
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground mb-1">Voortgang</p>
                <p className="text-2xl font-bold text-primary">15%</p>
              </div>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full" style={{ width: '15%' }}></div>
            </div>
          </CardContent>
        </Card>

        {/* Music Recommendations */}
        {accessToken ? (
          <MusicRecommendations 
            deviceId={deviceId}
            onContextChange={(name, type) => setCurrentContext({ name, type })}
          />
        ) : (
          <Card>
            <CardContent className="p-6">
              <div className="text-center py-8">
                <h3 className="text-xl font-semibold text-foreground mb-2">Aanbevolen studiemuziek</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Log in met Spotify om gepersonaliseerde muziekaanbevelingen te zien
                </p>
                <Button onClick={() => window.location.href = '/instellingen'}>
                  Verbind met Spotify
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Playback Bar */}
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
