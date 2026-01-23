import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Link } from "lucide-react";
import { redirectToGoogleAuth, logoutGoogle } from "@/auth/googleAuth";
import zermeloLogo from "@/assets/zermelo-logo.png";
import outlookLogo from "@/assets/outlook-logo.png";

interface CalendarConnection {
  id: string;
  provider: string;
  ics_url: string;
  display_name: string | null;
  connected_at: string;
}

interface GoogleConnection {
  id: string;
  google_email: string | null;
  google_name: string | null;
  connected_at: string;
}

const CalendarIntegrations = () => {
  const { user } = useAuth();
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [googleConnection, setGoogleConnection] = useState<GoogleConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'zermelo' | 'outlook' | null>(null);
  const [icsUrl, setIcsUrl] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      loadConnections();
      loadGoogleConnection();
    }
  }, [user]);

  const loadConnections = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('calendar_connections')
        .select('*')
        .eq('user_id', user.id)
        .order('connected_at', { ascending: false });

      if (error) throw error;
      setConnections(data || []);
    } catch (error) {
      console.error('Failed to load calendar connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGoogleConnection = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('google_calendar_connections')
        .select('id, google_email, google_name, connected_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setGoogleConnection(data);
    } catch (error) {
      console.error('Failed to load Google connection:', error);
    }
  };

  const handleConnect = async () => {
    if (!user || !selectedProvider || !icsUrl.trim()) {
      toast.error("Voer een geldige ICS URL in");
      return;
    }

    setSaving(true);
    try {
      // Use edge function to fetch ICS (to avoid CORS issues)
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-ics`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ url: icsUrl.trim() }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Kon de kalender niet ophalen. Controleer de URL.");
      }
      
      const { content } = await response.json();
      if (!content.includes('BEGIN:VCALENDAR')) {
        throw new Error("Dit is geen geldige ICS kalender URL.");
      }

      const { error } = await supabase
        .from('calendar_connections')
        .insert({
          user_id: user.id,
          provider: selectedProvider,
          ics_url: icsUrl.trim(),
          display_name: displayName.trim() || null,
        });

      if (error) throw error;

      // Create notification
      await supabase.from('notifications').insert({
        recipient_id: user.id,
        sender_id: user.id,
        type: 'calendar_connected',
        message: `${selectedProvider === 'zermelo' ? 'Zermelo' : 'Outlook'} kalender is succesvol gekoppeld`,
      });

      toast.success(`${selectedProvider === 'zermelo' ? 'Zermelo' : 'Outlook'} kalender gekoppeld`);
      setDialogOpen(false);
      setSelectedProvider(null);
      setIcsUrl("");
      setDisplayName("");
      loadConnections();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Kon kalender niet koppelen";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async (connection: CalendarConnection) => {
    if (!user) return;
    try {
      await supabase.from('calendar_connections').delete().eq('id', connection.id);
      toast.success("Kalender ontkoppeld");
      loadConnections();
    } catch (error) {
      toast.error("Kon kalender niet ontkoppelen");
    }
  };

  const handleGoogleConnect = async () => {
    try {
      await redirectToGoogleAuth();
    } catch (error) {
      console.error('Failed to redirect to Google:', error);
      toast.error('Kon niet verbinden met Google');
    }
  };

  const handleGoogleDisconnect = async () => {
    if (!user) return;
    try {
      await supabase.from('google_calendar_connections').delete().eq('user_id', user.id);
      logoutGoogle();
      setGoogleConnection(null);
      toast.success("Google Agenda ontkoppeld");
    } catch (error) {
      toast.error("Kon Google Agenda niet ontkoppelen");
    }
  };

  const openConnectDialog = (provider: 'zermelo' | 'outlook') => {
    setSelectedProvider(provider);
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-20 bg-muted rounded-xl" />
        <div className="h-20 bg-muted rounded-xl" />
        <div className="h-20 bg-muted rounded-xl" />
      </div>
    );
  }

  const zermeloConnection = connections.find(c => c.provider === 'zermelo');
  const outlookConnection = connections.find(c => c.provider === 'outlook');

  return (
    <div className="space-y-4">
      {/* Zermelo */}
      <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-white flex items-center justify-center p-1">
            <img src={zermeloLogo} alt="Zermelo" className="w-full h-full object-contain" />
          </div>
          <div>
            <p className="font-medium">Zermelo</p>
            <p className="text-sm text-muted-foreground">
              {zermeloConnection 
                ? zermeloConnection.display_name || 'Verbonden' 
                : 'Schoolrooster synchronisatie'}
            </p>
          </div>
        </div>
        
        {zermeloConnection ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-primary">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span className="text-sm">Actief</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleDisconnect(zermeloConnection)} 
              className="rounded-full"
            >
              Ontkoppelen
            </Button>
          </div>
        ) : (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => openConnectDialog('zermelo')} 
            className="rounded-full"
          >
            Verbinden
          </Button>
        )}
      </div>

      {/* Outlook */}
      <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-white flex items-center justify-center p-1">
            <img src={outlookLogo} alt="Outlook" className="w-full h-full object-contain" />
          </div>
          <div>
            <p className="font-medium">Outlook</p>
            <p className="text-sm text-muted-foreground">
              {outlookConnection 
                ? outlookConnection.display_name || 'Verbonden' 
                : 'Microsoft 365 kalender'}
            </p>
          </div>
        </div>
        
        {outlookConnection ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-primary">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span className="text-sm">Actief</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleDisconnect(outlookConnection)} 
              className="rounded-full"
            >
              Ontkoppelen
            </Button>
          </div>
        ) : (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => openConnectDialog('outlook')} 
            className="rounded-full"
          >
            Verbinden
          </Button>
        )}
      </div>

      {/* Google Calendar */}
      <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-white flex items-center justify-center">
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          </div>
          <div>
            <p className="font-medium">Google Agenda</p>
            <p className="text-sm text-muted-foreground">
              {googleConnection 
                ? googleConnection.google_email || 'Verbonden' 
                : 'Google kalender synchronisatie'}
            </p>
          </div>
        </div>
        
        {googleConnection ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-primary">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span className="text-sm">Actief</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleGoogleDisconnect} 
              className="rounded-full"
            >
              Ontkoppelen
            </Button>
          </div>
        ) : (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleGoogleConnect} 
            className="rounded-full"
          >
            Verbinden
          </Button>
        )}
      </div>

      {/* Connect Dialog for ICS */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedProvider === 'zermelo' ? 'Zermelo' : 'Outlook'} koppelen
            </DialogTitle>
            <DialogDescription>
              Voer de ICS kalender link in om je {selectedProvider === 'zermelo' ? 'schoolrooster' : 'Outlook kalender'} te synchroniseren.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="icsUrl">ICS Kalender URL</Label>
              <div className="relative">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="icsUrl"
                  value={icsUrl}
                  onChange={(e) => setIcsUrl(e.target.value)}
                  placeholder="https://..."
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedProvider === 'zermelo' 
                  ? "Je vindt deze link in Zermelo onder Instellingen → Koppeling → ICS"
                  : "Ga naar Outlook → Kalender → Instellingen → Gedeelde kalenders → Publiceren"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Weergavenaam (optioneel)</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={selectedProvider === 'zermelo' ? "Mijn rooster" : "Werk kalender"}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-full">
              Annuleren
            </Button>
            <Button onClick={handleConnect} disabled={saving || !icsUrl.trim()} className="rounded-full">
              {saving ? "Koppelen..." : "Koppelen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarIntegrations;
