import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getStoredAccessToken } from '@/auth/spotifyAuth';
import { MusicRecommendations } from '@/components/MusicRecommendations';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type TimeFilter = 'vandaag' | 'week' | 'maand';

const filterTitles: Record<TimeFilter, string> = {
  vandaag: 'Vandaag',
  week: 'Deze week',
  maand: 'Deze maand',
};

interface OutletContextType {
  deviceId: string | null;
  setCurrentContext: (name: string, type: 'artist' | 'playlist') => void;
}

export default function Dashboard() {
  const accessToken = getStoredAccessToken();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('vandaag');
  const { deviceId, setCurrentContext } = useOutletContext<OutletContextType>() || {};

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-4xl font-bold text-foreground">Home</h1>
          
          {/* macOS-style segmented control */}
          <div className="flex bg-muted rounded-lg p-1 gap-0.5">
            {(['vandaag', 'week', 'maand'] as TimeFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  timeFilter === filter
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {filter === 'vandaag' ? 'Vandaag' : filter === 'week' ? 'Week' : 'Maand'}
              </button>
            ))}
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
            deviceId={deviceId || null}
            onContextChange={(name, type) => setCurrentContext?.(name, type)}
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
    </div>
  );
}
