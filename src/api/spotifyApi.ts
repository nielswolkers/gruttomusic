import { refreshAccessToken } from '@/auth/spotifyAuth';

export interface SpotifyArtist {
  id: string;
  name: string;
  images: Array<{ url: string; height: number; width: number }>;
  genres: string[];
  uri: string;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string; id: string }>;
  album: {
    name: string;
    images: Array<{ url: string; height: number; width: number }>;
  };
  uri: string;
  duration_ms: number;
}

async function fetchWithAuth(url: string, accessToken: string, options?: RequestInit) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (response.status === 401) {
    // Token expired, try to refresh
    const newToken = await refreshAccessToken();
    return fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${newToken}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  }

  return response;
}

export async function getTopArtists(accessToken: string, limit: number = 20): Promise<SpotifyArtist[]> {
  const response = await fetchWithAuth(
    `https://api.spotify.com/v1/me/top/artists?limit=${limit}&time_range=medium_term`,
    accessToken
  );

  if (!response.ok) {
    throw new Error('Failed to fetch top artists');
  }

  const data = await response.json();
  return data.items;
}

export async function getRelatedArtists(artistId: string, accessToken: string): Promise<SpotifyArtist[]> {
  const response = await fetchWithAuth(
    `https://api.spotify.com/v1/artists/${artistId}/related-artists`,
    accessToken
  );

  if (!response.ok) {
    throw new Error('Failed to fetch related artists');
  }

  const data = await response.json();
  return data.artists;
}

export async function getArtistTopTracks(artistId: string, accessToken: string): Promise<SpotifyTrack[]> {
  const response = await fetchWithAuth(
    `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`,
    accessToken
  );

  if (!response.ok) {
    throw new Error('Failed to fetch artist top tracks');
  }

  const data = await response.json();
  return data.tracks;
}

export async function playTrack(trackUri: string, accessToken: string, deviceId?: string): Promise<void> {
  const url = deviceId
    ? `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`
    : 'https://api.spotify.com/v1/me/player/play';

  const response = await fetchWithAuth(
    url,
    accessToken,
    {
      method: 'PUT',
      body: JSON.stringify({ uris: [trackUri] })
    }
  );

  if (!response.ok && response.status !== 204) {
    throw new Error('Failed to play track');
  }
}

export async function getUserProfile(accessToken: string) {
  const response = await fetchWithAuth(
    'https://api.spotify.com/v1/me',
    accessToken
  );

  if (!response.ok) {
    throw new Error('Failed to fetch user profile');
  }

  return response.json();
}

export async function getUserPlaylists(accessToken: string, limit: number = 20) {
  const response = await fetchWithAuth(
    `https://api.spotify.com/v1/me/playlists?limit=${limit}`,
    accessToken
  );

  if (!response.ok) {
    throw new Error('Failed to fetch user playlists');
  }

  const data = await response.json();
  return data.items;
}

export async function playContext(
  context: { context_uri?: string; uris?: string[] },
  accessToken: string,
  deviceId?: string
): Promise<void> {
  const url = deviceId
    ? `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`
    : 'https://api.spotify.com/v1/me/player/play';

  const response = await fetchWithAuth(
    url,
    accessToken,
    {
      method: 'PUT',
      body: JSON.stringify(context)
    }
  );

  if (!response.ok && response.status !== 204) {
    throw new Error('Failed to play context');
  }
}
