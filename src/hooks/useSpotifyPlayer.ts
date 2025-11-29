import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';

export function useSpotifyPlayer(accessToken: string | null) {
  const [player, setPlayer] = useState<any | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<any | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.5);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [repeatMode, setRepeatMode] = useState(0);

  useEffect(() => {
    if (!accessToken) return;

    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.body.appendChild(script);

    (window as any).onSpotifyWebPlaybackSDKReady = () => {
      const spotifyPlayer = new (window as any).Spotify.Player({
        name: 'Grutto Community Player',
        getOAuthToken: (cb) => {
          cb(accessToken);
        },
        volume: 0.5,
      });

      spotifyPlayer.addListener('initialization_error', ({ message }) => {
        console.error('Initialization Error:', message);
        toast({
          title: 'Player Error',
          description: 'Failed to initialize player',
          variant: 'destructive',
        });
      });

      spotifyPlayer.addListener('authentication_error', ({ message }) => {
        console.error('Authentication Error:', message);
        toast({
          title: 'Authentication Error',
          description: 'Please log in again',
          variant: 'destructive',
        });
      });

      spotifyPlayer.addListener('account_error', ({ message }) => {
        console.error('Account Error:', message);
        toast({
          title: 'Account Error',
          description: 'Spotify Premium is required for playback',
          variant: 'destructive',
        });
      });

      spotifyPlayer.addListener('playback_error', ({ message }) => {
        console.error('Playback Error:', message);
        toast({
          title: 'Playback Error',
          description: 'Failed to play track',
          variant: 'destructive',
        });
      });

      spotifyPlayer.addListener('ready', ({ device_id }) => {
        console.log('Ready with Device ID', device_id);
        setDeviceId(device_id);
        localStorage.setItem('device_id', device_id);
        setIsReady(true);
        toast({
          title: 'Player Ready',
          description: 'You can now play music!',
        });
      });

      spotifyPlayer.addListener('not_ready', ({ device_id }) => {
        console.log('Device ID has gone offline', device_id);
        setIsReady(false);
      });

      spotifyPlayer.addListener('player_state_changed', (state) => {
        if (!state) return;

        setCurrentTrack(state.track_window.current_track);
        setIsPlaying(!state.paused);
        setPosition(state.position);
        setDuration(state.duration);
        setShuffleEnabled(state.shuffle);
        setRepeatMode(state.repeat_mode);
      });

      spotifyPlayer.connect();
      setPlayer(spotifyPlayer);
    };

    return () => {
      player?.disconnect();
    };
  }, [accessToken]);

  // Update position every second when playing
  useEffect(() => {
    if (!player || !isPlaying) return;

    const interval = setInterval(async () => {
      const state = await player.getCurrentState();
      if (state) {
        setPosition(state.position);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [player, isPlaying]);

  const togglePlay = useCallback(() => {
    player?.togglePlay();
  }, [player]);

  const nextTrack = useCallback(() => {
    player?.nextTrack();
  }, [player]);

  const previousTrack = useCallback(() => {
    player?.previousTrack();
  }, [player]);

  const seek = useCallback((positionMs: number) => {
    player?.seek(positionMs);
    setPosition(positionMs);
  }, [player]);

  const setVolume = useCallback((value: number) => {
    player?.setVolume(value);
    setVolumeState(value);
  }, [player]);

  const toggleShuffle = useCallback(async () => {
    if (!accessToken) return;
    try {
      await fetch(`https://api.spotify.com/v1/me/player/shuffle?state=${!shuffleEnabled}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
    } catch (error) {
      console.error('Failed to toggle shuffle:', error);
    }
  }, [accessToken, shuffleEnabled]);

  const toggleRepeat = useCallback(async () => {
    if (!accessToken) return;
    const modes = ['off', 'context', 'track'];
    const nextMode = modes[(repeatMode + 1) % 3];
    try {
      await fetch(`https://api.spotify.com/v1/me/player/repeat?state=${nextMode}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
    } catch (error) {
      console.error('Failed to toggle repeat:', error);
    }
  }, [accessToken, repeatMode]);

  return {
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
    seek,
    setVolume,
    toggleShuffle,
    toggleRepeat,
  };
}
