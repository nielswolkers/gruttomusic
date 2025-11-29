/// <reference types="vite/client" />

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: typeof Spotify;
  }

  namespace Spotify {
    interface Player {
      new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }): Player;
      connect(): Promise<boolean>;
      disconnect(): void;
      addListener(event: string, callback: (data: any) => void): void;
      removeListener(event: string): void;
      getCurrentState(): Promise<PlaybackState | null>;
      setVolume(volume: number): Promise<void>;
      pause(): Promise<void>;
      resume(): Promise<void>;
      togglePlay(): Promise<void>;
      seek(positionMs: number): Promise<void>;
      previousTrack(): Promise<void>;
      nextTrack(): Promise<void>;
    }

    interface PlaybackState {
      context: {
        uri: string;
        metadata: any;
      };
      disallows: {
        pausing: boolean;
        skipping_prev: boolean;
      };
      paused: boolean;
      position: number;
      repeat_mode: number;
      shuffle: boolean;
      track_window: {
        current_track: Track;
        previous_tracks: Track[];
        next_tracks: Track[];
      };
      duration: number;
    }

    interface Track {
      uri: string;
      id: string;
      type: string;
      media_type: string;
      name: string;
      is_playable: boolean;
      album: {
        uri: string;
        name: string;
        images: Array<{ url: string; height: number; width: number }>;
      };
      artists: Array<{
        uri: string;
        name: string;
      }>;
    }
  }
}

export {}
