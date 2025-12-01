import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getStoredAccessToken } from '@/auth/spotifyAuth';
import { MusicRecommendations } from '@/components/MusicRecommendations';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface OutletContext {
  deviceId: string | null;
  setCurrentContext: (name: string, type: 'artist' | 'playlist') => void;
}

export default function Dashboard() {
  const accessToken = getStoredAccessToken();
  const { deviceId, setCurrentContext } = useOutletContext<OutletContext>();
  const [timePeriod, setTimePeriod] = useState<'vandaag' | 'week' | 'maand'>('vandaag');

  const getTitle = () => {
    switch (timePeriod) {
      case 'vandaag': return 'Vandaag';
      case 'week': return 'Deze week';
      case 'maand': return 'Deze maand';
    }
  };

  return (
    <div className="min-h-full bg-background pb-32">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold text-foreground">{getTitle()}</h1>
          <div className="flex gap-2 bg-muted rounded-lg p-1">
            <Button 
              variant={timePeriod === 'vandaag' ? 'secondary' : 'ghost'} 
              size="sm"
              onClick={() => setTimePeriod('vandaag')}
              className="rounded-md"
            >
              Vandaag
            </Button>
            <Button 
              variant={timePeriod === 'week' ? 'secondary' : 'ghost'} 
              size="sm"
              onClick={() => setTimePeriod('week')}
              className="rounded-md"
            >
              Week
            </Button>
            <Button 
              variant={timePeriod === 'maand' ? 'secondary' : 'ghost'} 
              size="sm"
              onClick={() => setTimePeriod('maand')}
              className="rounded-md"
            >
              Maand
            </Button>
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
            onContextChange={(name, type) => setCurrentContext(name, type)}
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
